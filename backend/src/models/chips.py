"""
Chip strategy and gameweek intelligence models.
"""
from pydantic import BaseModel, Field, computed_field
from typing import Optional, List, Dict, Any


class ChipInfo(BaseModel):
    """Status of a single FPL chip."""
    name: str = Field(..., description="Chip name: wildcard, freehit, bboost, 3xc")
    status_id: int = Field(default=0, description="Chip status from FPL API")
    status_for_entry: Optional[str] = Field(None, description="String status: available, active, played, unavailable")
    played_by_entry: Optional[List[int]] = Field(None, description="Gameweeks the chip was played")
    number: int = Field(default=1, description="Number of times this chip is available")
    start_event: int = Field(default=1, description="Earliest GW chip can be played")
    stop_event: int = Field(default=38, description="Latest GW chip can be played")

    @computed_field
    def display_name(self) -> str:
        names = {
            "wildcard": "Wildcard",
            "freehit": "Free Hit",
            "bboost": "Bench Boost",
            "3xc": "Triple Captain",
        }
        return names.get(self.name, self.name)

    @computed_field
    def is_available(self) -> bool:
        if self.status_for_entry:
            return self.status_for_entry in ("available", "active")
        
        # FPL status_id: 1=available, 2=active, 3=played
        if self.status_id in (1, 2):
            return True
        
        # If not explicitly active/available by status, check if we still have uses left
        played_count = len(self.played_by_entry) if self.played_by_entry else 0
        return played_count < self.number


class ChipStatus(BaseModel):
    """Aggregated chip availability for a manager."""
    chips: List[ChipInfo] = Field(default_factory=list)
    active_chip: Optional[str] = Field(None, description="Currently active chip for the upcoming GW")

    def get_chip(self, name: str) -> Optional[ChipInfo]:
        for chip in self.chips:
            if chip.name == name:
                return chip
        return None

    @computed_field
    def available_chips(self) -> List[str]:
        return [c.name for c in self.chips if c.is_available]


class GameweekDetail(BaseModel):
    """Detail about a specific gameweek's fixture count."""
    gameweek: int
    fixture_count: int
    is_double: bool = False
    is_blank: bool = False
    is_current: bool = False
    is_next: bool = False
    deadline_time: Optional[str] = None
    teams_with_double: List[str] = Field(default_factory=list)
    teams_with_blank: List[str] = Field(default_factory=list)


class GameweekIntelligence(BaseModel):
    """Double and Blank Gameweek intelligence for the upcoming window."""
    current_gameweek: int
    gameweek_details: List[GameweekDetail] = Field(default_factory=list)

    @computed_field
    def upcoming_doubles(self) -> List[int]:
        return [gw.gameweek for gw in self.gameweek_details if gw.is_double and gw.gameweek >= self.current_gameweek]

    @computed_field
    def upcoming_blanks(self) -> List[int]:
        return [gw.gameweek for gw in self.gameweek_details if gw.is_blank and gw.gameweek >= self.current_gameweek]


class SquadPick(BaseModel):
    """A single pick in a suggested full squad (for WC/FH chips)."""
    player_id: int
    player_name: str
    position: str
    team_name: str
    cost: float
    form: float
    is_starter: bool = True
    is_captain: bool = False
    is_vice_captain: bool = False
    rationale: str = ""


class ChipRecommendation(BaseModel):
    """AI recommendation for a specific chip."""
    chip_name: str
    display_name: str
    should_play: bool
    confidence: str = Field(..., description="High, Medium, or Low")
    reasoning: str
    best_gameweek: Optional[int] = None
    squad: Optional[List[SquadPick]] = Field(None, description="Full 15-man squad for WC/FH")
    total_cost: Optional[float] = None
    bank_remaining: Optional[float] = None
