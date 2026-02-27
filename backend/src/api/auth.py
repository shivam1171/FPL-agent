"""
Authentication endpoints for FPL Agent.
Supports both cookie-based and email/password login.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from ..services.fpl_client import FPLClient
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class LoginRequest(BaseModel):
    """Login request with FPL cookie."""
    fpl_cookie: str
    manager_id: int


class CredentialLoginRequest(BaseModel):
    """Login request with email and password."""
    email: str
    password: str
    manager_id: int


class LoginResponse(BaseModel):
    """Login response."""
    success: bool
    message: str
    manager_id: int
    cookie: str = ""  # Return cookie for credential-based login


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
    Login with FPL email and password.
    Authenticates against the FPL login endpoint and returns session cookies.
    """
    try:
        logger.info(f"Credential login attempt for manager {request.manager_id}")

        login_url = "https://users.premierleague.com/accounts/login/"
        
        # FPL login requires form-encoded POST data
        login_data = {
            "login": request.email,
            "password": request.password,
            "app": "plfpl-web",
            "redirect_uri": "https://fantasy.premierleague.com/",
        }

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://users.premierleague.com",
            "Referer": "https://users.premierleague.com/accounts/login/",
        }

        async with httpx.AsyncClient(follow_redirects=False) as client:
            response = await client.post(
                login_url,
                data=login_data,
                headers=headers,
                timeout=15.0,
            )

            logger.info(f"FPL login response status: {response.status_code}")

            # FPL returns 302 on success, 200 with error page on failure
            if response.status_code not in (302, 200):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"FPL login failed with status {response.status_code}"
                )

            # Extract cookies from response
            cookies = response.cookies
            cookie_jar = response.headers.get_list("set-cookie")

            if not cookie_jar and response.status_code == 200:
                # 200 usually means invalid credentials (stays on login page)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password. Please check your credentials."
                )

            # Build cookie string from set-cookie headers
            cookie_parts = []
            for cookie_header in cookie_jar:
                # Extract just the key=value part before any attributes
                cookie_kv = cookie_header.split(";")[0].strip()
                if cookie_kv:
                    cookie_parts.append(cookie_kv)

            # Also include any cookies from the response
            for name, value in cookies.items():
                cookie_parts.append(f"{name}={value}")

            cookie_string = "; ".join(cookie_parts)

            if not cookie_string:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="FPL's Cloudflare security blocked the email login. Please use the Cookie method instead (it bypasses this check)."
                )

            logger.info(f"Got cookies with {len(cookie_parts)} parts")

        # Validate the cookie works
        fpl_client = FPLClient(cookie=cookie_string)
        is_valid = await fpl_client.validate_cookie()

        if not is_valid:
            # Try again with a follow-redirect approach to capture more cookies
            logger.warning("Initial cookie validation failed, trying with redirect follow")
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.post(
                    login_url,
                    data=login_data,
                    headers=headers,
                    timeout=15.0,
                )
                # Collect all cookies from the full redirect chain
                all_cookies = dict(response.cookies)
                cookie_string = "; ".join(f"{k}={v}" for k, v in all_cookies.items())
                
                fpl_client = FPLClient(cookie=cookie_string)
                is_valid = await fpl_client.validate_cookie()
                
                if not is_valid:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Login appeared to succeed but session is invalid. Try the cookie method instead."
                    )

        # Verify manager ID access
        try:
            await fpl_client.get_team_summary(request.manager_id)
        except Exception as e:
            logger.error(f"Failed to fetch team after credential login: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Logged in but could not access your team. Check your manager ID."
            )

        logger.info(f"Credential login successful for manager {request.manager_id}")

        return LoginResponse(
            success=True,
            message="Login successful! Connected to FPL.",
            manager_id=request.manager_id,
            cookie=cookie_string,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Credential login failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.get("/validate")
async def validate():
    """Validate current session."""
    return {"valid": True}
