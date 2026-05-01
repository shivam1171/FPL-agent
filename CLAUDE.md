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

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
