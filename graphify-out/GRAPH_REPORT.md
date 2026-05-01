# Graph Report - .  (2026-05-01)

## Corpus Check
- 52 files · ~57,168 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 389 nodes · 789 edges · 26 communities detected
- Extraction: 56% EXTRACTED · 44% INFERRED · 0% AMBIGUOUS · INFERRED: 348 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth API & Login|Auth API & Login]]
- [[_COMMUNITY_Team & Chip Models|Team & Chip Models]]
- [[_COMMUNITY_API Endpoint Glue|API Endpoint Glue]]
- [[_COMMUNITY_LangGraph Workflow|LangGraph Workflow]]
- [[_COMMUNITY_Frontend API Clients|Frontend API Clients]]
- [[_COMMUNITY_Domain Models & Team API|Domain Models & Team API]]
- [[_COMMUNITY_Analyzer & FPL Tools|Analyzer & FPL Tools]]
- [[_COMMUNITY_Backend Config|Backend Config]]
- [[_COMMUNITY_FPL Analysis Tools|FPL Analysis Tools]]
- [[_COMMUNITY_Chip Strategy Models|Chip Strategy Models]]
- [[_COMMUNITY_PL Logo & Branding|PL Logo & Branding]]
- [[_COMMUNITY_Cookie Test Script|Cookie Test Script]]
- [[_COMMUNITY_TeamView UI|TeamView UI]]
- [[_COMMUNITY_Stadium Hero Image|Stadium Hero Image]]
- [[_COMMUNITY_FPL Debug Script|FPL Debug Script]]
- [[_COMMUNITY_Architecture Docs|Architecture Docs]]
- [[_COMMUNITY_Pitch Pattern Background|Pitch Pattern Background]]
- [[_COMMUNITY_League Standings|League Standings]]
- [[_COMMUNITY_Squad Pick Models|Squad Pick Models]]
- [[_COMMUNITY_CORS Helper|CORS Helper]]
- [[_COMMUNITY_Fixture Difficulty Helper|Fixture Difficulty Helper]]
- [[_COMMUNITY_Player Cost Helper|Player Cost Helper]]
- [[_COMMUNITY_Player Value Helper|Player Value Helper]]
- [[_COMMUNITY_Team Value Helper|Team Value Helper]]
- [[_COMMUNITY_Bank Value Helper|Bank Value Helper]]
- [[_COMMUNITY_Logo Script Stub|Logo Script Stub]]

## God Nodes (most connected - your core abstractions)
1. `FPLClient` - 83 edges
2. `Player` - 38 edges
3. `Fixture` - 28 edges
4. `UserTeam` - 28 edges
5. `TeamSummary` - 28 edges
6. `ChipStatus` - 26 edges
7. `ChipInfo` - 25 edges
8. `GameweekDetail` - 25 edges
9. `GameweekIntelligence` - 25 edges
10. `TeamPick` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Config` --uses--> `Player`  [INFERRED]
  backend\src\models\transfer.py → backend\src\models\player.py
- `Transfer suggestion and execution models.` --uses--> `Player`  [INFERRED]
  backend\src\models\transfer.py → backend\src\models\player.py
- `AI-generated transfer suggestion.` --uses--> `Player`  [INFERRED]
  backend\src\models\transfer.py → backend\src\models\player.py
- `Request to execute a transfer.` --uses--> `Player`  [INFERRED]
  backend\src\models\transfer.py → backend\src\models\player.py
- `Validation result for a proposed transfer.` --uses--> `Player`  [INFERRED]
  backend\src\models\transfer.py → backend\src\models\player.py

## Hyperedges (group relationships)
- **LangGraph Transfer Suggestion Pipeline** — data_fetcher_node, analyzer_node, suggester_node, state_agent_state, graph_create_suggestion_graph [EXTRACTED 1.00]
- **Chip Strategy & Gameweek Intelligence** — fpl_client_get_chip_status, fpl_client_get_gameweek_intelligence, chips_chip_status, chips_gameweek_intelligence, suggester_suggest_full_squad, suggester_suggest_chip_usage, transfers_get_chip_advice [EXTRACTED 0.95]
- **Transfer Execution Pipeline** — transfers_execute_transfer, fpl_client_get_my_team, fpl_client_get_all_players, fpl_client_execute_transfers, fpl_client_extract_csrf_token [EXTRACTED 0.95]
- **Suggestion generation flow (App ↔ Chat ↔ transferAPI)** — app_handlegetsuggestions, chatinterface_sendsuggestionmessage, api_transferapi [EXTRACTED 0.95]
- **Chip advice flow (ChatInterface → ChipAdvisor → transferAPI)** — chatinterface, chipadvisor, api_transferapi [EXTRACTED 0.95]
- **Transfer execution (SuggestionCard → ApprovalModal → transferAPI.executeTransfer)** — suggestioncard, approvalmodal, api_transferapi [EXTRACTED 0.95]
- **Watchlist shared between App, TeamView, ChatInterface** — app_watchlist_state, teamview, chatinterface [EXTRACTED 1.00]

## Communities

### Community 0 - "Auth API & Login"
Cohesion: 0.05
Nodes (54): CredentialLoginRequest, login(), login_with_credentials(), LoginRequest, LoginResponse, Authentication endpoints for FPL Agent. Supports both cookie-based and email/pas, Login request with FPL cookie., Validate current session. (+46 more)

### Community 1 - "Team & Chip Models"
Cohesion: 0.19
Nodes (45): Team data endpoints for FPL Agent., Get team picks for a specific gameweek.      Args:         manager_id: FPL manag, Get user's current team composition.      Args:         manager_id: FPL manager, BaseModel, ChipInfo, ChipStatus, GameweekDetail, GameweekIntelligence (+37 more)

### Community 2 - "API Endpoint Glue"
Cohesion: 0.08
Nodes (41): login, login_with_credentials, chat_message, check_setup.main, ChipInfo, ChipStatus, GameweekDetail, GameweekIntelligence (+33 more)

### Community 3 - "LangGraph Workflow"
Cohesion: 0.1
Nodes (30): create_suggestion_graph(), LangGraph state machine for FPL transfer suggestions., Create the LangGraph workflow for generating transfer suggestions.      Workflow, Run the complete transfer suggestion workflow.      Args:         manager_id: FP, run_suggestion_workflow(), AgentState, LangGraph agent state definitions., State for the FPL transfer suggestion agent. (+22 more)

### Community 4 - "Frontend API Clients"
Cohesion: 0.07
Nodes (34): authAPI, axios instance + cookie interceptor, chatAPI, leaguesAPI, teamAPI, transferAPI, handleGetSuggestions, App (root component) (+26 more)

### Community 5 - "Domain Models & Team API"
Cohesion: 0.08
Nodes (16): get_team(), get_team_picks(), Config, FixtureDifficultyAnalysis, Fixture and difficulty rating models., Analysis of upcoming fixtures for a team., Config, Player and team data models. (+8 more)

### Community 6 - "Analyzer & FPL Tools"
Cohesion: 0.16
Nodes (17): analyzer_node, analyze_value, calculate_fixture_difficulty, find_top_performers_by_position, find_underperformers, get_player_form_score, create_suggestion_graph, run_suggestion_workflow (+9 more)

### Community 7 - "Backend Config"
Cohesion: 0.17
Nodes (8): BaseSettings, Config, Configuration management for FPL Agent backend., Application settings loaded from environment variables., Settings, health_check(), FastAPI application entry point for FPL Agent., Health check endpoint.

### Community 8 - "FPL Analysis Tools"
Cohesion: 0.17
Nodes (11): analyze_value(), calculate_fixture_difficulty(), find_top_performers_by_position(), find_underperformers(), get_player_form_score(), LangChain tools for FPL data analysis., Analyze player's value for money (points per million).      Args:         player, Calculate average fixture difficulty for a player's team over next N games. (+3 more)

### Community 9 - "Chip Strategy Models"
Cohesion: 0.18
Nodes (5): ChipRecommendation, Chip strategy and gameweek intelligence models., AI recommendation for a specific chip., A single pick in a suggested full squad (for WC/FH chips)., SquadPick

### Community 10 - "PL Logo & Branding"
Cohesion: 0.25
Nodes (8): App.css Dark Theme Styles, App Header, Premier League Brand Identity, Crowned Lion Heraldic Mark, Dark Theme UI Asset, Fantasy Premier League Domain, LoginForm Component, Premier League Logo (White)

### Community 11 - "Cookie Test Script"
Cohesion: 0.38
Nodes (6): analyze_cookie(), main(), Debug script to test FPL cookie authentication, Analyze cookie structure., Test if cookie works for authentication., test_authentication()

### Community 12 - "TeamView UI"
Cohesion: 0.5
Nodes (2): TeamView(), useDeadlineTimer()

### Community 13 - "Stadium Hero Image"
Cohesion: 0.5
Nodes (5): Stadium Floodlights and Crowd Bokeh, Football Pitch at Dusk, FPL Football Theme Asset, Stadium Hero Background Image, Login/Landing Hero Background Role

### Community 14 - "FPL Debug Script"
Cohesion: 0.5
Nodes (3): debug_fpl_response(), Debug script to inspect FPL API responses, Fetch and display FPL API response structure.

### Community 15 - "Architecture Docs"
Cohesion: 0.67
Nodes (3): LangGraph pipeline: fetch_data → analyze → suggest, Agent workflow concept (DataFetcher → Analyzer → Suggester), Backend Python dependencies

### Community 16 - "Pitch Pattern Background"
Cohesion: 0.67
Nodes (3): Hexagonal Tile Motif, Pitch Pattern Background, TeamView Background Styling

### Community 28 - "League Standings"
Cohesion: 1.0
Nodes (2): FPLClient.get_league_standings, get_league_standings_endpoint

### Community 29 - "Squad Pick Models"
Cohesion: 1.0
Nodes (2): ChipRecommendation, SquadPick

### Community 31 - "CORS Helper"
Cohesion: 1.0
Nodes (1): Convert CORS_ORIGINS string to list.

### Community 37 - "Fixture Difficulty Helper"
Cohesion: 1.0
Nodes (1): Whether fixtures are favorable (avg difficulty < 3.0).

### Community 38 - "Player Cost Helper"
Cohesion: 1.0
Nodes (1): Convert cost to millions.

### Community 39 - "Player Value Helper"
Cohesion: 1.0
Nodes (1): Calculate points per million value metric.

### Community 40 - "Team Value Helper"
Cohesion: 1.0
Nodes (1): Team value in millions.

### Community 41 - "Bank Value Helper"
Cohesion: 1.0
Nodes (1): Bank value in millions.

### Community 47 - "Logo Script Stub"
Cohesion: 1.0
Nodes (1): copy_logo

## Knowledge Gaps
- **92 isolated node(s):** `Debug script to inspect FPL API responses`, `Fetch and display FPL API response structure.`, `Debug script to test FPL cookie authentication`, `Analyze cookie structure.`, `Test if cookie works for authentication.` (+87 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `TeamView UI`** (5 nodes): `TeamView.jsx`, `getPriceMovement()`, `MiniSparkline()`, `TeamView()`, `useDeadlineTimer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `League Standings`** (2 nodes): `FPLClient.get_league_standings`, `get_league_standings_endpoint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Squad Pick Models`** (2 nodes): `ChipRecommendation`, `SquadPick`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CORS Helper`** (1 nodes): `Convert CORS_ORIGINS string to list.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Fixture Difficulty Helper`** (1 nodes): `Whether fixtures are favorable (avg difficulty < 3.0).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Player Cost Helper`** (1 nodes): `Convert cost to millions.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Player Value Helper`** (1 nodes): `Calculate points per million value metric.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Team Value Helper`** (1 nodes): `Team value in millions.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bank Value Helper`** (1 nodes): `Bank value in millions.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Logo Script Stub`** (1 nodes): `copy_logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FPLClient` connect `Auth API & Login` to `Team & Chip Models`, `LangGraph Workflow`, `Domain Models & Team API`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Why does `Player` connect `Team & Chip Models` to `Auth API & Login`, `Domain Models & Team API`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 64 inferred relationships involving `FPLClient` (e.g. with `Setup verification script for FPL Agent backend` and `Check if all required packages are installed.`) actually correct?**
  _`FPLClient` has 64 INFERRED edges - model-reasoned connections that need verification._
- **Are the 35 inferred relationships involving `Player` (e.g. with `Team data endpoints for FPL Agent.` and `Get user's current team composition.      Args:         manager_id: FPL manager`) actually correct?**
  _`Player` has 35 INFERRED edges - model-reasoned connections that need verification._
- **Are the 25 inferred relationships involving `Fixture` (e.g. with `Team data endpoints for FPL Agent.` and `Get user's current team composition.      Args:         manager_id: FPL manager`) actually correct?**
  _`Fixture` has 25 INFERRED edges - model-reasoned connections that need verification._
- **Are the 25 inferred relationships involving `UserTeam` (e.g. with `Team data endpoints for FPL Agent.` and `Get user's current team composition.      Args:         manager_id: FPL manager`) actually correct?**
  _`UserTeam` has 25 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Debug script to inspect FPL API responses`, `Fetch and display FPL API response structure.`, `Debug script to test FPL cookie authentication` to the rest of the system?**
  _92 weakly-connected nodes found - possible documentation gaps or missing edges._