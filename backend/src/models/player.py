"""
Player and team data models.
"""
from pydantic import BaseModel, Field, computed_field
from typing import Optional, List


class Player(BaseModel):
    """Player model with FPL statistics."""

    id: int = Field(..., description="Player ID in FPL system")
    code: int = Field(..., description="Player code for images")
    name: str = Field(..., description="Player full name")
    web_name: str = Field(..., description="Player short/web name")
    team: int = Field(..., description="Team ID")
    team_code: Optional[int] = Field(None, description="Team code for badges")
    team_name: Optional[str] = Field(None, description="Team name")
    position: str = Field(..., description="Position: GKP, DEF, MID, FWD")
    element_type: int = Field(..., description="Position type (1=GKP, 2=DEF, 3=MID, 4=FWD)")

    # Pricing
    now_cost: float = Field(..., description="Current price in tenths (e.g., 95 = £9.5m)")
    cost_change_start: int = Field(default=0, description="Price change since season start")

    # Performance
    total_points: int = Field(..., description="Total points this season")
    points_per_game: float = Field(default=0.0, description="Average points per game")
    form: float = Field(default=0.0, description="Recent form score")

    # Ownership
    selected_by_percent: float = Field(default=0.0, description="Ownership percentage")
    transfers_in_event: int = Field(default=0, description="Transfers in this gameweek")
    transfers_out_event: int = Field(default=0, description="Transfers out this gameweek")

    # Expected stats
    expected_goals: Optional[float] = Field(None, alias="expected_goals", description="Expected goals (xG)")
    expected_assists: Optional[float] = Field(None, alias="expected_assists", description="Expected assists (xA)")
    expected_goal_involvements: Optional[float] = Field(None, alias="expected_goal_involvements")
    expected_goals_conceded: Optional[float] = Field(None, alias="expected_goals_conceded")

    # Availability
    status: str = Field(default="a", description="Availability status: a=available, d=doubtful, i=injured, s=suspended, u=unavailable")
    news: Optional[str] = Field(None, description="Injury/availability news")
    chance_of_playing_next_round: Optional[int] = Field(None, description="Percentage chance of playing")

    @property
    def cost_millions(self) -> float:
        """Convert cost to millions."""
        return self.now_cost / 10

    @property
    def points_per_million(self) -> float:
        """Calculate points per million value metric."""
        if self.now_cost == 0:
            return 0.0
        return (self.total_points / self.now_cost) * 10

    class Config:
        populate_by_name = True


class TeamPick(BaseModel):
    """Player pick in user's team."""

    element: int = Field(..., description="Player ID")
    position: int = Field(..., description="Position in squad (1-15, where 1-11 are starters)")
    multiplier: int = Field(..., description="Point multiplier (2=captain, 3=triple captain, 0=benched)")
    is_captain: bool = Field(..., description="Whether player is captain")
    is_vice_captain: bool = Field(..., description="Whether player is vice captain")


class UserTeam(BaseModel):
    """User's FPL team structure."""

    picks: List[TeamPick] = Field(..., description="Player picks")
    chips: List[str] = Field(default_factory=list, description="Active chips")
    transfers: dict = Field(default_factory=dict, description="Transfer information")


class TeamSummary(BaseModel):
    """Summary of user's FPL team."""

    id: int = Field(..., description="Manager ID")
    event: int = Field(default=1, description="Current gameweek")
    points: int = Field(default=0, description="Gameweek points")
    total_points: int = Field(default=0, description="Total points this season")
    rank: int = Field(default=0, description="Overall rank")
    event_transfers: int = Field(default=0, description="Transfers made this gameweek")
    event_transfers_cost: int = Field(default=0, description="Points deduction for transfers")
    value: int = Field(default=1000, description="Team value in tenths")
    bank: int = Field(default=0, description="Money in bank in tenths")

    @computed_field
    def team_value_millions(self) -> float:
        """Team value in millions."""
        return self.value / 10

    @computed_field
    def bank_millions(self) -> float:
        """Bank value in millions."""
        return self.bank / 10
