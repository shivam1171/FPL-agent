"""
Chat endpoint for conversational AI assistant.
Handles general FPL questions without generating new transfer suggestions.
"""
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from ..config import settings
from ..services.fpl_client import FPLClient
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    """Chat message request."""
    manager_id: int
    message: str
    context: Optional[Dict[str, Any]] = None  # team data, suggestions, etc.


class ChatResponse(BaseModel):
    """Chat response."""
    success: bool
    reply: str
    is_suggestion_request: bool = False  # True if user wants new suggestions


@router.post("/message", response_model=ChatResponse)
async def chat_message(
    request: ChatRequest,
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie"),
    fpl_access_token: Optional[str] = Header(None, alias="X-FPL-Access-Token"),
):
    """
    Process a chat message and return an AI-generated response.
    Can answer questions about FPL, the user's team, strategy, etc.
    If the user is asking for new/updated suggestions, flags is_suggestion_request=True.
    """
    try:
        if not fpl_cookie:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="FPL cookie required"
            )

        logger.info(f"Chat message from manager {request.manager_id}: {request.message[:80]}...")

        # Fetch team data for context
        client = FPLClient(cookie=fpl_cookie, access_token=fpl_access_token)
        team_context = ""
        
        try:
            current_gw = await client.get_current_gameweek()
            team_summary = await client.get_team_summary(request.manager_id)
            try:
                my_team = await client.get_my_team(request.manager_id)
                team_picks = my_team.picks
            except Exception as e:
                logger.warning(f"Falling back to historical picks for chat: {e}")
                team_picks = await client.get_team_picks(request.manager_id, current_gw)
            all_players = await client.get_all_players()
            players_map = {p.id: p for p in all_players}

            # Build compact team context
            team_players = []
            for pick in team_picks:
                player = players_map.get(pick.element)
                if player:
                    team_players.append({
                        "name": player.web_name,
                        "position": player.position,
                        "team": player.team_name,
                        "form": player.form,
                        "points": player.total_points,
                        "ppg": player.points_per_game,
                        "cost": player.now_cost / 10,
                        "ownership": player.selected_by_percent,
                        "status": player.status,
                        "news": player.news,
                        "is_starter": pick.position <= 11,
                        "is_captain": pick.is_captain,
                        "is_vice_captain": pick.is_vice_captain,
                        "xG": player.expected_goals,
                        "xA": player.expected_assists,
                    })

            # Fetch chip and GW intelligence
            chip_context = ""
            gw_intel_context = ""
            try:
                chip_status = await client.get_chip_status(request.manager_id)
                chip_names = {"wildcard": "Wildcard", "freehit": "Free Hit", "bboost": "Bench Boost", "3xc": "Triple Captain"}
                chip_lines = []
                for chip in chip_status.chips:
                    display = chip_names.get(chip.name, chip.name)
                    avail = "✅ Available" if chip.is_available else "❌ Used"
                    chip_lines.append(f"  {display}: {avail}")
                if chip_lines:
                    chip_context = "\nChip Status:\n" + "\n".join(chip_lines)
            except Exception:
                pass

            try:
                gw_intel = await client.get_gameweek_intelligence()
                gw_lines = []
                for gw in gw_intel.gameweek_details:
                    markers = []
                    if gw.is_double:
                        markers.append(f"DGW — doubles: {', '.join(gw.teams_with_double)}")
                    if gw.is_blank:
                        markers.append(f"BGW — blanks: {', '.join(gw.teams_with_blank)}")
                    if markers:
                        tag = " (CURRENT)" if gw.is_current else ""
                        gw_lines.append(f"  GW{gw.gameweek}{tag}: {'; '.join(markers)}")
                if gw_lines:
                    gw_intel_context = "\nGameweek Intelligence:\n" + "\n".join(gw_lines)
            except Exception:
                pass

            team_context = f"""
Current Gameweek: {current_gw}
Team Summary:
- Total Points: {team_summary.total_points}
- Overall Rank: {team_summary.rank}
- Team Value: £{team_summary.team_value_millions}m
- Bank: £{team_summary.bank_millions}m
- GW Transfers Used: {team_summary.event_transfers}

Squad:
{json.dumps(team_players, indent=1, default=str)}
{chip_context}
{gw_intel_context}
"""
        except Exception as e:
            logger.warning(f"Could not fetch full team context: {e}")
            team_context = "Team data not fully available."

        # Include any additional context (like current suggestions)
        suggestions_context = ""
        if request.context and request.context.get("suggestions"):
            suggestions_context = f"\nCurrent Transfer Suggestions:\n{json.dumps(request.context['suggestions'], indent=1, default=str)}"

        watchlist_context = ""
        if request.context and request.context.get("watchlist"):
            watchlist_context = f"\nWatchlist Players:\n{json.dumps(request.context['watchlist'], indent=1, default=str)}"

        # Create LLM
        llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.7,
            max_completion_tokens=1000,
        )

        system_prompt = f"""You are an expert Fantasy Premier League (FPL) assistant. You have deep knowledge about FPL strategy, player form, fixtures, and team management.

You are chatting with a manager. Answer their questions thoughtfully and provide detailed, actionable FPL advice. Use the team data provided to give personalized answers.

IMPORTANT RULES:
1. If the user is asking a QUESTION (about their team, a player, strategy, FPL rules, etc.), answer it directly. DO NOT generate transfer suggestions.
2. If the user explicitly asks for NEW transfer suggestions, updated suggestions, or replacement players, respond with EXACTLY this text at the very start of your reply: "[NEEDS_SUGGESTIONS]" — the system will then trigger the suggestion engine.
3. Be conversational, friendly, and knowledgeable. Use emoji occasionally.
4. Reference specific players from their squad when relevant.
5. When discussing strategy, consider GW deadlines, chip strategy, differential picks, and fixture difficulty.
6. Keep responses concise but comprehensive — aim for 2-4 paragraphs.
7. CHIP STRATEGY EXPERTISE: You have full knowledge of all FPL chips:
   - **Wildcard**: Unlimited free transfers for one GW. Best used during fixture swings or to restructure the squad.
   - **Free Hit**: Temporary unlimited transfers for one GW only (squad reverts next GW). Ideal for BGWs or DGWs.
   - **Bench Boost**: All 15 players score points. Best in DGWs when bench players also have double fixtures.
   - **Triple Captain**: Captain scores 3x instead of 2x. Best on premium players in DGWs.
8. DGW/BGW AWARENESS: Use the gameweek intelligence data to inform your advice about upcoming double and blank gameweeks.

{team_context}
{suggestions_context}
{watchlist_context}
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.message),
        ]

        # Call LLM
        response = await llm.ainvoke(messages)
        reply = response.content.strip()

        # Check if the LLM flagged this as needing new suggestions
        is_suggestion_request = reply.startswith("[NEEDS_SUGGESTIONS]")
        if is_suggestion_request:
            reply = reply.replace("[NEEDS_SUGGESTIONS]", "").strip()

        logger.info(f"Chat reply generated (suggestion_request={is_suggestion_request})")

        return ChatResponse(
            success=True,
            reply=reply,
            is_suggestion_request=is_suggestion_request,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {str(e)}"
        )
