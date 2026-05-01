"""
Playwright-based FPL login.

FPL retired the legacy ``users.premierleague.com`` form and now logs in via a
PingOne OAuth/PKCE flow at ``account.premierleague.com``. The form is rendered
client-side and the redirect URL contains a per-request ``state`` and
``code_challenge``, so we cannot construct it ourselves — we have to drive a
real browser through the flow.

Steps:
    1. Open https://fantasy.premierleague.com/
    2. Dismiss the OneTrust cookie banner if present
    3. Click the visible "Log in" button → redirects to account.premierleague.com
    4. Fill #username (email) and #password, click "Sign in"
    5. Wait for the OAuth code exchange to land us back on fantasy.premierleague.com
    6. Collect cookies AND extract the access_token from localStorage
       (under ``oidc.user:<authority>:<client_id>``) — endpoints like
       ``/api/my-team/`` require it as ``X-Api-Authorization: Bearer <jwt>``.

Implementation note: uses Playwright's sync API in a worker thread via
``asyncio.to_thread``. Uvicorn forces ``WindowsSelectorEventLoopPolicy`` on
Windows, but Selector loops cannot spawn subprocesses (Playwright needs one for
its driver). ``main.py`` sets ``WindowsProactorEventLoopPolicy`` before uvicorn
imports so the policy survives, and uvicorn is started with ``loop="none"`` so
it doesn't override.
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from typing import Any, TypedDict

logger = logging.getLogger(__name__)

FPL_HOME_URL = "https://fantasy.premierleague.com/"
ACCOUNT_HOST = "account.premierleague.com"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)


class FPLLoginError(Exception):
    """Raised when Playwright login to FPL fails. ``code`` lets callers branch."""

    def __init__(self, message: str, *, code: str = "login_failed"):
        super().__init__(message)
        self.code = code


class FPLSession(TypedDict):
    """Result of a successful FPL login.

    Both fields are needed: cookies pass DataDome / Cloudflare checks, and the
    access token authenticates per-user endpoints like ``/api/my-team/`` via
    ``X-Api-Authorization: Bearer <token>``.
    """

    cookie: str
    access_token: str


async def login_to_fpl(
    email: str,
    password: str,
    *,
    headless: bool = True,
    timeout_ms: int = 30000,
) -> FPLSession:
    """
    Log in to Fantasy Premier League with email + password using a real browser.

    Args:
        email: FPL account email.
        password: FPL account password.
        headless: Run the browser without a visible window. Set False to debug
            or to solve a captcha manually.
        timeout_ms: Per-step timeout in milliseconds.

    Returns:
        ``FPLSession`` dict with the cookie string and OAuth ``access_token``.

    Raises:
        FPLLoginError: With ``code`` in {``playwright_not_installed``, ``captcha``,
            ``invalid_credentials``, ``login_failed``}.
    """
    return await asyncio.to_thread(
        _login_to_fpl_sync,
        email,
        password,
        headless=headless,
        timeout_ms=timeout_ms,
    )


def _login_to_fpl_sync(
    email: str,
    password: str,
    *,
    headless: bool,
    timeout_ms: int,
) -> FPLSession:
    if sys.platform == "win32":
        # Defence in depth: also enforce Proactor in this worker thread, in case
        # main.py's policy was overridden somewhere downstream.
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    try:
        from playwright.sync_api import (
            sync_playwright,
            TimeoutError as PWTimeoutError,
        )
    except ImportError as e:
        raise FPLLoginError(
            "Playwright is not installed. Run `pip install playwright` and then "
            "`playwright install chromium`.",
            code="playwright_not_installed",
        ) from e

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1280, "height": 800},
            locale="en-US",
        )
        page = context.new_page()
        page.set_default_timeout(timeout_ms)

        try:
            logger.info("Playwright: opening FPL homepage")
            page.goto(FPL_HOME_URL, wait_until="load")

            _dismiss_cookie_banner(page)

            # Give React a moment to hydrate event handlers — networkidle never
            # fires on FPL (constant analytics traffic), so just sleep briefly.
            page.wait_for_timeout(1500)

            # The login CTA is usually an <a> link, not a <button>. Match either.
            # We may match multiple ("Log in" appears in the user menu too); try
            # each in order until one actually navigates to account.premierleague.com.
            candidates = page.locator(
                'a:visible:has-text("Log in"), button:visible:has-text("Log in")'
            )
            try:
                candidates.first.wait_for(state="visible", timeout=timeout_ms)
            except PWTimeoutError:
                raise FPLLoginError(
                    "FPL homepage did not show a Log in element. The site layout "
                    "may have changed.",
                    code="login_failed",
                )

            count = candidates.count()
            logger.info("Playwright: found %d 'Log in' candidates", count)

            navigated = False
            per_attempt_timeout = max(5000, timeout_ms // max(count, 1))
            for i in range(count):
                try:
                    logger.info("Playwright: clicking 'Log in' candidate %d/%d", i + 1, count)
                    with page.expect_navigation(
                        url=lambda u: ACCOUNT_HOST in u,
                        timeout=per_attempt_timeout,
                    ):
                        candidates.nth(i).click()
                    navigated = True
                    break
                except PWTimeoutError:
                    logger.info(
                        "Candidate %d did not navigate (still at %s); trying next",
                        i + 1, page.url,
                    )
                    continue

            if not navigated:
                try:
                    current_url = page.url
                    title = page.title()
                    body_text = page.locator("body").inner_text()[:500]
                    logger.error(
                        "No 'Log in' candidate navigated. url=%s title=%r body[:500]=%r",
                        current_url, title, body_text,
                    )
                    page.screenshot(path="/tmp/fpl_login_failure.png", full_page=True)
                except Exception as diag_err:
                    logger.error("Diagnostic capture failed: %s", diag_err)
                raise FPLLoginError(
                    "Did not redirect to account.premierleague.com after clicking "
                    "Log in.",
                    code="login_failed",
                )

            # PingOne OAuth form: input#username (email), input#password.
            try:
                page.locator("input#username").wait_for(
                    state="visible", timeout=timeout_ms,
                )
            except PWTimeoutError:
                raise FPLLoginError(
                    f"Login form did not appear at {page.url} within "
                    f"{timeout_ms}ms.",
                    code="login_failed",
                )

            page.locator("input#username").fill(email)
            page.locator("input#password").fill(password)

            logger.info("Playwright: submitting credentials")
            sign_in = page.get_by_role("button", name="Sign in").first
            try:
                with page.expect_navigation(
                    url=lambda u: "fantasy.premierleague.com" in u
                    and ACCOUNT_HOST not in u,
                    timeout=timeout_ms,
                ):
                    sign_in.click()
            except PWTimeoutError:
                # Stayed on account.premierleague.com → most likely bad creds.
                if ACCOUNT_HOST in page.url:
                    html = page.content().lower()
                    if (
                        "captcha" in html
                        or "cf-chl" in html
                        or "checking your browser" in html
                    ):
                        raise FPLLoginError(
                            "FPL served a Cloudflare/captcha challenge. Retry, "
                            "or call with headless=False to solve it manually.",
                            code="captcha",
                        )
                    raise FPLLoginError(
                        "Invalid email or password — auth provider rejected the "
                        "credentials.",
                        code="invalid_credentials",
                    )
                # Otherwise we did navigate, just not where expected — fall through.

            # Give the OAuth code exchange a moment to settle and write the
            # token to localStorage. networkidle on FPL never actually fires
            # (constant analytics traffic), so swallow the timeout.
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except PWTimeoutError:
                pass

            access_token = _extract_access_token(page)
            if not access_token:
                raise FPLLoginError(
                    "Logged in, but no OAuth access token was found in "
                    "localStorage. FPL may have changed their SSO flow.",
                    code="login_failed",
                )

            cookies = context.cookies()
            has_premierleague_cookie = any(
                "premierleague.com" in c.get("domain", "") for c in cookies
            )
            if not has_premierleague_cookie:
                raise FPLLoginError(
                    "Login appeared to succeed but no premierleague.com session "
                    "cookies were set.",
                    code="login_failed",
                )

            cookie_string = "; ".join(f'{c["name"]}={c["value"]}' for c in cookies)
            logger.info(
                "Playwright login OK — %d cookies + access_token (%d chars)",
                len(cookies),
                len(access_token),
            )
            return {"cookie": cookie_string, "access_token": access_token}

        finally:
            context.close()
            browser.close()


def _dismiss_cookie_banner(page: Any) -> None:
    """Best-effort click of the OneTrust / FPL cookie consent banner."""
    candidates = [
        "#onetrust-accept-btn-handler",
        'button:has-text("Accept All Cookies")',
        'button:has-text("Accept All")',
        'button:has-text("Accept")',
    ]
    for sel in candidates:
        try:
            page.locator(sel).first.click(timeout=2500)
            logger.info("Playwright: dismissed cookie banner (%s)", sel)
            return
        except Exception:
            continue


def _extract_access_token(page: Any) -> str | None:
    """
    Pull the OAuth access_token out of localStorage.

    The FPL SPA uses oidc-client-js, which stores the user under
    ``oidc.user:<authority>:<client_id>`` as a JSON blob containing
    ``access_token``, ``id_token``, ``refresh_token``, ``expires_at``, etc.
    """
    try:
        storage = page.evaluate(
            "() => Object.fromEntries(Object.entries(localStorage))"
        )
    except Exception as e:
        logger.warning("Could not read localStorage: %s", e)
        return None

    for key, raw in storage.items():
        if not key.startswith("oidc.user:"):
            continue
        try:
            parsed = json.loads(raw)
            token = parsed.get("access_token")
            if token:
                return token
        except (json.JSONDecodeError, TypeError):
            continue
    return None
