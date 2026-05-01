"""
Authentication endpoints for FPL Agent.
Supports both cookie-based and email/password login.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from ..services.fpl_client import FPLClient
from ..services.playwright_login import FPLLoginError, login_to_fpl
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class LoginRequest(BaseModel):
    """Login request with FPL cookie."""
    fpl_cookie: str
    manager_id: int


class CredentialLoginRequest(BaseModel):
    """Login request with email and password. Manager ID is auto-derived from /api/me/ after login."""
    email: str
    password: str
    manager_id: Optional[int] = None


class LoginResponse(BaseModel):
    """Login response."""
    success: bool
    message: str
    manager_id: int
    cookie: str = ""  # Return cookie for credential-based login
    access_token: str = ""  # OAuth access token from PingOne SSO


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Validate FPL cookie and authenticate user.
    """
    try:
        logger.info(f"Login attempt for manager {request.manager_id}")
        client = FPLClient(cookie=request.fpl_cookie)
        is_valid = await client.validate_cookie()

        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid FPL cookie. Please check your cookie and try again."
            )

        try:
            await client.get_team_summary(request.manager_id)
        except Exception as e:
            logger.error(f"Failed to fetch team summary: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not access team data. Please check your manager ID."
            )

        logger.info(f"Login successful for manager {request.manager_id}")
        return LoginResponse(
            success=True,
            message="Authentication successful",
            manager_id=request.manager_id,
            cookie=request.fpl_cookie,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/login-credentials", response_model=LoginResponse)
async def login_with_credentials(request: CredentialLoginRequest):
    """
    Log in to FPL with email + password.

    FPL retired the legacy users.premierleague.com Django form and now uses an
    OAuth/PKCE flow at account.premierleague.com (PingOne-backed). The auth URL
    contains a per-request state and code_challenge, so we drive a real browser
    via Playwright instead of replaying it over httpx.
    """
    logger.info(f"Credential login attempt for {request.email}")

    try:
        session = await login_to_fpl(request.email, request.password)
    except FPLLoginError as e:
        status_code = (
            status.HTTP_500_INTERNAL_SERVER_ERROR
            if e.code == "playwright_not_installed"
            else status.HTTP_401_UNAUTHORIZED
        )
        logger.error("Login failed (%s): %s", e.code, e)
        raise HTTPException(status_code=status_code, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error during credential login")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {e}",
        )

    cookie_string = session["cookie"]
    access_token = session["access_token"]

    fpl_client = FPLClient(cookie=cookie_string, access_token=access_token)
    if not await fpl_client.validate_cookie():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login succeeded but the session cookie was rejected by FPL.",
        )

    # Derive manager_id from the authenticated session unless caller supplied one.
    manager_id = request.manager_id
    if manager_id is None:
        manager_id = await fpl_client.get_authenticated_manager_id()
        if manager_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Logged in, but FPL did not return a manager id for this account.",
            )

    try:
        await fpl_client.get_team_summary(manager_id)
    except Exception as e:
        logger.error("Failed to fetch team after credential login: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Logged in, but could not access that manager's team data.",
        )

    logger.info(f"Credential login successful for manager {manager_id}")
    return LoginResponse(
        success=True,
        message="Login successful! Connected to FPL.",
        manager_id=manager_id,
        cookie=cookie_string,
        access_token=access_token,
    )


@router.get("/validate")
async def validate():
    """Validate current session."""
    return {"valid": True}
