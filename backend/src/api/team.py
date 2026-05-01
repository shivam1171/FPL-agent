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
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie"),
    fpl_access_token: Optional[str] = Header(None, alias="X-FPL-Access-Token"),
):
    """
    Get user's current team composition.

    Args:
        manager_id: FPL manager ID
        fpl_cookie: FPL authentication cookie (from header)
        fpl_access_token: OAuth access token; required for /api/my-team/

    Returns:
        Team data with players and summary
    """
    try:
        if not fpl_cookie:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="FPL cookie required in X-FPL-Cookie header"
            )

        client = FPLClient(cookie=fpl_cookie, access_token=fpl_access_token)

        # Get team summary
        team_summary = await client.get_team_summary(manager_id)

        # Get current gameweek
        current_gw = await client.get_current_gameweek()

        # Prefer live picks from /my-team/ (post-chip restoration);
        # fall back to historical /event/{gw}/picks/ if my-team is unavailable.
        team_picks = None
        transfers_info = {}
        try:
            my_team = await client.get_my_team(manager_id)
            team_picks = my_team.picks
            transfers_info = my_team.transfers
        except Exception as e:
            if hasattr(e, 'response'):
                logger.warning(f"Could not fetch my-team data: {e}. BODY: {e.response.text}")
                status_code = e.response.status_code
                transfers_info = {"error": f"API Error {status_code}"}
            else:
                logger.warning(f"Could not fetch my-team data: {e}")
                transfers_info = {"error": str(e) or "Failed to fetch"}

        if team_picks is None:
            # /event/{gw}/picks/ only returns data once the GW has locked, so for
            # other managers (or before lockout) we may need to walk back to the
            # most recent gameweek with available picks.
            picks_gw = current_gw
            for attempt_gw in range(current_gw, 0, -1):
                try:
                    team_picks = await client.get_team_picks(manager_id, attempt_gw)
                    picks_gw = attempt_gw
                    if attempt_gw != current_gw:
                        logger.info(
                            "Picks for GW%d not available; using GW%d for manager %d.",
                            current_gw,
                            attempt_gw,
                            manager_id,
                        )
                    break
                except Exception as e:
                    status_code = getattr(getattr(e, "response", None), "status_code", None)
                    if status_code == 404:
                        continue
                    raise
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No published picks found for this manager.",
                )

        # Get all players to map full data
        all_players = await client.get_all_players()
        players_map = {p.id: p for p in all_players}

        # Fetch chip status and gameweek intelligence (best-effort).
        # chip_status requires my-team and only works for the authenticated user.
        chip_status = None
        gw_intel = None
        try:
            chip_status = await client.get_chip_status(manager_id)
        except Exception as e:
            logger.debug(f"Skipping chip_status (not the authenticated manager?): {e}")
        try:
            gw_intel = await client.get_gameweek_intelligence()
        except Exception as e:
            logger.warning(f"Could not fetch gw intel: {e}")

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
            "players": team_players,
            "transfers": transfers_info,
            "chip_status": chip_status.model_dump() if hasattr(chip_status, "model_dump") else chip_status,
            "gameweek_intelligence": gw_intel.model_dump() if hasattr(gw_intel, "model_dump") else gw_intel
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
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie"),
    fpl_access_token: Optional[str] = Header(None, alias="X-FPL-Access-Token"),
):
    """
    Get team picks for a specific gameweek.

    Args:
        manager_id: FPL manager ID
        gameweek: Gameweek number
        fpl_cookie: FPL authentication cookie
        fpl_access_token: OAuth access token

    Returns:
        Team picks for the gameweek
    """
    try:
        if not fpl_cookie:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="FPL cookie required"
            )

        client = FPLClient(cookie=fpl_cookie, access_token=fpl_access_token)
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
