"""
Data fetcher node for LangGraph agent.
"""
from typing import Dict, Any
from ...services.fpl_client import FPLClient
from ..state import AgentState
import logging

logger = logging.getLogger(__name__)


def _to_dict(obj):
    """Convert pydantic model to dict; pass through dicts and None unchanged."""
    if obj is None:
        return None
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict") and callable(obj.dict):
        return obj.dict()
    return obj


async def data_fetcher_node(state: AgentState) -> Dict[str, Any]:
    """
    Fetch all necessary data from FPL API, including chip status and gameweek intelligence.

    Args:
        state: Current agent state

    Returns:
        Updated state with fetched data
    """
    manager_id = state["manager_id"]
    fpl_cookie = state["fpl_cookie"]
    fpl_access_token = state.get("fpl_access_token")

    try:
        client = FPLClient(cookie=fpl_cookie, access_token=fpl_access_token)

        logger.info(f"Fetching data for manager {manager_id}")

        # Fetch all data
        all_players = await client.get_all_players()
        teams = await client.get_teams()
        current_gameweek = await client.get_current_gameweek()
        team_summary = await client.get_team_summary(manager_id)
        # Prefer the live squad from /my-team/ — after a Free Hit, the historical
        # /event/{gw}/picks/ endpoint permanently shows the FH squad for that GW.
        try:
            my_team = await client.get_my_team(manager_id)
            team_picks = my_team.picks
            transfers_info = my_team.transfers or {}
        except Exception as e:
            # A 403 here means the SSO access token is missing or expired —
            # worth calling out, since re-login fixes it and nothing else will.
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (401, 403):
                logger.warning(
                    "my-team returned %s — the FPL access token looks expired or "
                    "missing; falling back to historical picks. Re-run the login "
                    "flow to restore live squad data.", status
                )
            else:
                logger.warning(f"Could not fetch live my-team, falling back to historical picks: {e}")

            # Note: NOT current_gameweek. That's the GW we're planning transfers
            # for, and its picks endpoint 404s until the deadline passes.
            team_picks = await client.get_latest_team_picks(manager_id)
            # Without my-team we cannot know the free-transfer count; say so
            # rather than implying the transfer is free.
            transfers_info = {"error": str(e) or "my-team unavailable"}

        # Fetch chip status and gameweek intelligence
        chip_status = None
        gameweek_intelligence = None
        try:
            chip_status = await client.get_chip_status(manager_id)
            logger.info(f"Chip status: available={chip_status.available_chips}, active={chip_status.active_chip}")
        except Exception as e:
            logger.warning(f"Could not fetch chip status: {e}")

        try:
            gameweek_intelligence = await client.get_gameweek_intelligence()
            logger.info(
                f"GW Intelligence: doubles={gameweek_intelligence.upcoming_doubles}, "
                f"blanks={gameweek_intelligence.upcoming_blanks}"
            )
        except Exception as e:
            logger.warning(f"Could not fetch gameweek intelligence: {e}")

        # Get full player data for current team
        player_ids = [pick.element for pick in team_picks]
        current_team_players = [p for p in all_players if p.id in player_ids]

        # Get fixtures for next 5 gameweeks
        fixtures = []
        for gw in range(current_gameweek, min(current_gameweek + 6, 39)):
            gw_fixtures = await client.get_fixtures(gw)
            fixtures.extend(gw_fixtures)

        logger.info(f"Fetched {len(all_players)} players, {len(fixtures)} fixtures")

        return {
            "all_players": [_to_dict(p) for p in all_players],
            "teams": [_to_dict(t) for t in teams],
            "current_team_picks": [_to_dict(p) for p in team_picks],
            "current_team_players": [_to_dict(p) for p in current_team_players],
            "fixtures": [_to_dict(f) for f in fixtures],
            "team_summary": _to_dict(team_summary),
            "transfers_info": transfers_info,
            "gameweek": current_gameweek,
            "chip_status": _to_dict(chip_status),
            "gameweek_intelligence": _to_dict(gameweek_intelligence),
            "step_completed": "data_fetch",
            "error": None
        }

    except Exception as e:
        logger.error(f"Data fetching failed: {e}")
        return {
            "error": f"Failed to fetch data: {str(e)}",
            "step_completed": "data_fetch_failed"
        }
