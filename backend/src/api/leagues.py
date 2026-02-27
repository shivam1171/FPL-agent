"""
Leagues endpoints for FPL Agent.
"""
from fastapi import APIRouter, HTTPException, Header, status, Query
from typing import Optional
from ..services.fpl_client import FPLClient
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/manager/{manager_id}")
async def get_manager_leagues(
    manager_id: int,
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie")
):
    """
    Get leagues a manager is in.

    Args:
        manager_id: FPL manager ID
    """
    try:
        client = FPLClient(cookie=fpl_cookie)
        leagues = await client.get_manager_leagues(manager_id)
        return leagues
    except Exception as e:
        logger.error(f"Failed to fetch leagues: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch leagues: {str(e)}"
        )

@router.get("/{league_id}/standings")
async def get_league_standings(
    league_id: int,
    page: int = Query(1, description="Page number for standings"),
    fpl_cookie: Optional[str] = Header(None, alias="X-FPL-Cookie")
):
    """
    Get standings for a specific classic league.

    Args:
        league_id: Classic league ID
        page: Page number
    """
    try:
        client = FPLClient(cookie=fpl_cookie)
        standings = await client.get_league_standings(league_id, page_standings=page)
        return standings
    except Exception as e:
        logger.error(f"Failed to fetch league standings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch league standings: {str(e)}"
        )
