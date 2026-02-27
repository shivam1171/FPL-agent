"""
Debug script to test FPL cookie authentication
"""
import asyncio
import httpx
import sys


def analyze_cookie(cookie: str):
    """Analyze cookie structure."""
    print("=" * 60)
    print("Cookie Analysis")
    print("=" * 60)

    # Split by semicolon
    parts = cookie.split(";")
    print(f"\nTotal cookie parts: {len(parts)}")

    # Check for required parts
    has_csrf = False
    has_session = False
    csrf_value = None
    session_value = None

    for i, part in enumerate(parts):
        part = part.strip()
        if "=" in part:
            key, value = part.split("=", 1)
            print(f"\n{i+1}. {key}")
            print(f"   Value length: {len(value)}")
            print(f"   First 20 chars: {value[:20]}...")

            if key == "csrftoken":
                has_csrf = True
                csrf_value = value
            elif key == "sessionid":
                has_session = True
                session_value = value

    print("\n" + "=" * 60)
    print("Required Components")
    print("=" * 60)
    print(f"✓ csrftoken: {'YES' if has_csrf else 'NO - MISSING!'}")
    print(f"✓ sessionid: {'YES' if has_session else 'NO - MISSING!'}")

    if has_csrf:
        print(f"\nCSRF Token: {csrf_value[:10]}...{csrf_value[-10:]}")
    if has_session:
        print(f"Session ID: {session_value[:10]}...{session_value[-10:]}")

    return has_csrf, has_session


async def test_authentication(cookie: str):
    """Test if cookie works for authentication."""
    print("\n" + "=" * 60)
    print("Testing Authentication")
    print("=" * 60)

    base_url = "https://fantasy.premierleague.com/api/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Cookie": cookie,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    # Test 1: Basic authentication
    print("\n1. Testing GET /api/me/ (basic auth)...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{base_url}me/",
                headers=headers,
                timeout=10.0
            )
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                print("   ✓ Authentication works!")
                data = response.json()
                print(f"   Manager ID: {data.get('player', {}).get('entry')}")
            else:
                print(f"   ✗ Failed: {response.text[:100]}")
    except Exception as e:
        print(f"   ✗ Error: {e}")

    # Test 2: Extract CSRF token
    print("\n2. Extracting CSRF token...")
    csrf_token = None
    for item in cookie.split(";"):
        item = item.strip()
        if item.startswith("csrftoken="):
            csrf_token = item.split("=")[1]
            print(f"   ✓ Found: {csrf_token[:20]}...")
            break

    if not csrf_token:
        print("   ✗ No CSRF token found!")
        return

    # Test 3: Try a POST request to bootstrap-static (doesn't need auth but tests headers)
    print("\n3. Testing POST headers setup...")
    test_headers = headers.copy()
    test_headers["X-CSRFToken"] = csrf_token
    test_headers["Referer"] = "https://fantasy.premierleague.com/"
    test_headers["Origin"] = "https://fantasy.premierleague.com"

    print(f"   Headers to be used:")
    for key in ["User-Agent", "Cookie", "X-CSRFToken", "Referer", "Origin"]:
        value = test_headers.get(key, "MISSING")
        if key == "Cookie":
            print(f"   - {key}: {value[:30]}...")
        elif key == "X-CSRFToken":
            print(f"   - {key}: {value[:20]}...")
        else:
            print(f"   - {key}: {value}")

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print("\nYour cookie is", end=" ")
    if csrf_token:
        print("✓ PROPERLY FORMATTED")
        print("\nYou can use this cookie in the FPL Agent.")
        print("If transfers still fail, the issue might be:")
        print("  1. Cookie has expired (re-login to FPL)")
        print("  2. FPL API endpoint changed")
        print("  3. Additional headers needed")
    else:
        print("✗ MISSING CSRF TOKEN")
        print("\nYou need to get a fresh cookie that includes csrftoken.")
        print("Follow the guide: HOW_TO_GET_FPL_COOKIE.md")


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_cookie.py \"your-cookie-here\"")
        print("\nExample:")
        print('  python test_cookie.py "csrftoken=abc123; sessionid=xyz789"')
        sys.exit(1)

    cookie = sys.argv[1]

    # Analyze structure
    has_csrf, has_session = analyze_cookie(cookie)

    # Test authentication
    if has_csrf and has_session:
        asyncio.run(test_authentication(cookie))
    else:
        print("\n" + "=" * 60)
        print("⚠️  Cookie is incomplete!")
        print("=" * 60)
        print("\nYour cookie must include both:")
        print("  - csrftoken=...")
        print("  - sessionid=...")
        print("\nPlease get a fresh cookie from your browser.")
        print("See: HOW_TO_GET_FPL_COOKIE.md")


if __name__ == "__main__":
    main()
