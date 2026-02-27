"""
Suggester node that uses GPT-4o to generate transfer recommendations.
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


async def suggester_node(state: AgentState) -> Dict[str, Any]:
    """
    Use LLM to generate intelligent transfer suggestions.

    Args:
        state: Current agent state

    Returns:
        Updated state with transfer suggestions
    """
    try:
        # Try to enable MLflow (non-fatal if unavailable)
        _setup_mlflow()

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

        # Build prompt for LLM
        system_prompt = """You are an expert Fantasy Premier League (FPL) analyst.
Your job is to analyze a user's team and suggest the best transfer options based on comprehensive FPL strategies:
1. Form vs Fixtures: Balance a player's recent form against upcoming fixture difficulty (FDR). Look for fixture swings.
2. Underlying Stats: Consider xG (Expected Goals), xA (Expected Assists), and xGI (Expected Goal Involvement).
3. Value and Budget: Optimize points per million. Take advantage of price changes but prioritize points over team value.
4. Effective Ownership (EO) & Differentials: Identify highly-owned "essential" players vs low-owned "differentials" with high upside.
5. Structural Logic: Don't just exchange low-value players. Consider downgrading a premium player who is out of form or has bad fixtures to upgrade elsewhere, or capitalizing on a mid-priced player hitting form.
6. Long-Term vs Short-Term: Consider Blank Gameweeks (BGW) and Double Gameweeks (DGW) and team structure.
7. Captaincy: Always evaluate the best captain and vice-captain choices based on explosive potential and fixture. Ensure your transfers align with captaincy plans if relevant.

Provide exactly 5 transfer suggestions, ranked by priority (1=highest, 2=high, 3=medium, 4=low, 5=lowest).
IMPORTANT CONSTRAINT 1: Do not suggest transferring out the SAME player more than 2 times across your 5 suggestions to ensure variety.
IMPORTANT CONSTRAINT 2: DO NOT suggest transferring IN a player who is already in the CURRENT SQUAD.
For each suggestion, provide detailed rationale covering the above advanced strategies.
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

    except Exception as e:
        logger.error(f"Suggestion generation failed: {e}")
        return {
            "error": f"Suggestion failed: {str(e)}",
            "step_completed": "suggestion_failed"
        }
