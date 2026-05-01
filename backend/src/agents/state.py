"""
LangGraph agent state definitions.
"""
from typing import TypedDict, List, Optional, Dict, Any
from typing_extensions import Annotated


class AgentState(TypedDict):
    """State for the FPL transfer suggestion agent."""

    # Input parameters
    manager_id: int
    gameweek: int
    fpl_cookie: str
    fpl_access_token: Optional[str]  # OAuth bearer token for /api/my-team/
    chip_mode: Optional[str]  # "wildcard", "freehit", "bboost", "3xc", or None

    # Fetched data
    current_team_picks: Optional[List[Dict[str, Any]]]
    current_team_players: Optional[List[Dict[str, Any]]]  # Full player data for current team
    all_players: Optional[List[Dict[str, Any]]]
    fixtures: Optional[List[Dict[str, Any]]]
    teams: Optional[List[Dict[str, Any]]]
    team_summary: Optional[Dict[str, Any]]

    # Chip & gameweek intelligence
    chip_status: Optional[Dict[str, Any]]
    gameweek_intelligence: Optional[Dict[str, Any]]

    # Analysis results
    form_analysis: Optional[Dict[str, Any]]
    fixture_analysis: Optional[Dict[str, Any]]
    value_analysis: Optional[Dict[str, Any]]
    team_weaknesses: Optional[List[str]]

    # Transfer suggestions (regular mode)
    transfer_suggestions: List[Dict[str, Any]]

    # Chip recommendations (chip mode)
    chip_recommendation: Optional[Dict[str, Any]]

    # Conversational state
    feedback: Optional[str]
    current_suggestions: Optional[List[dict]]
    
    # Workflow control
    step_completed: str
    error: Optional[str]
