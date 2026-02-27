"""
Transfer suggestion and execution endpoints.
"""
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel
from typing import Optional, List
from ..agents.graph import run_suggestion_workflow
from ..services.fpl_client import FPLClient
from typing import Optional, List, Dict, Any
from ..agents.graph import run_suggestion_workflow
from ..services.fpl_client import FPLClient
# from ..models.transfer import TransferRequest, TransferResponse # Removed transfer execution
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



