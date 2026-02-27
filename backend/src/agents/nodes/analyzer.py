"""
Analyzer node for evaluating player performance and fixtures.
"""
from typing import Dict, Any, List
from ..state import AgentState
from ..tools.fpl_tools import (
    calculate_fixture_difficulty,
    get_player_form_score,
    analyze_value,
    find_underperformers
)
import logging

logger = logging.getLogger(__name__)


async def analyzer_node(state: AgentState) -> Dict[str, Any]:
    """
    Analyze current team performance, form, fixtures, and value.

    Args:
        state: Current agent state

    Returns:
        Updated state with analysis results
    """
    try:
        current_team_players = state["current_team_players"]
        all_players = state["all_players"]
        fixtures = state["fixtures"]

        # Analyze each player in current team
        player_analyses = []

        for player in current_team_players:
            # Form analysis
            form_result = get_player_form_score.invoke({
                "player": player,
                "all_players": all_players
            })

            # Fixture difficulty
            fixture_result = calculate_fixture_difficulty.invoke({
                "player_team_id": player["team"],
                "fixtures": fixtures,
                "next_n_games": 5
            })

            # Value analysis
            value_result = analyze_value.invoke({"player": player})

            player_analyses.append({
                "player_id": player["id"],
                "name": player["web_name"],
                "position": player["position"],
                "form": form_result,
                "fixtures": fixture_result,
                "value": value_result
            })

        # Find underperforming players
        underperformers = find_underperformers.invoke({
            "team_players": current_team_players,
            "threshold_form": 3.0
        })

        # Identify team weaknesses
        weaknesses = []
        if len(underperformers) > 0:
            weaknesses.append(f"{len(underperformers)} players with poor form or injuries")

        # Check for players with hard fixtures
        hard_fixtures = [p for p in player_analyses if p["fixtures"]["rating"] == "Hard"]
        if len(hard_fixtures) >= 3:
            weaknesses.append(f"{len(hard_fixtures)} players facing difficult fixtures")

        # Check for poor value players
        poor_value = [p for p in player_analyses if p["value"]["value_rating"] in ["Poor", "Average"]]
        if len(poor_value) >= 4:
            weaknesses.append(f"{len(poor_value)} players with poor value for money")

        logger.info(f"Analysis complete. Found {len(underperformers)} underperformers, {len(weaknesses)} weaknesses")

        return {
            "form_analysis": {
                "player_analyses": player_analyses,
                "underperformers": underperformers
            },
            "fixture_analysis": {
                "hard_fixtures": len(hard_fixtures),
                "easy_fixtures": len([p for p in player_analyses if p["fixtures"]["rating"] == "Easy"])
            },
            "value_analysis": {
                "poor_value_count": len(poor_value),
                "avg_points_per_million": sum(p["value"]["points_per_million"] for p in player_analyses) / len(player_analyses)
            },
            "team_weaknesses": weaknesses,
            "step_completed": "analysis",
            "error": None
        }

    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return {
            "error": f"Analysis failed: {str(e)}",
            "step_completed": "analysis_failed"
        }
