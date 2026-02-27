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
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie")
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
        client = FPLClient(cookie=fpl_cookie)
        team_context = ""
        
        try:
            current_gw = await client.get_current_gameweek()
            team_summary = await client.get_team_summary(request.manager_id)
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
