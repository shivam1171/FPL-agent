# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Style

- Use comments sparingly. Only comment complex or non-obvious code.

## Commands

### Backend
```bash
cd backend

# Activate virtualenv (Windows)
venv\Scripts\activate

# Run dev server (from repo root or backend/)
python -m src.main
# Backend runs on http://localhost:8000; auto-reloads when DEBUG=True

# Run tests
pytest

# Production
gunicorn src.main:app --workers 4 --bind 0.0.0.0:8000
```

### Frontend
```bash
cd frontend

npm install       # install deps
npm run dev       # dev server on http://localhost:5173
npm run build     # production build
```

### Environment setup
- Backend: copy `backend/.env.example` → `backend/.env`, fill in `OPENAI_API_KEY` (model defaults to `gpt-4o`) and optionally `SECRET_KEY`, `DEBUG`, `CORS_ORIGINS`
- Frontend: copy `frontend/.env.example` → `frontend/.env` (sets `VITE_API_BASE_URL`)
- FPL authentication uses a browser session cookie passed from the frontend — it is never persisted to disk

## Deployment (Render)

Backend deploys to Render. Two non-obvious gotchas:

1. **Playwright browser binaries.** `pip install playwright` only installs the Python package; the Chromium binary must be downloaded separately. Render's Python runtime runs builds as a non-root user with no sudo, so `playwright install --with-deps chromium` fails (it tries `apt-get`). Use `playwright install chromium` (no `--with-deps`) — Render's base image already has the system libs Chromium needs.
2. **Browser binary persistence.** The default install path `~/.cache/ms-playwright/` is not guaranteed to survive build → runtime on Render. Install browsers into the project directory by setting `PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/src/.playwright` as a Render env var **and** in the build command. Build command:
   ```
   PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/src/.playwright pip install -r requirements.txt && PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/src/.playwright playwright install chromium
   ```
   The env var must be set at both build time (writes to that path) and runtime (Playwright reads from it).

### Dependency pinning

`backend/requirements.txt` uses exact pins for every package. Note: `greenlet` must stay at `3.1.1` because `playwright==1.49.0` hard-pins it (`greenlet==3.1.1`). Bumping greenlet causes `pip install` to fail with `ResolutionImpossible`.

## Architecture

### Backend (FastAPI + LangGraph)

`backend/src/` layout:
- `main.py` — creates the FastAPI app, registers CORS, mounts all routers under `/api`
- `config.py` — `Settings` via pydantic-settings, reads from `.env`
- `api/` — one file per domain (`auth`, `team`, `transfers`, `chat`, `leagues`), each exports an `APIRouter`
- `services/fpl_client.py` — `FPLClient` class; all FPL API calls go here (httpx, async). Auth uses the raw browser cookie passed as header `X-FPL-Cookie`. CSRF token is extracted from the cookie string.
- `agents/` — LangGraph workflow
- `models/` — Pydantic models (`Player`, `TeamSummary`, `TeamPick`, `Fixture`, `Team`, `TransferResponse`)

#### LangGraph agent pipeline

`agents/graph.py` defines a linear `StateGraph`:

```
START → fetch_data → analyze → suggest → END
```

- `nodes/data_fetcher.py` — calls `FPLClient` to populate `AgentState` with team picks, all players, fixtures, and team summary
- `nodes/analyzer.py` — computes form scores, fixture difficulty, and value metrics; writes results into state
- `nodes/suggester.py` — sends structured state to GPT-4o (via `langchain-openai`) and parses transfer suggestions
- `agents/state.py` — `AgentState` TypedDict is the single shared state object passed through all nodes
- `agents/tools/fpl_tools.py` — LangChain `@tool` functions available to the suggester node

Entry point: `run_suggestion_workflow()` in `graph.py` — initialises state, compiles the graph, calls `graph.ainvoke()`.

#### Chat endpoint (`api/chat.py`)

Separate from the agent pipeline. Accepts a free-form message, fetches live team context from FPL (including chip status and DGW/BGW data), builds a system prompt with squad data, and streams a single GPT-4o call. Returns `is_suggestion_request=True` when the LLM detects the user wants new transfer suggestions (signalled by `[NEEDS_SUGGESTIONS]` prefix).

#### Chip Strategy & Gameweek Intelligence

- `models/chips.py` — `ChipInfo`, `ChipStatus`, `GameweekDetail`, `GameweekIntelligence`, `ChipRecommendation` models
- `services/fpl_client.py` — `get_chip_status()` extracts chip availability from `my-team/` endpoint; `get_gameweek_intelligence()` detects DGW/BGW by counting fixtures per team per GW
- `agents/state.py` — `chip_mode`, `chip_status`, `gameweek_intelligence`, `chip_recommendation` fields in `AgentState`
- `agents/nodes/suggester.py` — Three modes based on `chip_mode`:
  - `None` (default): standard 5-transfer suggestions, enhanced with DGW/BGW and chip context
  - `"wildcard"` / `"freehit"`: generates a complete 15-man squad suggestion
  - `"bboost"` / `"3xc"`: generates a should-play/should-wait recommendation with reasoning
- `api/transfers.py` — `POST /transfers/chip-advice` endpoint accepts `{"manager_id", "chip"}` and returns `ChipAdviceResponse`

### Frontend (React + Vite)

`frontend/src/` layout:
- `App.jsx` — top-level state: auth, current view (`team` | `chat` | `leagues`), watchlist (persisted to `localStorage`), chip status, GW intelligence, and initial suggestions
- `services/api.js` — axios instance; stores FPL cookie in module-level memory and injects it as `X-FPL-Cookie` header on every request. `transferAPI.getChipAdvice()` calls the chip-advice endpoint
- `components/Auth/LoginForm.jsx` — collects manager ID + raw cookie
- `components/Team/TeamView.jsx` — shows squad, team stats, watchlist management
- `components/Transfers/ChatInterface.jsx` — AI Advisor view; shows suggestions, chat box, and integrates ChipAdvisor panel via toggle button
- `components/Transfers/ChipAdvisor.jsx` — Chip Strategy Hub; displays chip availability cards, DGW/BGW intelligence panel, "Analyze" button per chip, and expandable recommendation panels (full squad for WC/FH, yes/no for BB/TC)
- `components/Transfers/SuggestionList.jsx` / `SuggestionCard.jsx` / `ApprovalModal.jsx` — render and execute transfer suggestions
- `components/Leagues/LeaguesView.jsx` / `OtherTeamView.jsx` — league standings

The Vite dev server proxies `/api` → `http://localhost:8000`, so no CORS issues in dev.

### FPL API notes
- Base URL: `https://fantasy.premierleague.com/api/`
- `bootstrap-static/` is the primary endpoint (players, teams, events) — it is called multiple times per request; if optimising, cache this response
- `my-team/{manager_id}/` requires a valid cookie; other endpoints are public. The `chips` array in the response contains chip availability with `status_id`, `played_by_entry`, and timing fields
- DGW/BGW detection is done by fetching all `/fixtures/` and counting matches per team per GW — teams with 2+ fixtures in a GW have a double, teams with 0 have a blank
- The transfer execution endpoint is undocumented and may change — see README for how to re-derive it from browser DevTools

### Playwright login flow (`services/playwright_login.py`)

FPL uses a PingOne OAuth/PKCE flow at `account.premierleague.com` with a per-request `state` and `code_challenge`, so the redirect URL cannot be constructed — a real browser must drive the flow. Quirks worth knowing before editing:

- **Multiple "Log in" elements exist on the FPL homepage.** The user-menu toggle button and the main CTA both have the text "Log in", and the main CTA is sometimes an `<a>` link rather than a `<button>`. The implementation matches both (`a:visible:has-text("Log in"), button:visible:has-text("Log in")`) and tries each candidate in turn, accepting the one that actually navigates to `account.premierleague.com`. Don't replace this with a single `.first` selector — the menu toggle is often first and clicking it is a no-op for the OAuth flow.
- **Hydration race.** `wait_until="domcontentloaded"` returns before React hydrates and attaches click handlers, making clicks no-op. Use `wait_until="load"` plus a small `wait_for_timeout` buffer. `networkidle` is unreliable on FPL (constant analytics traffic).
- **Diagnostic capture on failure.** When no candidate navigates, the code logs `page.url`, `title`, and `body[:500]`, plus a screenshot to `/tmp/fpl_login_failure.png`. Check Render logs for these on login failures — they distinguish a Cloudflare/captcha challenge from a layout change.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
