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

Separate from the agent pipeline. Accepts a free-form message, fetches live team context from FPL, builds a system prompt with squad data, and streams a single GPT-4o call. Returns `is_suggestion_request=True` when the LLM detects the user wants new transfer suggestions (signalled by `[NEEDS_SUGGESTIONS]` prefix).

### Frontend (React + Vite)

`frontend/src/` layout:
- `App.jsx` — top-level state: auth, current view (`team` | `chat` | `leagues`), watchlist (persisted to `localStorage`), and initial suggestions
- `services/api.js` — axios instance; stores FPL cookie in module-level memory and injects it as `X-FPL-Cookie` header on every request
- `components/Auth/LoginForm.jsx` — collects manager ID + raw cookie
- `components/Team/TeamView.jsx` — shows squad, team stats, watchlist management
- `components/Transfers/ChatInterface.jsx` — AI Advisor view; shows suggestions and a chat box; calls `chatAPI.sendMessage` or `transferAPI.getSuggestions` depending on `is_suggestion_request`
- `components/Transfers/SuggestionList.jsx` / `SuggestionCard.jsx` / `ApprovalModal.jsx` — render and execute transfer suggestions
- `components/Leagues/LeaguesView.jsx` / `OtherTeamView.jsx` — league standings

The Vite dev server proxies `/api` → `http://localhost:8000`, so no CORS issues in dev.

### FPL API notes
- Base URL: `https://fantasy.premierleague.com/api/`
- `bootstrap-static/` is the primary endpoint (players, teams, events) — it is called multiple times per request; if optimising, cache this response
- `my-team/{manager_id}/` requires a valid cookie; other endpoints are public
- The transfer execution endpoint is undocumented and may change — see README for how to re-derive it from browser DevTools
