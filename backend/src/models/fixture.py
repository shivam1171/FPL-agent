"""
Fixture and difficulty rating models.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

# Neutral FDR used when the FPL API hasn't published a difficulty yet.
DEFAULT_DIFFICULTY = 3


class Fixture(BaseModel):
    """Fixture model with difficulty ratings."""

    id: int = Field(..., description="Fixture ID")
    event: Optional[int] = Field(None, description="Gameweek number")
    kickoff_time: Optional[datetime] = Field(None, description="Kickoff time")

    # Teams
    team_h: int = Field(..., description="Home team ID")
    team_a: int = Field(..., description="Away team ID")
    team_h_name: Optional[str] = Field(None, description="Home team name")
    team_a_name: Optional[str] = Field(None, description="Away team name")

    # Difficulty ratings
    team_h_difficulty: int = Field(default=DEFAULT_DIFFICULTY, description="Difficulty rating for home team (1-5)")
    team_a_difficulty: int = Field(default=DEFAULT_DIFFICULTY, description="Difficulty rating for away team (1-5)")

    @field_validator("team_h_difficulty", "team_a_difficulty", mode="before")
    @classmethod
    def _default_difficulty(cls, v):
        """FPL sends null difficulty for unscheduled fixtures; treat as neutral.

        Downstream code averages these values, so None would break the mean.
        """
        return DEFAULT_DIFFICULTY if v is None else v

    # Results (if played)
    finished: bool = Field(default=False, description="Whether fixture is finished")
    team_h_score: Optional[int] = Field(None, description="Home team score")
    team_a_score: Optional[int] = Field(None, description="Away team score")

    class Config:
        populate_by_name = True


class FixtureDifficultyAnalysis(BaseModel):
    """Analysis of upcoming fixtures for a team."""

    team_id: int = Field(..., description="Team ID")
    team_name: str = Field(..., description="Team name")
    next_5_fixtures: list[Fixture] = Field(..., description="Next 5 fixtures")
    avg_difficulty: float = Field(..., description="Average difficulty rating (1-5)")
    difficulty_rating: str = Field(..., description="Easy, Moderate, or Hard")

    @property
    def is_favorable(self) -> bool:
        """Whether fixtures are favorable (avg difficulty < 3.0)."""
        return self.avg_difficulty < 3.0


class Team(BaseModel):
    """Team information.

    Only ``id``, ``name`` and ``short_name`` are guaranteed by the FPL API.
    Every ``strength_*`` rating is nullable: FPL leaves them unset between
    seasons and for newly promoted sides until it publishes ratings, so these
    must not be required or the whole bootstrap parse fails.
    """

    id: int = Field(..., description="Team ID")
    name: str = Field(..., description="Team full name")
    short_name: str = Field(..., description="Team short name")
    code: Optional[int] = Field(None, description="Team code for badges")
    strength: Optional[int] = Field(None, description="Overall strength rating")
    strength_overall_home: Optional[int] = Field(None, description="Home strength")
    strength_overall_away: Optional[int] = Field(None, description="Away strength")
    strength_attack_home: Optional[int] = Field(None, description="Home attack strength")
    strength_attack_away: Optional[int] = Field(None, description="Away attack strength")
    strength_defence_home: Optional[int] = Field(None, description="Home defence strength")
    strength_defence_away: Optional[int] = Field(None, description="Away defence strength")

    class Config:
        populate_by_name = True
