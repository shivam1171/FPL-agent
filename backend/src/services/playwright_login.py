"""
Playwright-based FPL login.

FPL retired the legacy ``users.premierleague.com`` form and now logs in via a
PingOne OAuth/PKCE flow at ``account.premierleague.com``. The form is rendered
client-side and the redirect URL contains a per-request ``state`` and
``code_challenge``, so we cannot construct it ourselves — we have to drive a
real browser through the flow.

Steps:
    1. Open https://fantasy.premierleague.com/ with analytics/consent/ad requests
       blocked, which keeps the OneTrust banner from rendering at all
    2. Click the visible "Log in" button → redirects to account.premierleague.com
    3. Fill #username (email) and #password, click #btnSignIn
    4. Wait for the OAuth code exchange to land us back on fantasy.premierleague.com
    5. Collect cookies AND extract the access_token from localStorage
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
import tempfile
import time
from pathlib import Path
from typing import Any, TypedDict

logger = logging.getLogger(__name__)

FPL_HOME_URL = "https://fantasy.premierleague.com/"
ACCOUNT_HOST = "account.premierleague.com"

# Clicking "Log in" kicks off a client-side SSO handshake before the browser
# leaves the page. It normally redirects in ~5s but has been measured at 25s+,
# so a single timeout can't both identify a no-op click and tolerate a slow
# handshake. Probe briefly, re-click, then wait out the handshake once.
CANDIDATE_PROBE_MS = 8000
SSO_HANDSHAKE_MS = 45000
TOKEN_POLL_MS = 15000

# None of this is needed to drive the OAuth flow, and it dominates page load
# time. Blocking cookielaw.org additionally stops the consent banner from ever
# rendering, so there is nothing to dismiss. Note the absence of
# launchdarkly.com — the account page gates its form render on it.
BLOCKED_HOSTS = (
    "doubleclick.net", "google-analytics.com", "googletagmanager.com",
    "googlesyndication.com", "facebook.net", "connect.facebook",
    "snapchat.com", "platform.twitter.com", "tiktok.com",
    "adobedtm.com", "omtrdc.net", "demdex.net", "scorecardresearch.com",
    "quantserve.com", "hotjar.com", "newrelic.com", "nr-data.net",
    "cookielaw.org", "onetrust.com", "braze.com", "amplitude.com",
)
BLOCKED_RESOURCE_TYPES = frozenset({"image", "media", "font"})

# The auth provider renders this inline instead of navigating when credentials
# are rejected. Racing the redirect against it turns a full-timeout wait into ~1s.
SSO_ERROR_SELECTOR = "p.ping-sso__error"

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
    timeout_ms: int = 45000,
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
        _install_request_blocking(context)
        page = context.new_page()
        page.set_default_timeout(timeout_ms)

        try:
            logger.info("Playwright: opening FPL homepage")
            page.goto(FPL_HOME_URL, wait_until="load")

            _dismiss_cookie_banner(page)

            # The login CTA has been both an <a> and a <button>, and "Log in"
            # also appears in the (usually hidden) user menu, so match either tag
            # and try each visible hit until one reaches account.premierleague.com.
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
            for i in range(count):
                logger.info("Playwright: clicking 'Log in' candidate %d/%d", i + 1, count)
                try:
                    candidates.nth(i).click(timeout=CANDIDATE_PROBE_MS)
                except Exception as click_err:
                    # Most likely the consent overlay is intercepting pointer
                    # events, which only happens if the blocklist missed it.
                    logger.info("Candidate %d click failed: %s", i + 1, click_err)
                    _dismiss_cookie_banner(page)
                    continue
                try:
                    page.wait_for_url(
                        lambda u: ACCOUNT_HOST in u,
                        timeout=CANDIDATE_PROBE_MS,
                        wait_until="commit",
                    )
                    navigated = True
                    break
                except PWTimeoutError:
                    logger.info(
                        "Candidate %d has not navigated yet (still at %s)",
                        i + 1, page.url,
                    )

            if not navigated:
                # Two things look identical from here: a click swallowed because
                # React had not hydrated yet, and a handshake that is merely slow.
                # Re-click to cover the first, then wait long to cover the second.
                logger.info("Playwright: re-clicking, then waiting up to %dms for SSO redirect", SSO_HANDSHAKE_MS)
                try:
                    candidates.first.click(timeout=CANDIDATE_PROBE_MS)
                except Exception as click_err:
                    logger.info("Re-click failed (may already be navigating): %s", click_err)
                try:
                    page.wait_for_url(
                        lambda u: ACCOUNT_HOST in u,
                        timeout=SSO_HANDSHAKE_MS,
                        wait_until="commit",
                    )
                    navigated = True
                except PWTimeoutError:
                    pass

            if not navigated:
                try:
                    shot_path = Path(tempfile.gettempdir()) / "fpl_login_failure.png"
                    logger.error(
                        "No 'Log in' candidate navigated. url=%s title=%r body[:500]=%r",
                        page.url, page.title(), page.locator("body").inner_text()[:500],
                    )
                    page.screenshot(path=str(shot_path), full_page=True)
                    logger.error("Saved failure screenshot to %s", shot_path)
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
            # "Sign in" also matches the Google/Facebook/X/Apple social buttons,
            # so prefer the submit button's id and only fall back to the role.
            sign_in = page.locator("button#btnSignIn")
            if sign_in.count() == 0:
                sign_in = page.get_by_role("button", name="Sign in", exact=True)
            sign_in.first.click()
            redirected = _await_signin_outcome(page, SSO_HANDSHAKE_MS)

            if not redirected and ACCOUNT_HOST in page.url:
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
                    _sso_error_text(page)
                    or "Invalid email or password — auth provider rejected the "
                    "credentials.",
                    code="invalid_credentials",
                )

            # The SPA finishes its PKCE code exchange after the redirect lands, so
            # poll for the token. Waiting on networkidle instead would always burn
            # its full timeout — FPL's analytics traffic never goes quiet.
            access_token = _wait_for_access_token(page, TOKEN_POLL_MS)
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


def _install_request_blocking(context: Any) -> None:
    """Abort analytics, consent and decorative requests to speed up page loads."""

    def handler(route: Any) -> None:
        request = route.request
        try:
            if request.resource_type in BLOCKED_RESOURCE_TYPES or any(
                host in request.url for host in BLOCKED_HOSTS
            ):
                route.abort()
            else:
                route.continue_()
        except Exception:
            # The page can navigate out from under an in-flight route.
            pass

    context.route("**/*", handler)


def _dismiss_cookie_banner(page: Any) -> None:
    """
    Best-effort click of the OneTrust / FPL cookie consent banner.

    Blocking cookielaw.org normally stops the banner rendering at all, so this
    is a safety net for if FPL starts serving the script first-party. Each
    selector is probed with ``count()`` first because a plain ``click`` would
    block for its full timeout on every selector when the banner is absent.
    """
    candidates = [
        "#onetrust-accept-btn-handler",
        'button:has-text("Accept All Cookies")',
        'button:has-text("Accept All")',
        'button:has-text("Accept")',
    ]
    for sel in candidates:
        try:
            locator = page.locator(sel).first
            if locator.count() == 0:
                continue
            locator.click(timeout=2500)
            logger.info("Playwright: dismissed cookie banner (%s)", sel)
            return
        except Exception:
            continue


def _sso_error_text(page: Any) -> str | None:
    """Inline validation message shown by the auth provider, if any."""
    try:
        error = page.locator(SSO_ERROR_SELECTOR).first
        if error.count() and error.is_visible():
            return error.inner_text().strip() or None
    except Exception:
        pass
    return None


def _await_signin_outcome(page: Any, timeout_ms: int) -> bool:
    """
    Wait for the sign-in click to resolve. Returns True if we got redirected
    back to FPL, False if the auth provider rejected us or nothing happened.
    """
    deadline = time.monotonic() + timeout_ms / 1000
    while time.monotonic() < deadline:
        url = page.url
        if "fantasy.premierleague.com" in url and ACCOUNT_HOST not in url:
            return True
        if _sso_error_text(page):
            return False
        page.wait_for_timeout(250)
    return False


def _wait_for_access_token(page: Any, timeout_ms: int) -> str | None:
    """Poll localStorage until the SPA's PKCE code exchange writes the token."""
    deadline = time.monotonic() + timeout_ms / 1000
    while True:
        token = _extract_access_token(page)
        if token:
            return token
        if time.monotonic() >= deadline:
            return None
        page.wait_for_timeout(250)


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
