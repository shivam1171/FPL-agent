"""
Suggester node that uses GPT-4o to generate transfer recommendations.
Supports regular transfers AND chip-specific advice (Wildcard, Free Hit, Bench Boost, Triple Captain).
"""
from typing import Dict, Any, List
from ..state import AgentState
from ..tools.fpl_tools import find_top_performers_by_position
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from ...config import settings
import json
import logging

logger = logging.getLogger(__name__)


# FPL squad rules — used by the post-LLM validator and repair logic.
POSITION_REQUIREMENTS = {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3}
TEAM_COUNT_LIMIT = 3
TOTAL_SQUAD_SIZE = 15
STARTER_COUNT = 11
COST_TOLERANCE = 0.05  # £0.05m float tolerance


def _count_by(squad: List[dict], key: str) -> Dict[Any, int]:
    counts: Dict[Any, int] = {}
    for p in squad:
        k = p.get(key, "")
        counts[k] = counts.get(k, 0) + 1
    return counts


def _validate_full_squad(squad: List[dict], total_budget: float) -> List[str]:
    """Check the full 15-man squad against all FPL rules. Returns violation strings."""
    violations: List[str] = []

    if len(squad) != TOTAL_SQUAD_SIZE:
        violations.append(f"Squad has {len(squad)} players; must be exactly {TOTAL_SQUAD_SIZE}.")

    pos_counts = _count_by(squad, "position")
    for pos, required in POSITION_REQUIREMENTS.items():
        if pos_counts.get(pos, 0) != required:
            violations.append(f"Need {required} {pos}; got {pos_counts.get(pos, 0)}.")

    team_counts = _count_by(squad, "team_name")
    for team, count in team_counts.items():
        if count > TEAM_COUNT_LIMIT:
            violations.append(f"Team '{team}' has {count} players (max {TEAM_COUNT_LIMIT}).")

    total_cost = sum(float(p.get("cost") or 0) for p in squad)
    if total_cost > total_budget + COST_TOLERANCE:
        violations.append(f"Total cost £{total_cost:.1f}m exceeds budget £{total_budget:.1f}m.")

    ids = [p.get("player_id") for p in squad]
    if len(set(ids)) != len(ids):
        violations.append("Squad contains duplicate players.")

    starters = [p for p in squad if p.get("is_starter")]
    if len(starters) != STARTER_COUNT:
        violations.append(f"Need {STARTER_COUNT} starters; got {len(starters)}.")

    starter_pos = _count_by(starters, "position")
    if starter_pos.get("GKP", 0) != 1:
        violations.append(f"Starting XI must have exactly 1 GKP; got {starter_pos.get('GKP', 0)}.")
    if not 3 <= starter_pos.get("DEF", 0) <= 5:
        violations.append(f"Starting XI must have 3-5 DEF; got {starter_pos.get('DEF', 0)}.")
    if not 2 <= starter_pos.get("MID", 0) <= 5:
        violations.append(f"Starting XI must have 2-5 MID; got {starter_pos.get('MID', 0)}.")
    if not 1 <= starter_pos.get("FWD", 0) <= 3:
        violations.append(f"Starting XI must have 1-3 FWD; got {starter_pos.get('FWD', 0)}.")

    captains = [p for p in squad if p.get("is_captain")]
    vices = [p for p in squad if p.get("is_vice_captain")]
    if len(captains) != 1:
        violations.append(f"Need exactly 1 captain; got {len(captains)}.")
    if len(vices) != 1:
        violations.append(f"Need exactly 1 vice-captain; got {len(vices)}.")
    if captains and not captains[0].get("is_starter"):
        violations.append("Captain must be in the starting XI.")
    if vices and not vices[0].get("is_starter"):
        violations.append("Vice-captain must be in the starting XI.")
    if captains and vices and captains[0].get("player_id") == vices[0].get("player_id"):
        violations.append("Captain and vice-captain must be different players.")

    return violations


def _dedupe_squad(
    squad: List[dict], all_players: List[dict], total_budget: float
) -> List[dict]:
    """Replace duplicate player_ids with alternatives in the same position."""
    squad = [dict(p) for p in squad]
    seen_ids: set = set()
    squad_ids = {p.get("player_id") for p in squad}
    current_total = sum(float(p.get("cost") or 0) for p in squad)
    team_counts = _count_by(squad, "team_name")

    for i, pick in enumerate(squad):
        pid = pick.get("player_id")
        if pid is not None and pid not in seen_ids:
            seen_ids.add(pid)
            continue

        pos = pick.get("position")
        removed_cost = float(pick.get("cost") or 0)
        available = total_budget - current_total + removed_cost
        old_team = pick.get("team_name") or ""

        candidates = [
            p
            for p in all_players
            if p.get("position") == pos
            and p["id"] not in seen_ids
            and p["id"] not in squad_ids
            and team_counts.get(p.get("team_name") or "", 0) < TEAM_COUNT_LIMIT
            and (p.get("now_cost", 0) / 10) <= available + COST_TOLERANCE
            and p.get("status", "a") == "a"
        ]
        candidates.sort(
            key=lambda p: float(p.get("form") or 0) * float(p.get("points_per_game") or 0),
            reverse=True,
        )
        if not candidates:
            logger.warning(
                "Dedupe: no alternative for duplicate %s (%s) within £%.1fm.",
                pick.get("player_name"),
                pos,
                available,
            )
            continue

        new = candidates[0]
        replacement = {
            "player_id": new["id"],
            "player_name": new.get("web_name", ""),
            "position": pos,
            "team_name": new.get("team_name", ""),
            "cost": new.get("now_cost", 0) / 10,
            "form": float(new.get("form") or 0),
            "is_starter": pick.get("is_starter", True),
            "is_captain": False,
            "is_vice_captain": False,
            "rationale": (
                f"Auto-deduped from a duplicate {pick.get('player_name', 'pick')}; "
                f"top alternative by form selected."
            ),
        }
        squad[i] = replacement
        squad_ids.add(new["id"])
        seen_ids.add(new["id"])
        current_total = current_total - removed_cost + replacement["cost"]
        team_counts[old_team] = max(team_counts.get(old_team, 0) - 1, 0)
        new_team = new.get("team_name") or ""
        team_counts[new_team] = team_counts.get(new_team, 0) + 1

    return squad


def _repair_team_count(
    squad: List[dict], all_players: List[dict], total_budget: float
) -> List[dict]:
    """Swap excess players (>3 from a team) for top alternatives in the same position."""
    squad = [dict(p) for p in squad]

    for _ in range(10):  # bounded iterations
        team_counts = _count_by(squad, "team_name")
        over = sorted(
            ((t, c) for t, c in team_counts.items() if c > TEAM_COUNT_LIMIT),
            key=lambda x: -x[1],
        )
        if not over:
            break

        offending_team, overflow = over[0]
        team_picks = [p for p in squad if p.get("team_name") == offending_team]
        # Drop the worst-form members of that team first (keep the stars).
        team_picks.sort(key=lambda p: (float(p.get("form") or 0), float(p.get("cost") or 0)))
        n_excess = overflow - TEAM_COUNT_LIMIT

        squad_ids = {p.get("player_id") for p in squad}
        current_total = sum(float(p.get("cost") or 0) for p in squad)

        replaced_any = False
        for excess in team_picks[:n_excess]:
            pos = excess.get("position")
            removed_cost = float(excess.get("cost") or 0)
            available = total_budget - current_total + removed_cost

            candidates = [
                p
                for p in all_players
                if p.get("position") == pos
                and p["id"] not in squad_ids
                and team_counts.get(p.get("team_name") or "", 0) < TEAM_COUNT_LIMIT
                and (p.get("now_cost", 0) / 10) <= available + COST_TOLERANCE
                and p.get("status", "a") == "a"
            ]
            candidates.sort(
                key=lambda p: float(p.get("form") or 0) * float(p.get("points_per_game") or 0),
                reverse=True,
            )
            if not candidates:
                logger.warning(
                    "Repair: no replacement for %s (%s) within £%.1fm.",
                    excess.get("player_name"),
                    pos,
                    available,
                )
                continue

            new = candidates[0]
            replacement = {
                "player_id": new["id"],
                "player_name": new.get("web_name", ""),
                "position": pos,
                "team_name": new.get("team_name", ""),
                "cost": new.get("now_cost", 0) / 10,
                "form": float(new.get("form") or 0),
                "is_starter": excess.get("is_starter", True),
                "is_captain": False,
                "is_vice_captain": False,
                "rationale": (
                    f"Auto-swapped in for {excess.get('player_name', 'an excess pick')} "
                    f"to keep {offending_team} within the 3-per-team limit."
                ),
            }
            idx = next(
                (i for i, p in enumerate(squad) if p.get("player_id") == excess.get("player_id")),
                None,
            )
            if idx is None:
                continue
            squad[idx] = replacement
            squad_ids.discard(excess.get("player_id"))
            squad_ids.add(new["id"])
            current_total = current_total - removed_cost + replacement["cost"]
            team_counts[offending_team] = team_counts.get(offending_team, 0) - 1
            new_team = new.get("team_name") or ""
            team_counts[new_team] = team_counts.get(new_team, 0) + 1
            replaced_any = True

        if not replaced_any:
            logger.warning(
                "Repair stalled with %s=%d; no valid swaps available.",
                offending_team,
                overflow,
            )
            break

    # Reassign captain / vice-captain if the originals were swapped out.
    if not any(p.get("is_captain") for p in squad) or not any(p.get("is_vice_captain") for p in squad):
        starters = sorted(
            (p for p in squad if p.get("is_starter")),
            key=lambda p: (-float(p.get("form") or 0), -float(p.get("cost") or 0)),
        )
        if not any(p.get("is_captain") for p in squad):
            for s in starters:
                if not s.get("is_vice_captain"):
                    s["is_captain"] = True
                    break
        if not any(p.get("is_vice_captain") for p in squad):
            for s in starters:
                if not s.get("is_captain") and not s.get("is_vice_captain"):
                    s["is_vice_captain"] = True
                    break

    return squad


def _filter_transfers_for_team_limit(
    suggestions: List[dict],
    current_team_players: List[dict],
    all_players: List[dict],
) -> List[dict]:
    """Drop transfers that would push any team's count above the 3-per-team limit."""
    players_map = {p["id"]: p for p in all_players}
    base_counts: Dict[int, int] = {}
    for p in current_team_players:
        base_counts[p["team"]] = base_counts.get(p["team"], 0) + 1

    valid: List[dict] = []
    for s in suggestions:
        out_id = s.get("player_out_id")
        in_id = s.get("player_in_id")
        out_player = next((p for p in current_team_players if p["id"] == out_id), None)
        in_player = players_map.get(in_id)
        if not out_player or not in_player:
            valid.append(s)
            continue

        new_counts = dict(base_counts)
        new_counts[out_player["team"]] = new_counts.get(out_player["team"], 0) - 1
        new_counts[in_player["team"]] = new_counts.get(in_player["team"], 0) + 1

        if any(c > TEAM_COUNT_LIMIT for c in new_counts.values()):
            logger.warning(
                "Filtered transfer: %s (%s) would create %d players from %s.",
                in_player.get("web_name"),
                in_player.get("team_name"),
                new_counts[in_player["team"]],
                in_player.get("team_name"),
            )
            continue
        valid.append(s)
    return valid


_mlflow_available = None  # Cache the result so we only check once


def _setup_mlflow():
    """Try to set up MLflow tracking. Non-fatal if server is unavailable."""
    global _mlflow_available
    if _mlflow_available is False:
        return False  # Already checked, server wasn't available

    try:
        # Quick connectivity check before MLflow's slow retry logic kicks in
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex(("localhost", 5000))
        sock.close()
        if result != 0:
            _mlflow_available = False
            logger.info("MLflow server not running on localhost:5000 — skipping tracking.")
            return False

        import mlflow
        mlflow.set_tracking_uri("http://localhost:5000")
        mlflow.set_experiment("FPL Agent")
        mlflow.langchain.autolog()
        _mlflow_available = True
        logger.info("MLflow tracking enabled.")
        return True
    except Exception as e:
        _mlflow_available = False
        logger.warning(f"MLflow setup skipped (server not available): {e}")
        return False


def _build_gameweek_context(state: AgentState) -> str:
    """Build DGW/BGW context string for LLM prompts."""
    gw_intel = state.get("gameweek_intelligence")
    if not gw_intel:
        return ""

    lines = ["\n\nGAMEWEEK INTELLIGENCE (Double & Blank Gameweeks):"]

    details = gw_intel.get("gameweek_details", [])
    has_notable = False
    for gw in details:
        gw_num = gw["gameweek"]
        markers = []
        if gw.get("is_double"):
            markers.append(f"⚠️ DOUBLE GW — Teams with 2 fixtures: {', '.join(gw.get('teams_with_double', []))}")
            has_notable = True
        if gw.get("is_blank"):
            markers.append(f"⚠️ BLANK GW — Teams WITHOUT a fixture: {', '.join(gw.get('teams_with_blank', []))}")
            has_notable = True
        if markers:
            tag = " (CURRENT)" if gw.get("is_current") else (" (NEXT)" if gw.get("is_next") else "")
            lines.append(f"  GW{gw_num}{tag}: {'; '.join(markers)}")

    if not has_notable:
        lines.append("  No Double or Blank Gameweeks detected in the upcoming window.")

    return "\n".join(lines)


def _build_chip_context(state: AgentState) -> str:
    """Build chip availability context string."""
    chip_status = state.get("chip_status")
    if not chip_status:
        return ""

    chip_names = {"wildcard": "Wildcard", "freehit": "Free Hit", "bboost": "Bench Boost", "3xc": "Triple Captain"}
    lines = ["\n\nCHIP AVAILABILITY:"]

    for chip in chip_status.get("chips", []):
        name = chip.get("name", "")
        display = chip_names.get(name, name)
        available = chip.get("is_available", False)
        played = chip.get("played_by_entry")
        status = "✅ Available" if available else f"❌ Used (GW {played})" if played else "❌ Unavailable"
        lines.append(f"  {display}: {status}")

    active = chip_status.get("active_chip")
    if active:
        lines.append(f"  🔴 ACTIVE CHIP THIS GW: {chip_names.get(active, active)}")

    return "\n".join(lines)


async def suggester_node(state: AgentState) -> Dict[str, Any]:
    """
    Use LLM to generate intelligent transfer suggestions or chip-specific advice.

    Args:
        state: Current agent state

    Returns:
        Updated state with transfer suggestions or chip recommendation
    """
    try:
        # Try to enable MLflow (non-fatal if unavailable)
        _setup_mlflow()

        chip_mode = state.get("chip_mode")

        if chip_mode in ("wildcard", "freehit"):
            return await _suggest_full_squad(state, chip_mode)
        elif chip_mode in ("bboost", "3xc"):
            return await _suggest_chip_usage(state, chip_mode)
        else:
            return await _suggest_transfers(state)

    except Exception as e:
        logger.error(f"Suggestion generation failed: {e}")
        return {
            "error": f"Suggestion failed: {str(e)}",
            "step_completed": "suggestion_failed"
        }


async def _suggest_transfers(state: AgentState) -> Dict[str, Any]:
    """Generate standard transfer suggestions (the existing flow, enhanced with chip/GW context)."""
    # Initialize LLM
    llm = ChatOpenAI(
        model=settings.OPENAI_MODEL,
        temperature=0.7,
        api_key=settings.OPENAI_API_KEY
    )

    # Prepare context for LLM
    team_summary = state["team_summary"]
    form_analysis = state["form_analysis"]
    team_weaknesses = state["team_weaknesses"]
    current_team_players = state["current_team_players"]
    all_players = state["all_players"]

    # Build a set of current squad player IDs (includes bench players)
    current_squad_ids = {p["id"] for p in current_team_players}

    budget_available = team_summary["bank"] / 10  # Convert to millions

    # Get underperformers
    underperformers = form_analysis["underperformers"]

    # For each underperformer, find top replacements
    replacement_candidates = {}
    for under in underperformers[:5]:  # Limit to top 5 underperformers
        player = under["player"]
        position = player["position"]
        max_cost = (player["now_cost"] / 10) + budget_available

        candidates = find_top_performers_by_position.invoke({
            "all_players": all_players,
            "position": position,
            "max_cost": max_cost,
            "limit": 15  # Fetch more to compensate for filtering
        })

        # Filter out players already in the current squad
        filtered_candidates = [
            c for c in candidates if c["id"] not in current_squad_ids
        ][:5]

        replacement_candidates[player["web_name"]] = {
            "player_out": player,
            "reasons": under["reasons"],
            "candidates": filtered_candidates
        }

    # Build gameweek & chip context for prompts
    gw_context = _build_gameweek_context(state)
    chip_context = _build_chip_context(state)

    # Build prompt for LLM
    system_prompt = f"""You are an expert Fantasy Premier League (FPL) analyst.
Your job is to analyze a user's team and suggest the best transfer options based on comprehensive FPL strategies:
1. Form vs Fixtures: Balance a player's recent form against upcoming fixture difficulty (FDR). Look for fixture swings.
2. Underlying Stats: Consider xG (Expected Goals), xA (Expected Assists), and xGI (Expected Goal Involvement).
3. Value and Budget: Optimize points per million. Take advantage of price changes but prioritize points over team value.
4. Effective Ownership (EO) & Differentials: Identify highly-owned "essential" players vs low-owned "differentials" with high upside.
5. Structural Logic: Don't just exchange low-value players. Consider downgrading a premium player who is out of form or has bad fixtures to upgrade elsewhere, or capitalizing on a mid-priced player hitting form.
6. Long-Term vs Short-Term: Consider Blank Gameweeks (BGW) and Double Gameweeks (DGW) and team structure.
7. Captaincy: Always evaluate the best captain and vice-captain choices based on explosive potential and fixture. Ensure your transfers align with captaincy plans if relevant.
8. Chip Strategy: Consider the user's available chips when suggesting transfers. If a DGW is approaching and they have Bench Boost available, factor that into squad planning. If they have a Free Hit or Wildcard, mention if saving a transfer is advisable.
{gw_context}
{chip_context}

Provide exactly 5 transfer suggestions, ranked by priority (1=highest, 2=high, 3=medium, 4=low, 5=lowest).

HARD FPL RULES (treat these as absolute):
- MAX 3 PLAYERS FROM ANY SINGLE PREMIER LEAGUE TEAM. Before suggesting `player_in`, check how many of the user's CURRENT SQUAD already play for that club. If they already have 3 from that club and `player_out` is from a different club, the transfer is INVALID — pick a different target.
- Single transfers must be position-for-position (a MID for a MID, a FWD for a FWD, etc.) — overall squad must remain 2/5/5/3.
- Cost change must fit in the bank PLUS the difference between the player's selling price and the new player's purchase price.
- Avoid suggesting players with status != "a" (injured/suspended/unavailable) unless they're nailed-on returners.
- Each transfer beyond the user's free transfer count costs −4 points; weigh the points gain against the hit.

OUTPUT CONSTRAINTS:
- Do not transfer out the SAME player more than 2 times across your 5 suggestions.
- Do NOT suggest transferring IN a player who is already in the CURRENT SQUAD.
- Provide detailed rationale covering the above advanced strategies.
If the user provides feedback, adjust your suggestions accordingly."""

    # Check for user feedback
    feedback_context = ""
    if state.get("feedback"):
        feedback_context = f"""
USER FEEDBACK ON PREVIOUS SUGGESTIONS:
"{state['feedback']}"

PREVIOUS SUGGESTIONS:
{json.dumps(state.get('current_suggestions', []), indent=2, default=str)}

IMPORTANT: If the user asks to replace a SPECIFIC suggestion, keep the other 4 suggestions EXACTLY as they were, and only replace the one they requested with a new alternative. If their feedback is general, provide NEW, DIFFERENT suggestions that address their concerns.
"""

    current_team_summary = [
        {
            "id": p["id"],
            "name": p["web_name"],
            "position": p.get("position", ""),
            "team": p.get("team_name", ""),
            "cost": p["now_cost"] / 10,
            "form": p.get("form", 0)
        } for p in current_team_players
    ]

    user_prompt = f"""
Analyze this FPL team comprehensively and suggest exactly 5 transfer options (1 transfer per option):

TEAM SUMMARY:
- Budget available: £{budget_available}m
- Current gameweek: {state['gameweek']}
- Team value: £{team_summary['team_value_millions']}m

CURRENT SQUAD:
{json.dumps(current_team_summary, indent=2)}

TEAM WEAKNESSES:
{chr(10).join(f"- {w}" for w in team_weaknesses)}

UNDERPERFORMING PLAYERS & REPLACEMENT OPTIONS (You are NOT limited to these. You can transfer ANY player out, including premiums out of form, for structural reasons):
{json.dumps(replacement_candidates, indent=2, default=str)}
{feedback_context}
Please provide exactly 5 transfer suggestions in this JSON format:
{{
  "suggestions": [
    {{
      "player_out_id": <id>,
      "player_out_name": "<name>",
      "player_in_id": <id>,
      "player_in_name": "<name>",
      "priority": 1,
      "expected_points_gain": <float>,
      "rationale": "<detailed explanation of underlying stats, structural benefits, etc.>",
      "form_analysis": "<form comparison>",
      "fixture_analysis": "<fixture comparison>",
      "value_analysis": "<value comparison>",
      "cost_change": <float in millions>,
      "captain_id": <id>,
      "captain_name": "<name of suggested captain based on resulting team>",
      "vice_captain_id": <id>,
      "vice_captain_name": "<name of suggested vice-captain>"
    }}
  ]
}}

Ensure all suggestions are within budget and maintain squad composition rules (max 3 players from a single real-life team).
"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    logger.info("Calling GPT-4o for transfer suggestions...")

    # Call LLM
    response = await llm.ainvoke(messages)
    response_text = response.content

    # Parse JSON response
    try:
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()

        suggestions_data = json.loads(response_text)
        suggestions = suggestions_data.get("suggestions", [])

        # Validate: remove suggestions where player_in is already in the squad
        valid_suggestions = []
        for s in suggestions:
            if s.get("player_in_id") in current_squad_ids:
                logger.warning(
                    f"Filtered out invalid suggestion: {s.get('player_in_name', 'Unknown')} "
                    f"(id={s.get('player_in_id')}) is already in the squad"
                )
            else:
                valid_suggestions.append(s)
        suggestions = valid_suggestions

        # Drop any suggestion that would create >3 players from one team.
        suggestions = _filter_transfers_for_team_limit(
            suggestions, current_team_players, all_players
        )

        # Enhance suggestions with full player data
        for suggestion in suggestions:
            player_out = next(
                (p for p in all_players if p["id"] == suggestion["player_out_id"]),
                None
            )
            player_in = next(
                (p for p in all_players if p["id"] == suggestion["player_in_id"]),
                None
            )

            if player_out and player_in:
                suggestion["player_out"] = player_out
                suggestion["player_in"] = player_in
                suggestion["bank_after"] = budget_available - suggestion["cost_change"]

        logger.info(f"Generated {len(suggestions)} transfer suggestions")

        return {
            "transfer_suggestions": suggestions,
            "step_completed": "suggestion",
            "error": None
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response: {e}")
        logger.error(f"Response: {response_text}")
        return {
            "error": f"Failed to parse suggestions: {str(e)}",
            "step_completed": "suggestion_failed"
        }


async def _suggest_full_squad(state: AgentState, chip: str) -> Dict[str, Any]:
    """Generate a complete 15-man squad suggestion for Wildcard or Free Hit."""
    llm = ChatOpenAI(
        model=settings.OPENAI_MODEL,
        temperature=0.7,
        api_key=settings.OPENAI_API_KEY
    )

    team_summary = state["team_summary"]
    current_team_players = state["current_team_players"]
    all_players = state["all_players"]
    form_analysis = state["form_analysis"]

    total_budget = (team_summary["bank"] + team_summary["value"]) / 10
    gw_context = _build_gameweek_context(state)

    chip_name = "Wildcard" if chip == "wildcard" else "Free Hit"
    chip_specific = ""
    if chip == "wildcard":
        chip_specific = """WILDCARD STRATEGY:
- Build the best possible squad for the LONG TERM (next 5-10 GWs).
- Prioritize fixture swings, upcoming DGWs, and set-and-forget picks.
- Structure the team to need minimal transfers in coming weeks.
- Consider bench value — don't waste money on the bench but ensure viable backup options.
- Think about Double Gameweek targets — load up on players who will play twice."""
    else:
        chip_specific = """FREE HIT STRATEGY:
- Build the best squad for THIS SINGLE GAMEWEEK only.
- Your original team returns next week, so optimize purely for this week.
- Ideal for Blank Gameweeks — target all teams that HAVE a fixture.
- Ideal for Double Gameweeks — target players with TWO fixtures this week.
- Captaincy is critical — pick the most explosive option.
- No need to think about long term; pure short-term optimization."""

    # Build top players per position for context
    top_by_pos = {}
    for pos in ["GKP", "DEF", "MID", "FWD"]:
        candidates = find_top_performers_by_position.invoke({
            "all_players": all_players,
            "position": pos,
            "max_cost": 15.0,  # high cap to get top picks
            "limit": 20
        })
        top_by_pos[pos] = [{"id": c["id"], "name": c["web_name"], "team": c.get("team_name", ""), "cost": c["now_cost"] / 10, "form": c.get("form", 0), "ppg": c.get("points_per_game", 0), "xGI": c.get("expected_goal_involvements", 0)} for c in candidates]

    current_team_summary = [
        {"id": p["id"], "name": p["web_name"], "position": p.get("position", ""), "team": p.get("team_name", ""), "cost": p["now_cost"] / 10, "form": p.get("form", 0)}
        for p in current_team_players
    ]

    system_prompt = f"""You are an expert FPL analyst helping a manager play their {chip_name} chip.
{chip_specific}
{gw_context}

HARD FPL SQUAD RULES (these are NON-NEGOTIABLE — squads breaking them are invalid):
- Exactly 15 UNIQUE players: 2 GKP, 5 DEF, 5 MID, 3 FWD. Never list the same player twice (no duplicate player_id and no duplicate name across starters and bench).
- MAX 3 PLAYERS FROM ANY SINGLE PREMIER LEAGUE TEAM. Before finalising, count how many you have from each club; if any club has 4+, drop the weakest one and pick from a different club.
- Use the EXACT player_id and team_name from the provided lists — do not invent IDs or mislabel a player's club.
- Total squad cost ≤ available budget. Bench fodder should typically be cheap (£4.0–£4.5m DEF/MID, £4.0m GKP).
- Starting XI = exactly 11: 1 GKP, then a valid formation in DEF (3-5), MID (2-5), FWD (1-3). The other 4 are subs.
- Captain (2× points) and vice-captain must be DIFFERENT players, both in the starting XI.
- Avoid players with status != "a" (injured/suspended/unavailable) unless they're nailed-on returners.

CAPTAIN/SUB MECHANICS:
- Vice-captain only triggers if captain doesn't play any minutes.
- Bench order matters: GKP sub is fixed; outfield subs slot in by listed order if a starter blanks (and only if formation rules still hold)."""

    user_prompt = f"""
Build the optimal {chip_name} squad:

BUDGET: £{total_budget:.1f}m total
CURRENT GAMEWEEK: {state['gameweek']}

CURRENT SQUAD (for reference):
{json.dumps(current_team_summary, indent=2)}

TOP AVAILABLE PLAYERS BY POSITION:
{json.dumps(top_by_pos, indent=2, default=str)}

Please provide the full 15-man squad in this JSON format:
{{
  "chip": "{chip}",
  "display_name": "{chip_name}",
  "should_play": true,
  "confidence": "High",
  "reasoning": "<why this is a good week to play {chip_name}>",
  "best_gameweek": {state['gameweek']},
  "total_cost": <total cost in millions>,
  "bank_remaining": <remaining budget>,
  "squad": [
    {{
      "player_id": <id>,
      "player_name": "<name>",
      "position": "<GKP|DEF|MID|FWD>",
      "team_name": "<team>",
      "cost": <float in millions>,
      "form": <float>,
      "is_starter": true,
      "is_captain": false,
      "is_vice_captain": false,
      "rationale": "<why this player>"
    }}
  ]
}}

FINAL SELF-CHECK before responding:
1. Count players per club. If ANY club has more than 3, replace the weakest until every club has ≤3.
2. Confirm the position split is exactly 2/5/5/3.
3. Confirm total cost ≤ £{total_budget:.1f}m.
4. Confirm 11 starters, 4 bench, 1 captain, 1 vice-captain (both in the starting XI, different players).
Only return the JSON after all four checks pass."""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    logger.info(f"Calling GPT-4o for {chip_name} squad suggestion...")
    response = await llm.ainvoke(messages)
    response_text = response.content

    try:
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()

        recommendation = json.loads(response_text)
        recommendation["chip_name"] = chip
        recommendation["display_name"] = chip_name

        squad = recommendation.get("squad") or []

        # Stamp authoritative team_name + cost from FPL data so a hallucinated
        # team_name doesn't smuggle a 4th-from-team-X past the validator.
        players_by_id = {p["id"]: p for p in all_players}
        for pick in squad:
            ref = players_by_id.get(pick.get("player_id"))
            if ref:
                pick["team_name"] = ref.get("team_name") or pick.get("team_name", "")
                pick["position"] = ref.get("position") or pick.get("position", "")
                pick["cost"] = ref.get("now_cost", 0) / 10

        # First, replace any duplicate picks with alternatives in the same position.
        ids = [p.get("player_id") for p in squad]
        if len(set(ids)) != len(ids):
            dup_ids = [pid for pid in set(ids) if ids.count(pid) > 1]
            logger.warning(
                "%s squad has duplicate picks for player_ids=%s. Deduping.",
                chip_name,
                dup_ids,
            )
            squad = _dedupe_squad(squad, all_players, total_budget)
            recommendation["squad"] = squad

        # Then enforce the 3-per-team rule.
        team_counts = _count_by(squad, "team_name")
        if any(c > TEAM_COUNT_LIMIT for c in team_counts.values()):
            offenders = {t: c for t, c in team_counts.items() if c > TEAM_COUNT_LIMIT}
            logger.warning(
                "%s squad violates 3-per-team rule: %s. Repairing programmatically.",
                chip_name,
                offenders,
            )
            squad = _repair_team_count(squad, all_players, total_budget)
            recommendation["squad"] = squad

        # Recompute cost totals after any repair / cost normalization.
        total_cost = sum(float(p.get("cost") or 0) for p in squad)
        recommendation["total_cost"] = round(total_cost, 1)
        recommendation["bank_remaining"] = round(total_budget - total_cost, 1)

        # Final pass — surface anything we couldn't auto-fix.
        violations = _validate_full_squad(squad, total_budget)
        if violations:
            logger.warning("%s squad has unresolved violations: %s", chip_name, violations)
            recommendation["validation_warnings"] = violations

        logger.info(
            "Generated %s squad with %d players (warnings=%d).",
            chip_name,
            len(squad),
            len(violations),
        )

        return {
            "chip_recommendation": recommendation,
            "transfer_suggestions": [],
            "step_completed": "suggestion",
            "error": None
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse {chip_name} LLM response: {e}")
        return {
            "error": f"Failed to parse {chip_name} suggestion: {str(e)}",
            "step_completed": "suggestion_failed"
        }


async def _suggest_chip_usage(state: AgentState, chip: str) -> Dict[str, Any]:
    """Generate a recommendation on whether to use Bench Boost or Triple Captain."""
    llm = ChatOpenAI(
        model=settings.OPENAI_MODEL,
        temperature=0.7,
        api_key=settings.OPENAI_API_KEY
    )

    team_summary = state["team_summary"]
    current_team_players = state["current_team_players"]
    current_team_picks = state["current_team_picks"]
    form_analysis = state["form_analysis"]

    chip_name = "Bench Boost" if chip == "bboost" else "Triple Captain"
    gw_context = _build_gameweek_context(state)

    chip_specific = ""
    if chip == "bboost":
        chip_specific = """BENCH BOOST ANALYSIS:
- Bench Boost scores points for ALL 15 players instead of just 11.
- Best used in a Double Gameweek when bench players also have 2 fixtures.
- Evaluate the QUALITY of the manager's current bench:
  - Are bench players nailed starters for their real-life teams?
  - Do they have good fixtures this GW?
  - Are any injured/doubtful?
- If the bench is weak, recommend AGAINST using it now and suggest upgrading the bench first.
- Consider if better DGWs are coming where BB would be more valuable."""
    else:
        chip_specific = """TRIPLE CAPTAIN ANALYSIS:
- Triple Captain gives 3x points for the captain instead of 2x.
- Best used on a premium player in a Double Gameweek (2 fixtures = more point potential).
- Evaluate who the best captain choice would be:
  - Form, fixture difficulty, explosiveness, fixture count
  - Historical performance in DGWs
- If no clear DGW opportunity exists, recommend saving it.
- Consider upcoming DGWs where a premium asset might have 2 easy fixtures."""

    # Build bench info for BB analysis
    bench_info = []
    starters_info = []
    picks_map = {p["element"]: p for p in current_team_picks}
    for player in current_team_players:
        pick = picks_map.get(player["id"], {})
        entry = {
            "name": player["web_name"],
            "position": player.get("position", ""),
            "team": player.get("team_name", ""),
            "form": player.get("form", 0),
            "ppg": player.get("points_per_game", 0),
            "status": player.get("status", "a"),
            "news": player.get("news", ""),
            "cost": player["now_cost"] / 10,
            "is_starter": pick.get("position", 12) <= 11,
            "is_captain": pick.get("is_captain", False),
        }
        if entry["is_starter"]:
            starters_info.append(entry)
        else:
            bench_info.append(entry)

    system_prompt = f"""You are an expert FPL analyst advising on chip strategy.
{chip_specific}
{gw_context}

Provide a clear YES or NO recommendation with detailed reasoning."""

    user_prompt = f"""
Should the manager use {chip_name} in GW{state['gameweek']}?

CURRENT GAMEWEEK: {state['gameweek']}
TEAM VALUE: £{team_summary['team_value_millions']}m

STARTING XI:
{json.dumps(starters_info, indent=2, default=str)}

BENCH PLAYERS:
{json.dumps(bench_info, indent=2, default=str)}

Please respond in this JSON format:
{{
  "chip_name": "{chip}",
  "display_name": "{chip_name}",
  "should_play": <true or false>,
  "confidence": "<High|Medium|Low>",
  "reasoning": "<detailed multi-sentence analysis>",
  "best_gameweek": <the GW number where this chip would be best used, or null>,
  "squad": null,
  "total_cost": null,
  "bank_remaining": null
}}"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
    ]

    logger.info(f"Calling GPT-4o for {chip_name} advice...")
    response = await llm.ainvoke(messages)
    response_text = response.content

    try:
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()

        recommendation = json.loads(response_text)

        logger.info(f"{chip_name} recommendation: should_play={recommendation.get('should_play')}")

        return {
            "chip_recommendation": recommendation,
            "transfer_suggestions": [],
            "step_completed": "suggestion",
            "error": None
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse {chip_name} LLM response: {e}")
        return {
            "error": f"Failed to parse {chip_name} advice: {str(e)}",
            "step_completed": "suggestion_failed"
        }
