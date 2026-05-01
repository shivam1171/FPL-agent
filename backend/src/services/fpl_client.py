"""
FPL API client for fetching data and executing transfers.
"""
import httpx
from typing import Optional, List, Dict, Any
from collections import defaultdict
from ..config import settings
from ..models.player import Player, UserTeam, TeamSummary, TeamPick
from ..models.fixture import Fixture, Team
from ..models.transfer import TransferResponse
from ..models.chips import ChipInfo, ChipStatus, GameweekDetail, GameweekIntelligence
import logging

logger = logging.getLogger(__name__)


class FPLClient:
    """Client for interacting with the Fantasy Premier League API."""

    def __init__(self, cookie: Optional[str] = None, access_token: Optional[str] = None):
        """
        Initialize FPL client.

        Args:
            cookie: FPL session cookie for authenticated requests.
            access_token: OAuth access token (JWT) from the PingOne SSO flow.
                Required for endpoints like /api/my-team/ since the SSO migration
                — the backend rejects them with 403 if only cookies are sent.
                The header is the FPL-specific ``X-Api-Authorization`` (NOT the
                standard ``Authorization``).
        """
        self.base_url = settings.FPL_BASE_URL
        self.cookie = cookie
        self.access_token = access_token
        self.csrf_token = None
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Referer": "https://fantasy.premierleague.com/",
            "Origin": "https://fantasy.premierleague.com",
            "Accept-Language": "en-US,en;q=0.9"
        }
        if cookie:
            self.headers["Cookie"] = cookie
            # Extract CSRF token from cookie
            self._extract_csrf_token(cookie)
        if access_token:
            self.headers["X-Api-Authorization"] = f"Bearer {access_token}"

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

    async def get_authenticated_manager_id(self) -> Optional[int]:
        """
        Return the entry id (manager id) for the logged-in user.

        FPL's /api/me/ returns {"player": {"entry": <id>, ...}, ...} when a valid
        session cookie is attached. Without a session, "player" is null.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}me/",
                    headers=self.headers,
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()
            player = data.get("player") or {}
            entry = player.get("entry")
            return int(entry) if entry is not None else None
        except Exception as e:
            logger.warning(f"Could not fetch authenticated manager id: {e}")
            return None

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
        Get the active gameweek for strategy/transfer purposes.

        FPL's `is_current` flag stays on a GW until the next one's deadline,
        even after that GW is `finished`. For transfer planning we want the
        next non-finished GW.
        """
        data = await self.get_bootstrap_static()
        events = data["events"]

        # Prefer the current GW if it isn't finished yet
        for event in events:
            if event.get("is_current") and not event.get("finished"):
                return event["id"]

        # If current is finished, use is_next
        for event in events:
            if event.get("is_next"):
                return event["id"]

        # Fallback: first event that isn't finished
        for event in events:
            if not event.get("finished"):
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

    async def get_chip_status(self, manager_id: int) -> ChipStatus:
        """
        Get chip availability for a manager from the my-team endpoint.

        Args:
            manager_id: FPL manager ID

        Returns:
            ChipStatus with all chip info
        """
        if not self.cookie:
            raise ValueError("Authentication required for chip status")

        my_team = await self.get_my_team(manager_id)

        chips = []
        active_chip = None

        for chip_data in my_team.chips:
            chip_name = chip_data.get("name", "")
            status_id = chip_data.get("status_id", 0)
            status_for_entry = chip_data.get("status_for_entry")
            played_by_entry = chip_data.get("played_by_entry", [])
            number = chip_data.get("number", 1)
            start_event = chip_data.get("start_event", 1)
            stop_event = chip_data.get("stop_event", 38)

            chip_info = ChipInfo(
                name=chip_name,
                status_id=status_id,
                status_for_entry=status_for_entry,
                played_by_entry=played_by_entry,
                number=number,
                start_event=start_event,
                stop_event=stop_event,
            )
            chips.append(chip_info)

            # Check if chip is actively played this GW
            if status_for_entry == "active" or status_id == 2:
                active_chip = chip_name

        return ChipStatus(chips=chips, active_chip=active_chip)

    async def get_gameweek_intelligence(self) -> GameweekIntelligence:
        """
        Detect Double and Blank Gameweeks by analysing fixture counts.

        A DGW for a team = that team has >1 fixture in a single GW.
        A BGW for a team = that team has 0 fixtures in a GW.
        We look at the next 5 gameweeks.

        Returns:
            GameweekIntelligence with DGW/BGW info
        """
        bootstrap = await self.get_bootstrap_static()
        events = bootstrap.get("events", [])
        teams_data = bootstrap.get("teams", [])
        teams_map = {t["id"]: t["name"] for t in teams_data}
        all_team_ids = set(teams_map.keys())

        # Find active GW (skip finished ones — FPL keeps is_current on the
        # just-played GW until the next deadline).
        current_gw = 1
        for event in events:
            if event.get("is_current") and not event.get("finished"):
                current_gw = event["id"]
                break
        else:
            for event in events:
                if event.get("is_next"):
                    current_gw = event["id"]
                    break
            else:
                for event in events:
                    if not event.get("finished"):
                        current_gw = event["id"]
                        break

        # Fetch ALL fixtures (no GW filter)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}fixtures/",
                headers=self.headers,
                timeout=30.0,
            )
            response.raise_for_status()
            all_fixtures = response.json()

        # Count fixtures per team per GW
        # team_gw_count[gw][team_id] = number of fixtures
        team_gw_count: Dict[int, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
        for fixture in all_fixtures:
            gw = fixture.get("event")
            if gw is None:
                continue
            team_gw_count[gw][fixture["team_h"]] += 1
            team_gw_count[gw][fixture["team_a"]] += 1

        # Build gameweek details for current + next 5 GWs
        gw_details = []
        for event in events:
            gw_num = event["id"]
            if gw_num < current_gw or gw_num > current_gw + 5:
                continue

            gw_fixtures = [f for f in all_fixtures if f.get("event") == gw_num]
            fixture_count = len(gw_fixtures)

            # Identify teams with double/blank
            teams_double = []
            teams_blank = []
            for team_id in all_team_ids:
                count = team_gw_count[gw_num].get(team_id, 0)
                if count >= 2:
                    teams_double.append(teams_map.get(team_id, f"Team {team_id}"))
                elif count == 0:
                    teams_blank.append(teams_map.get(team_id, f"Team {team_id}"))

            is_double = len(teams_double) > 0
            is_blank = len(teams_blank) > 0

            gw_details.append(GameweekDetail(
                gameweek=gw_num,
                fixture_count=fixture_count,
                is_double=is_double,
                is_blank=is_blank,
                is_current=(gw_num == current_gw),
                is_next=(gw_num == current_gw + 1),
                deadline_time=event.get("deadline_time"),
                teams_with_double=sorted(teams_double),
                teams_with_blank=sorted(teams_blank),
            ))

        return GameweekIntelligence(
            current_gameweek=current_gw,
            gameweek_details=gw_details,
        )

    async def execute_transfers(self, entry: int, event: int, transfers: List[Dict[str, int]], chip: Optional[str] = None) -> Dict[str, Any]:
        """
        Execute transfers on the official FPL API.

        Args:
            entry: FPL manager ID
            event: The gameweek ID to apply the transfer to
            transfers: List of transfer objects with element_in, element_out, purchase_price, selling_price
            chip: Optional chip to play (e.g. wildcard, freehit)

        Returns:
            JSON response from FPL
        """
        if not self.cookie or not self.csrf_token:
            raise ValueError("Authentication and CSRF token required to execute transfers")

        headers = self.headers.copy()
        headers["X-CSRFToken"] = self.csrf_token

        payload = {
            "chip": chip,
            "entry": entry,
            "event": event,
            "transfers": transfers
        }

        logger.info(f"Executing transfer payload: {payload}")

        async with httpx.AsyncClient() as client:
            # Note: Unofficial write endpoints often omit the trailing slash, or use /squad/transfers/
            response = await client.post(
                "https://fantasy.premierleague.com/api/transfers/",
                headers=headers,
                json=payload,
                timeout=15.0
            )
            
            # If standard endpoint fails, many undocumented endpoints return specific error body
            if response.status_code >= 400:
                logger.error(f"FPL Transfer failed with status {response.status_code}: {response.text}")
                response.raise_for_status()
                
            return response.json()
