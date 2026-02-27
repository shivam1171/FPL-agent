"""
Setup verification script for FPL Agent backend
"""
import sys
import asyncio


def check_imports():
    """Check if all required packages are installed."""
    print("Checking required packages...")

    required_packages = [
        'fastapi',
        'uvicorn',
        'pydantic',
        'httpx',
        'langchain',
        'langgraph',
        'langchain_openai',
        'dotenv',
    ]

    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"  ✓ {package}")
        except ImportError:
            print(f"  ✗ {package} - MISSING")
            missing.append(package)

    return len(missing) == 0


def check_env():
    """Check if .env file exists and has required variables."""
    print("\nChecking environment configuration...")

    try:
        from src.config import settings

        required_vars = {
            'OPENAI_API_KEY': settings.OPENAI_API_KEY,
            'SECRET_KEY': settings.SECRET_KEY,
            'FPL_BASE_URL': settings.FPL_BASE_URL,
        }

        all_present = True
        for var, value in required_vars.items():
            if value and len(value) > 0 and value != f"your-{var.lower().replace('_', '-')}-here":
                print(f"  ✓ {var}")
            else:
                print(f"  ✗ {var} - NOT SET")
                all_present = False

        return all_present

    except Exception as e:
        print(f"  ✗ Error loading config: {e}")
        return False


async def check_fpl_api():
    """Check if FPL API is accessible."""
    print("\nChecking FPL API connectivity...")

    try:
        from src.services.fpl_client import FPLClient

        client = FPLClient()
        data = await client.get_bootstrap_static()

        if data and 'elements' in data:
            num_players = len(data['elements'])
            print(f"  ✓ FPL API accessible - {num_players} players loaded")
            return True
        else:
            print("  ✗ FPL API returned unexpected data")
            return False

    except Exception as e:
        print(f"  ✗ FPL API error: {e}")
        return False


async def check_openai():
    """Check if OpenAI API key is valid."""
    print("\nChecking OpenAI API...")

    try:
        from langchain_openai import ChatOpenAI
        from src.config import settings

        if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "sk-your-openai-key-here":
            print("  ✗ OpenAI API key not configured")
            return False

        llm = ChatOpenAI(
            model=settings.OPENAI_MODEL,
            api_key=settings.OPENAI_API_KEY,
            timeout=10
        )

        # Try a simple test
        response = await llm.ainvoke("Say 'test'")

        if response:
            print(f"  ✓ OpenAI API key valid (model: {settings.OPENAI_MODEL})")
            return True
        else:
            print("  ✗ OpenAI API returned no response")
            return False

    except Exception as e:
        print(f"  ✗ OpenAI API error: {e}")
        return False


async def main():
    """Run all checks."""
    print("=" * 50)
    print("FPL Agent Backend Setup Verification")
    print("=" * 50)

    results = {}

    # Check imports
    results['imports'] = check_imports()

    # Check environment
    results['env'] = check_env()

    # Check FPL API
    results['fpl'] = await check_fpl_api()

    # Check OpenAI (only if env is configured)
    if results['env']:
        results['openai'] = await check_openai()
    else:
        print("\nSkipping OpenAI check (environment not configured)")
        results['openai'] = False

    # Summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)

    all_passed = all(results.values())

    if all_passed:
        print("✓ All checks passed! Your backend is ready to run.")
        print("\nNext steps:")
        print("  1. Start the backend: python -m src.main")
        print("  2. Navigate to frontend and run: npm install && npm run dev")
        print("  3. Open http://localhost:5173")
    else:
        print("✗ Some checks failed. Please review the errors above.")
        print("\nCommon fixes:")
        print("  - Missing packages: pip install -r requirements.txt")
        print("  - Missing .env: cp .env.example .env (then edit with your keys)")
        print("  - Invalid OpenAI key: Get from https://platform.openai.com/api-keys")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
