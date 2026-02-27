"""
FPL API client for fetching data and executing transfers.
"""
import httpx
from typing import Optional, List, Dict, Any
from ..config import settings
from ..models.player import Player, UserTeam, TeamSummary, TeamPick
from ..models.fixture import Fixture, Team
from ..models.transfer import TransferResponse
import logging

logger = logging.getLogger(__name__)


class FPLClient:
    """Client for interacting with the Fantasy Premier League API."""

    def __init__(self, cookie: Optional[str] = None):
        """
        Initialize FPL client.

        Args:
            cookie: FPL session cookie for authenticated requests
        """
        self.base_url = settings.FPL_BASE_URL
        self.cookie = cookie
        self.csrf_token = None
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if cookie:
            self.headers["Cookie"] = cookie
            # Extract CSRF token from cookie
            self._extract_csrf_token(cookie)

    def _extract_csrf_token(self, cookie: str):
        """Extract CSRF token from cookie string."""
        for item in cookie.split(";"):
            item = item.strip()
            if item.startswith("csrftoken="):
                self.csrf_token = item.split("=")[1]
                logger.info(f"Extracted CSRF token: {self.csrf_token[:10]}...")
                break

    async def validate_cookie(self) -> bool:
        """
        Validate that the provided cookie is valid.

        Returns:
            True if cookie is valid, False otherwise
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}me/",
                    headers=self.headers,
                    timeout=10.0
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Cookie validation failed: {e}")
            return False

    async def get_bootstrap_static(self) -> Dict[str, Any]:
        """
        Get bootstrap-static data containing all players, teams, and gameweek info.

        Returns:
            Dictionary with players, teams, events, and element_types
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}bootstrap-static/",
                headers=self.headers,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()

    async def get_all_players(self) -> List[Player]:
        """
        Fetch all FPL players with current stats.

        Returns:
            List of Player objects
        """
        data = await self.get_bootstrap_static()
        teams_map = {team["id"]: {"name": team["name"], "code": team["code"]} for team in data["teams"]}

        players = []
        for element in data["elements"]:
            team_info = teams_map.get(element["team"], {})
            player_data = {
                "id": element["id"],
                "code": element["code"],
                "name": element["first_name"] + " " + element["second_name"],
                "web_name": element["web_name"],
                "team": element["team"],
                "team_code": team_info.get("code"),
                "team_name": team_info.get("name"),
                "position": self._get_position_name(element["element_type"]),
                "element_type": element["element_type"],
                "now_cost": element["now_cost"],
                "cost_change_start": element.get("cost_change_start", 0),
                "total_points": element["total_points"],
                "points_per_game": float(element.get("points_per_game", 0.0)),
                "form": float(element.get("form", 0.0)),
                "selected_by_percent": float(element.get("selected_by_percent", 0.0)),
                "transfers_in_event": element.get("transfers_in_event", 0),
                "transfers_out_event": element.get("transfers_out_event", 0),
                "expected_goals": element.get("expected_goals"),
                "expected_assists": element.get("expected_assists"),
                "expected_goal_involvements": element.get("expected_goal_involvements"),
                "expected_goals_conceded": element.get("expected_goals_conceded"),
                "status": element.get("status", "a"),
                "news": element.get("news", ""),
                "chance_of_playing_next_round": element.get("chance_of_playing_next_round"),
            }
            players.append(Player(**player_data))

        return players

    async def get_teams(self) -> List[Team]:
        """
        Fetch all Premier League teams.

        Returns:
            List of Team objects
        """
        data = await self.get_bootstrap_static()
        teams = []
        for team_data in data["teams"]:
            teams.append(Team(**team_data))
        return teams

    async def get_current_gameweek(self) -> int:
        """
        Get the current gameweek number.

        Returns:
            Current gameweek number
        """
        data = await self.get_bootstrap_static()
        for event in data["events"]:
            if event["is_current"]:
                return event["id"]
        return 1

    async def get_my_team(self, manager_id: int) -> UserTeam:
        """
        Fetch user's current team (requires authentication).

        Args:
            manager_id: FPL manager ID

        Returns:
            UserTeam object with picks and transfers
        """
        if not self.cookie:
            raise ValueError("Authentication required for this endpoint")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}my-team/{manager_id}/",
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            return UserTeam(**data)

    async def get_team_summary(self, manager_id: int) -> TeamSummary:
        """
        Fetch manager's team summary.

        Args:
            manager_id: FPL manager ID

        Returns:
            TeamSummary object
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}entry/{manager_id}/",
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

            # Log available fields for debugging
            logger.info(f"Entry data keys: {list(data.keys())}")

            # FPL API uses different field names for team value and bank
            # Try multiple possible field names
            team_value = (
                data.get("last_deadline_value") or
                data.get("value") or
                data.get("team_value") or
                1000
            )

            bank = (
                data.get("last_deadline_bank") or
                data.get("bank") or
                0
            )

            return TeamSummary(
                id=data["id"],
                event=data.get("current_event", 1),
                points=data.get("summary_event_points", 0),
                total_points=data.get("summary_overall_points", 0),
                rank=data.get("summary_overall_rank", 0),
                event_transfers=data.get("event_transfers", 0),
                event_transfers_cost=data.get("event_transfers_cost", 0),
                value=team_value,
                bank=bank
            )

    async def get_manager_leagues(self, manager_id: int) -> Dict[str, Any]:
        """
        Fetch leagues a manager is in.

        Args:
            manager_id: FPL manager ID

        Returns:
            Dictionary containing classic and h2h leagues
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}entry/{manager_id}/",
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            return data.get("leagues", {})

    async def get_league_standings(self, league_id: int, page_new_entries: int = 1, page_standings: int = 1) -> Dict[str, Any]:
        """
        Fetch standings for a specific classic league.

        Args:
            league_id: Classic league ID
            page_new_entries: Page number for new entries (default 1)
            page_standings: Page number for standings (default 1)

        Returns:
            Dictionary with league info and standings
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}leagues-classic/{league_id}/standings/?page_new_entries={page_new_entries}&page_standings={page_standings}",
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

    async def get_team_picks(self, manager_id: int, gameweek: int) -> List[TeamPick]:
        """
        Fetch team picks for a specific gameweek.

        Args:
            manager_id: FPL manager ID
            gameweek: Gameweek number

        Returns:
            List of TeamPick objects
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}entry/{manager_id}/event/{gameweek}/picks/",
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            return [TeamPick(**pick) for pick in data["picks"]]

    async def get_fixtures(self, gameweek: Optional[int] = None) -> List[Fixture]:
        """
        Fetch fixtures, optionally filtered by gameweek.

        Args:
            gameweek: Optional gameweek number to filter

        Returns:
            List of Fixture objects
        """
        url = f"{self.base_url}fixtures/"
        if gameweek:
            url += f"?event={gameweek}"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            fixtures_data = response.json()

        # Get team names
        teams = await self.get_teams()
        teams_map = {team.id: team.name for team in teams}

        fixtures = []
        for fixture_data in fixtures_data:
            fixture_data["team_h_name"] = teams_map.get(fixture_data["team_h"])
            fixture_data["team_a_name"] = teams_map.get(fixture_data["team_a"])
            fixtures.append(Fixture(**fixture_data))

        return fixtures

    async def get_player_summary(self, player_id: int) -> Dict[str, Any]:
        """
        Fetch detailed summary for a specific player including fixtures.

        Args:
            player_id: Player element ID

        Returns:
            Dictionary with player history and fixtures
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}element-summary/{player_id}/",
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    def _get_position_name(element_type: int) -> str:
        """Convert element_type to position name."""
        positions = {1: "GKP", 2: "DEF", 3: "MID", 4: "FWD"}
        return positions.get(element_type, "UNK")
