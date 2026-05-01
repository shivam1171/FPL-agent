"""
LangGraph state machine for FPL transfer suggestions.
"""
from typing import Optional, List
from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes.data_fetcher import data_fetcher_node
from .nodes.analyzer import analyzer_node
from .nodes.suggester import suggester_node
import logging

logger = logging.getLogger(__name__)


def create_suggestion_graph():
    """
    Create the LangGraph workflow for generating transfer suggestions.

    Workflow:
        START → DataFetcher → Analyzer → Suggester → END

    Returns:
        Compiled graph
    """
    # Create graph
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("fetch_data", data_fetcher_node)
    workflow.add_node("analyze", analyzer_node)
    workflow.add_node("suggest", suggester_node)

    # Define edges
    workflow.set_entry_point("fetch_data")
    workflow.add_edge("fetch_data", "analyze")
    workflow.add_edge("analyze", "suggest")
    workflow.add_edge("suggest", END)

    # Compile graph
    return workflow.compile()


async def run_suggestion_workflow(
    manager_id: int,
    fpl_cookie: str,
    fpl_access_token: Optional[str] = None,
    feedback: Optional[str] = None,
    current_suggestions: Optional[List[dict]] = None,
    chip_mode: Optional[str] = None
) -> dict:
    """
    Run the complete transfer suggestion workflow.

    Args:
        manager_id: FPL manager ID
        fpl_cookie: FPL authentication cookie
        fpl_access_token: OAuth access token (required for /api/my-team/)
        feedback: Optional user feedback on previous suggestions
        current_suggestions: Optional list of previous suggestions
        chip_mode: Optional chip to analyze ("wildcard", "freehit", "bboost", "3xc")

    Returns:
        Dictionary with transfer suggestions or chip recommendation
    """
    try:
        # Initialize state
        initial_state = {
            "manager_id": manager_id,
            "gameweek": 0,
            "fpl_cookie": fpl_cookie,
            "fpl_access_token": fpl_access_token,
            "chip_mode": chip_mode,
            "feedback": feedback,
            "current_suggestions": current_suggestions,
            "current_team_picks": None,
            "current_team_players": None,
            "all_players": None,
            "fixtures": None,
            "teams": None,
            "team_summary": None,
            "chip_status": None,
            "gameweek_intelligence": None,
            "form_analysis": None,
            "fixture_analysis": None,
            "value_analysis": None,
            "team_weaknesses": None,
            "transfer_suggestions": [],
            "chip_recommendation": None,
            "error": None,
            "step_completed": "init"
        }

        # Create and run graph
        graph = create_suggestion_graph()
        logger.info(f"Starting suggestion workflow for manager {manager_id} (chip_mode={chip_mode})")

        result = await graph.ainvoke(initial_state)

        # Check for errors
        if result.get("error"):
            logger.error(f"Workflow error: {result['error']}")
            return {
                "success": False,
                "error": result["error"]
            }

        # Return suggestions or chip recommendation
        logger.info(f"Workflow completed successfully with {len(result['transfer_suggestions'])} suggestions")

        response = {
            "success": True,
            "suggestions": result["transfer_suggestions"],
            "team_summary": result.get("team_summary"),
            "team_weaknesses": result.get("team_weaknesses", []),
            "gameweek": result.get("gameweek"),
            "chip_status": result.get("chip_status"),
            "gameweek_intelligence": result.get("gameweek_intelligence"),
        }

        if result.get("chip_recommendation"):
            response["chip_recommendation"] = result["chip_recommendation"]

        return response

    except Exception as e:
        logger.error(f"Workflow execution failed: {e}", exc_info=True)
        return {
            "success": False,
            "error": f"Workflow failed: {str(e)}"
        }
