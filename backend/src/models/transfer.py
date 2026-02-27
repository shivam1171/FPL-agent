"""
Transfer suggestion and execution models.
"""
from pydantic import BaseModel, Field
from typing import Optional
from .player import Player


class TransferSuggestion(BaseModel):
    """AI-generated transfer suggestion."""

    # Players involved
    player_out: Player = Field(..., description="Player to transfer out")
    player_in: Player = Field(..., description="Player to transfer in")

    # Analysis
    rationale: str = Field(..., description="Detailed explanation for the transfer")
    expected_points_gain: float = Field(..., description="Expected points improvement over next 5 GWs")
    priority: int = Field(..., description="Priority ranking (1=highest, 2=medium, 3=lowest)")

    # Strategic factors
    form_analysis: str = Field(..., description="Analysis of player form")
    fixture_analysis: str = Field(..., description="Analysis of upcoming fixtures")
    value_analysis: str = Field(..., description="Analysis of cost-effectiveness")

    # Financial impact
    cost_change: float = Field(..., description="Net cost change in millions")
    bank_after: float = Field(..., description="Remaining budget after transfer")

    class Config:
        populate_by_name = True


class TransferRequest(BaseModel):
    """Request to execute a transfer."""

    manager_id: int = Field(..., description="Manager ID")
    player_out_id: int = Field(..., description="Player ID to transfer out")
    player_in_id: int = Field(..., description="Player ID to transfer in")
    selling_price: int = Field(..., description="Selling price in tenths (e.g., 95 = £9.5m)")


class TransferResponse(BaseModel):
    """Response after executing a transfer."""

    success: bool = Field(..., description="Whether transfer was successful")
    message: str = Field(..., description="Success or error message")
    transfer_cost: int = Field(default=0, description="Point deduction for transfer")
    bank_remaining: int = Field(default=0, description="Remaining budget in tenths")


class TransferValidation(BaseModel):
    """Validation result for a proposed transfer."""

    is_valid: bool = Field(..., description="Whether transfer is valid")
    errors: list[str] = Field(default_factory=list, description="Validation errors")
    warnings: list[str] = Field(default_factory=list, description="Validation warnings")

    # Squad composition checks
    squad_size_valid: bool = Field(..., description="Squad size within limits")
    position_limits_valid: bool = Field(..., description="Position limits valid")
    team_limits_valid: bool = Field(..., description="Max 3 per team enforced")
    budget_valid: bool = Field(..., description="Transfer affordable")

    # Budget details
    cost_change: float = Field(..., description="Net cost in millions")
    bank_after: float = Field(..., description="Bank after transfer in millions")
