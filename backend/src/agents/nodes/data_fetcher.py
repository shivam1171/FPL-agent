"""
Data fetcher node for LangGraph agent.
"""
from typing import Dict, Any
from ...services.fpl_client import FPLClient
from ..state import AgentState
import logging

logger = logging.getLogger(__name__)


async def data_fetcher_node(state: AgentState) -> Dict[str, Any]:
    """
    Fetch all necessary data from FPL API.

    Args:
        state: Current agent state

    Returns:
        Updated state with fetched data
    """
    manager_id = state["manager_id"]
    fpl_cookie = state["fpl_cookie"]

    try:
        client = FPLClient(cookie=fpl_cookie)

        logger.info(f"Fetching data for manager {manager_id}")

        # Fetch all data in parallel would be ideal, but for simplicity we'll do sequential
        all_players = await client.get_all_players()
        teams = await client.get_teams()
        current_gameweek = await client.get_current_gameweek()
        team_summary = await client.get_team_summary(manager_id)
        team_picks = await client.get_team_picks(manager_id, current_gameweek)

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
            "all_players": [p.model_dump() for p in all_players],
            "teams": [t.model_dump() for t in teams],
            "current_team_picks": [p.model_dump() for p in team_picks],
            "current_team_players": [p.model_dump() for p in current_team_players],
            "fixtures": [f.model_dump() for f in fixtures],
            "team_summary": team_summary.model_dump(),
            "gameweek": current_gameweek,
            "step_completed": "data_fetch",
            "error": None
        }

    except Exception as e:
        logger.error(f"Data fetching failed: {e}")
        return {
            "error": f"Failed to fetch data: {str(e)}",
            "step_completed": "data_fetch_failed"
        }
