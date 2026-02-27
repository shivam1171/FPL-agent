"""
Team data endpoints for FPL Agent.
"""
from fastapi import APIRouter, HTTPException, Header, status
from typing import Optional
from ..services.fpl_client import FPLClient
from ..models.player import Player, UserTeam, TeamSummary
from ..models.fixture import Fixture
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{manager_id}")
async def get_team(
    manager_id: int,
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie")
):
    """
    Get user's current team composition.

    Args:
        manager_id: FPL manager ID
        fpl_cookie: FPL authentication cookie (from header)

    Returns:
        Team data with players and summary
    """
    try:
        if not fpl_cookie:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="FPL cookie required in X-FPL-Cookie header"
            )

        client = FPLClient(cookie=fpl_cookie)

        # Get team summary
        team_summary = await client.get_team_summary(manager_id)

        # Get current gameweek
        current_gw = await client.get_current_gameweek()

        # Get team picks
        team_picks = await client.get_team_picks(manager_id, current_gw)

        # Get all players to map full data
        all_players = await client.get_all_players()
        players_map = {p.id: p for p in all_players}

        # Build team with full player data
        team_players = []
        for pick in team_picks:
            player = players_map.get(pick.element)
            if player:
                team_players.append({
                    "player": player.model_dump(),
                    "pick": pick.model_dump()
                })

        return {
            "summary": team_summary.model_dump(),
            "gameweek": current_gw,
            "players": team_players
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch team: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch team: {str(e)}"
        )


@router.get("/{manager_id}/picks/{gameweek}")
async def get_team_picks(
    manager_id: int,
    gameweek: int,
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie")
):
    """
    Get team picks for a specific gameweek.

    Args:
        manager_id: FPL manager ID
        gameweek: Gameweek number
        fpl_cookie: FPL authentication cookie

    Returns:
        Team picks for the gameweek
    """
    try:
        if not fpl_cookie:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="FPL cookie required"
            )

        client = FPLClient(cookie=fpl_cookie)
        picks = await client.get_team_picks(manager_id, gameweek)

        return {
            "gameweek": gameweek,
            "picks": [p.model_dump() for p in picks]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch picks: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch picks: {str(e)}"
        )
