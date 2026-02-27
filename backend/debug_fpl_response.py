"""
Debug script to inspect FPL API responses
"""
import asyncio
import httpx
import json
import sys


async def debug_fpl_response(manager_id: int, cookie: str = None):
    """Fetch and display FPL API response structure."""

    base_url = "https://fantasy.premierleague.com/api/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    if cookie:
        headers["Cookie"] = cookie

    print("=" * 60)
    print("FPL API Response Structure Debug")
    print("=" * 60)

    # Test 1: Entry endpoint
    print(f"\n1. Testing /entry/{manager_id}/ endpoint...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{base_url}entry/{manager_id}/",
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

            print(f"   Status: {response.status_code}")
            print(f"   Available fields ({len(data)} total):")

            # Show all top-level fields
            for key in sorted(data.keys()):
                value = data[key]
                value_preview = str(value)[:50] if not isinstance(value, dict) else f"<dict with {len(value)} keys>"
                print(f"      - {key}: {value_preview}")

            # Check for specific fields we need
            print("\n   Checking required fields:")
            required = [
                "id", "current_event", "summary_event_points",
                "summary_overall_points", "summary_overall_rank",
                "event_transfers", "event_transfers_cost",
                "last_deadline_value", "last_deadline_bank"
            ]

            for field in required:
                status = "✓" if field in data else "✗ MISSING"
                print(f"      {status} {field}")

            # Save full response for inspection
            with open("fpl_entry_response.json", "w") as f:
                json.dump(data, f, indent=2)
            print("\n   Full response saved to: fpl_entry_response.json")

    except Exception as e:
        print(f"   ERROR: {e}")

    # Test 2: Bootstrap-static endpoint
    print(f"\n2. Testing /bootstrap-static/ endpoint...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{base_url}bootstrap-static/",
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

            print(f"   Status: {response.status_code}")
            print(f"   Top-level keys: {list(data.keys())}")
            print(f"   - elements (players): {len(data.get('elements', []))}")
            print(f"   - teams: {len(data.get('teams', []))}")
            print(f"   - events (gameweeks): {len(data.get('events', []))}")

    except Exception as e:
        print(f"   ERROR: {e}")

    # Test 3: My-team endpoint (requires auth)
    if cookie:
        print(f"\n3. Testing /my-team/{manager_id}/ endpoint (authenticated)...")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{base_url}my-team/{manager_id}/",
                    headers=headers,
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()

                print(f"   Status: {response.status_code}")
                print(f"   Top-level keys: {list(data.keys())}")

                with open("fpl_myteam_response.json", "w") as f:
                    json.dump(data, f, indent=2)
                print("   Full response saved to: fpl_myteam_response.json")

        except Exception as e:
            print(f"   ERROR: {e}")
    else:
        print("\n3. Skipping /my-team/ endpoint (no cookie provided)")

    print("\n" + "=" * 60)
    print("Debug complete!")
    print("=" * 60)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python debug_fpl_response.py <manager_id> [cookie]")
        print("\nExample:")
        print('  python debug_fpl_response.py 9476503')
        print('  python debug_fpl_response.py 9476503 "your-fpl-cookie-here"')
        sys.exit(1)

    manager_id = int(sys.argv[1])
    cookie = sys.argv[2] if len(sys.argv) > 2 else None

    asyncio.run(debug_fpl_response(manager_id, cookie))
