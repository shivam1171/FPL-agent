"""
LangChain tools for FPL data analysis.
"""
from langchain.tools import tool
from typing import Dict, Any, List
import statistics


@tool
def calculate_fixture_difficulty(
    player_team_id: int,
    fixtures: List[Dict[str, Any]],
    next_n_games: int = 5
) -> Dict[str, Any]:
    """
    Calculate average fixture difficulty for a player's team over next N games.

    Args:
        player_team_id: The team ID of the player
        fixtures: List of all fixtures
        next_n_games: Number of upcoming games to analyze (default 5)

    Returns:
        Dictionary with average difficulty and list of upcoming fixtures
    """
    upcoming_fixtures = []

    for fixture in fixtures:
        if len(upcoming_fixtures) >= next_n_games:
            break

        if not fixture.get("finished", False):
            if fixture["team_h"] == player_team_id:
                upcoming_fixtures.append({
                    "opponent": fixture.get("team_a_name", "Unknown"),
                    "home": True,
                    "difficulty": fixture["team_h_difficulty"]
                })
            elif fixture["team_a"] == player_team_id:
                upcoming_fixtures.append({
                    "opponent": fixture.get("team_h_name", "Unknown"),
                    "home": False,
                    "difficulty": fixture["team_a_difficulty"]
                })

    if not upcoming_fixtures:
        return {
            "avg_difficulty": 3.0,
            "fixtures": [],
            "rating": "Unknown"
        }

    difficulties = [f["difficulty"] for f in upcoming_fixtures]
    avg_diff = statistics.mean(difficulties)

    # Classify difficulty
    if avg_diff < 2.5:
        rating = "Easy"
    elif avg_diff < 3.5:
        rating = "Moderate"
    else:
        rating = "Hard"

    return {
        "avg_difficulty": round(avg_diff, 2),
        "fixtures": upcoming_fixtures,
        "rating": rating
    }


@tool
def get_player_form_score(
    player: Dict[str, Any],
    all_players: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Analyze player's recent form and compare to position average.

    Args:
        player: Player dictionary
        all_players: List of all players

    Returns:
        Dictionary with form analysis
    """
    position = player.get("position", "UNK")

    # Handle None values and convert to float
    form_raw = player.get("form", 0.0) or 0.0
    form = float(form_raw) if form_raw is not None else 0.0

    ppg_raw = player.get("points_per_game", 0.0) or 0.0
    points_per_game = float(ppg_raw) if ppg_raw is not None else 0.0

    # Get average form for position (filter out None values)
    position_players = [p for p in all_players if p.get("position") == position]
    if position_players:
        valid_forms = [float(p.get("form") or 0.0) for p in position_players if p.get("form") is not None]
        valid_ppgs = [float(p.get("points_per_game") or 0.0) for p in position_players if p.get("points_per_game") is not None]

        avg_form = statistics.mean(valid_forms) if valid_forms else 0.0
        avg_ppg = statistics.mean(valid_ppgs) if valid_ppgs else 0.0
    else:
        avg_form = 0.0
        avg_ppg = 0.0

    form_vs_avg = form - avg_form
    ppg_vs_avg = points_per_game - avg_ppg

    # Classify form
    if form >= 6.0:
        form_status = "Excellent"
    elif form >= 4.0:
        form_status = "Good"
    elif form >= 2.0:
        form_status = "Average"
    else:
        form_status = "Poor"

    return {
        "form": form,
        "form_status": form_status,
        "form_vs_position_avg": round(form_vs_avg, 2),
        "points_per_game": points_per_game,
        "ppg_vs_position_avg": round(ppg_vs_avg, 2)
    }


@tool
def analyze_value(player: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze player's value for money (points per million).

    Args:
        player: Player dictionary

    Returns:
        Dictionary with value analysis
    """
    cost = player.get("now_cost", 0) / 10  # Convert to millions
    total_points = player.get("total_points", 0)

    if cost == 0:
        value = 0.0
    else:
        value = total_points / cost

    # Classify value
    if value >= 25:
        value_rating = "Excellent"
    elif value >= 20:
        value_rating = "Good"
    elif value >= 15:
        value_rating = "Average"
    else:
        value_rating = "Poor"

    return {
        "cost": cost,
        "total_points": total_points,
        "points_per_million": round(value, 2),
        "value_rating": value_rating
    }


@tool
def find_underperformers(
    team_players: List[Dict[str, Any]],
    threshold_form: float = 3.0
) -> List[Dict[str, Any]]:
    """
    Find players in the team who are underperforming.

    Args:
        team_players: List of players in the current team
        threshold_form: Form score below which player is considered underperforming

    Returns:
        List of underperforming players with reasons
    """
    underperformers = []

    for player in team_players:
        form_raw = player.get("form", 0.0) or 0.0
        form = float(form_raw) if form_raw is not None else 0.0

        status = player.get("status", "a")
        reasons = []

        if form < threshold_form:
            reasons.append(f"Poor form ({form})")

        if status in ["i", "s", "u"]:
            status_map = {"i": "Injured", "s": "Suspended", "u": "Unavailable"}
            reasons.append(status_map[status])

        chance_playing = player.get("chance_of_playing_next_round")
        if chance_playing is not None and chance_playing < 75:
            reasons.append("Injury doubt")

        if reasons:
            underperformers.append({
                "player": player,
                "reasons": reasons
            })

    return underperformers


@tool
def find_top_performers_by_position(
    all_players: List[Dict[str, Any]],
    position: str,
    max_cost: float,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Find top performing players in a position within budget.

    Args:
        all_players: List of all players
        position: Position to filter (GKP, DEF, MID, FWD)
        max_cost: Maximum cost in millions
        limit: Number of players to return

    Returns:
        List of top performing players
    """
    # Filter by position and cost (handle None values)
    candidates = []
    for p in all_players:
        if p.get("position") != position:
            continue

        now_cost = p.get("now_cost", 0) or 0
        if (now_cost / 10) > max_cost:
            continue

        if p.get("status", "a") != "a":
            continue

        candidates.append(p)

    # Sort by form * points_per_game (composite score), handling None values
    def get_score(player):
        form = player.get("form") or 0.0
        ppg = player.get("points_per_game") or 0.0
        try:
            return float(form) * float(ppg)
        except (ValueError, TypeError):
            return 0.0

    candidates.sort(key=get_score, reverse=True)

    return candidates[:limit]
