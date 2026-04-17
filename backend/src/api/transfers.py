"""
Transfer suggestion and execution endpoints.
"""
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from ..agents.graph import run_suggestion_workflow
from ..services.fpl_client import FPLClient
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class SuggestionRequest(BaseModel):
    """Request for transfer suggestions."""
    manager_id: int
    feedback: Optional[str] = None
    current_suggestions: Optional[List[dict]] = None


class SuggestionResponse(BaseModel):
    """Response with transfer suggestions."""
    success: bool
    suggestions: List[dict]
    team_summary: Optional[dict] = None
    team_weaknesses: List[str] = []
    gameweek: int


@router.post("/suggest", response_model=SuggestionResponse)
async def get_transfer_suggestions(
    request: SuggestionRequest,
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie")
):
    """
    Generate AI-powered transfer suggestions using LangGraph agents.

    Args:
        request: Suggestion request with manager ID
        fpl_cookie: FPL authentication cookie

    Returns:
        List of transfer suggestions with analysis
    """
    try:
        if not fpl_cookie:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="FPL cookie required in X-FPL-Cookie header"
            )

        logger.info(f"Generating transfer suggestions for manager {request.manager_id}")

        # Run LangGraph workflow
        result = await run_suggestion_workflow(
            manager_id=request.manager_id,
            fpl_cookie=fpl_cookie,
            feedback=request.feedback,
            current_suggestions=request.current_suggestions
        )

        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to generate suggestions")
            )

        return SuggestionResponse(
            success=True,
            suggestions=result["suggestions"],
            team_summary=result.get("team_summary"),
            team_weaknesses=result.get("team_weaknesses", []),
            gameweek=result.get("gameweek", 0)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Suggestion generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate suggestions: {str(e)}"
        )


class TransferExecutionRequest(BaseModel):
    """Request to execute a transfer on FPL."""
    manager_id: int
    gameweek: int
    transfers: List[dict]  # [{"player_in_id": x, "player_out_id": y}]
    chip: Optional[str] = None


class TransferExecutionResponse(BaseModel):
    """Response after executing a transfer."""
    success: bool
    message: str
    fpl_response: Optional[dict] = None


@router.post("/execute", response_model=TransferExecutionResponse)
async def execute_transfer(
    request: TransferExecutionRequest,
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie")
):
    """
    Execute transfer directly on the user's FPL team.
    
    Args:
        request: Transfer request containing manager ID, Gameweek, and list of transfers
        fpl_cookie: FPL authentication cookie
    """
    try:
        if not fpl_cookie:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="FPL cookie required to execute transfers"
            )

        logger.info(f"Executing transfer for manager {request.manager_id} in GW {request.gameweek}")
        
        client = FPLClient(cookie=fpl_cookie)
        
        # 1. Fetch user's current team to get accurate selling prices
        my_team = await client.get_my_team(request.manager_id)
        
        # 2. Fetch all players to get current purchase prices
        all_players = await client.get_all_players()
        players_map = {p.id: p for p in all_players}
        
        # 3. Build FPL transfer payload mapping finding prices
        fpl_transfers = []
        for t in request.transfers:
            p_in_id = t["player_in_id"]
            p_out_id = t["player_out_id"]
            
            # Find purchase price
            p_in = players_map.get(p_in_id)
            if not p_in:
                raise ValueError(f"Player IN {p_in_id} not found")
            purchase_price = p_in.now_cost
            
            # Find selling price
            selling_price = None
            for pick in my_team.picks:
                if pick.element == p_out_id:
                    selling_price = pick.selling_price
                    break
            
            if selling_price is None:
                # Fallback to current cost if not technically in my_team (shouldn't happen)
                p_out = players_map.get(p_out_id)
                if p_out:
                    selling_price = p_out.now_cost
                else:
                    raise ValueError(f"Player OUT {p_out_id} not found in user's team")
                
            fpl_transfers.append({
                "element_in": p_in_id,
                "element_out": p_out_id,
                "purchase_price": purchase_price,
                "selling_price": selling_price
            })
            
        # 4. Execute the fully structured transfer
        logger.info(f"Submitting finalized transfers payload to FPL: {fpl_transfers}")
        fpl_response = await client.execute_transfers(
            entry=request.manager_id,
            event=request.gameweek,
            transfers=fpl_transfers,
            chip=request.chip
        )
        
        return TransferExecutionResponse(
            success=True,
            message="Transfer officially registered successfully with FPL",
            fpl_response=fpl_response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transfer execution heavily failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute transfer: {str(e)}"
        )


