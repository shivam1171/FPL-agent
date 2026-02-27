# FPL Agent - AI-Powered Fantasy Premier League Transfer System

An intelligent Fantasy Premier League management system that uses AI agents powered by GPT-4o and LangGraph to analyze your team and suggest optimal transfers based on player form, fixture difficulty, and value metrics.

## Features

- 🤖 **AI-Powered Analysis**: Uses GPT-4o via LangGraph agents to analyze player performance
- 📊 **Multi-Factor Evaluation**: Considers form, fixture difficulty (FDR), points per million, xG, and more
- 🎯 **Smart Transfer Suggestions**: Generates 3+ transfer recommendations with detailed rationale
- ✅ **One-Click Execution**: Execute approved transfers directly to your FPL team
- 📱 **Modern UI**: Clean React interface with real-time team data

## Architecture

### Backend (Python + FastAPI)
- **FastAPI** - RESTful API endpoints
- **LangChain/LangGraph** - Agent orchestration framework
- **GPT-4o** - AI model for intelligent analysis
- **httpx** - FPL API client

### Agent Workflow
```
START → DataFetcher → Analyzer → Suggester → END
```

1. **DataFetcher**: Fetches team data, all players, fixtures from FPL API
2. **Analyzer**: Calculates form scores, fixture difficulty, value metrics
3. **Suggester**: Uses GPT-4o to generate transfer suggestions with rationale

### Frontend (React + Vite)
- **React** - UI framework
- **Vite** - Build tool
- **Axios** - HTTP client

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenAI API key
- FPL account and session cookie

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create .env file**
   ```bash
   cp .env.example .env
   ```

5. **Edit .env with your credentials**
   ```env
   FPL_BASE_URL=https://fantasy.premierleague.com/api/
   OPENAI_API_KEY=sk-your-openai-api-key-here
   SECRET_KEY=your-random-secret-key-here
   DEBUG=True
   CORS_ORIGINS=http://localhost:5173
   ```

6. **Run the backend server**
   ```bash
   python -m src.main
   ```

   Backend will run on http://localhost:8000

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create .env file**
   ```bash
   cp .env.example .env
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

   Frontend will run on http://localhost:5173

## How to Use

### 1. Get Your FPL Cookie

To authenticate with your FPL account:

1. Log into https://fantasy.premierleague.com in your browser
2. Open Developer Tools (F12 or Right-click → Inspect)
3. Go to the **Network** tab
4. Refresh the page
5. Find a request to "me/" or any API endpoint
6. Click on it and find the **"Cookie"** header in the request headers
7. Copy the entire cookie value

### 2. Login

1. Open http://localhost:5173 in your browser
2. Enter your FPL Manager ID (found in your FPL URL: fantasy.premierleague.com/entry/{manager_id}/event/{gw})
3. Paste your FPL cookie in the text area
4. Click "Login"

### 3. View Your Team

Once logged in, you'll see:
- Current team composition
- Team value and bank balance
- Player form and points
- Overall rank

### 4. Get AI Suggestions

1. Click **"Get AI Transfer Suggestions"**
2. Wait 10-20 seconds while the AI analyzes your team
3. Review the 3+ transfer suggestions with:
   - Form analysis
   - Fixture difficulty comparison
   - Value for money analysis
   - Expected points gain

### 5. Execute Transfer

1. Click **"Approve & Execute Transfer"** on your chosen suggestion
2. Review the transfer details in the confirmation modal
3. Click **"Confirm Transfer"** to execute
4. Transfer will be made in your actual FPL team

## FPL Strategy Factors

The AI agent considers:

- **Form Analysis**: Last 5 gameweeks performance
- **Fixture Difficulty Rating (FDR)**: Next 5 gameweeks (1-5 scale)
- **Points Per Million**: Cost-effectiveness metric
- **Expected Goals (xG)**: Predictive attacking metric
- **Expected Assists (xA)**: Predictive creative metric
- **Clean Sheet Probability**: For defensive assets
- **Ownership %**: Differential vs template players
- **Injury Status**: Availability and fitness concerns
- **Price Changes**: Budget optimization

## API Endpoints

### Authentication
- `POST /api/auth/login` - Validate FPL cookie
- `GET /api/auth/validate` - Check session validity

### Team Data
- `GET /api/team/{manager_id}` - Get current team
- `GET /api/team/{manager_id}/picks/{gameweek}` - Get gameweek picks

### Transfers
- `POST /api/transfers/suggest` - Generate AI suggestions
- `POST /api/transfers/execute` - Execute a transfer

## Project Structure

```
FPL Agent/
├── backend/
│   ├── src/
│   │   ├── main.py                 # FastAPI app
│   │   ├── config.py               # Settings
│   │   ├── api/                    # API routes
│   │   │   ├── auth.py
│   │   │   ├── team.py
│   │   │   └── transfers.py
│   │   ├── services/
│   │   │   └── fpl_client.py      # FPL API client
│   │   ├── agents/                 # LangGraph system
│   │   │   ├── graph.py           # Workflow
│   │   │   ├── state.py           # State definitions
│   │   │   ├── nodes/             # Agent nodes
│   │   │   └── tools/             # LangChain tools
│   │   └── models/                 # Pydantic models
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main component
│   │   ├── index.jsx              # Entry point
│   │   ├── components/            # React components
│   │   ├── services/api.js        # API client
│   │   └── styles/App.css         # Styles
│   ├── package.json
│   └── .env
└── README.md
```

## Important Notes

### Transfer API Endpoint

⚠️ **The FPL transfer API endpoint is undocumented and may change.** The current implementation is based on reverse engineering browser requests. If transfers fail:

1. Open browser DevTools on fantasy.premierleague.com
2. Make a manual transfer
3. Inspect the POST request in Network tab
4. Update `backend/src/services/fpl_client.py` with correct endpoint/payload

### Rate Limiting

The FPL API may have rate limits. The system implements:
- Exponential backoff on failures
- Request caching where possible
- Error handling for timeout scenarios

### Security

- Never commit your `.env` file with real API keys
- FPL cookie is stored only in memory (not persisted)
- Use environment variables for all secrets

## Development

### Running Tests

```bash
cd backend
pytest
```

### Building for Production

**Backend:**
```bash
cd backend
pip install gunicorn
gunicorn src.main:app --workers 4 --bind 0.0.0.0:8000
```

**Frontend:**
```bash
cd frontend
npm run build
```

## Troubleshooting

### "Invalid FPL cookie" error
- Cookie may have expired - get a fresh one from browser
- Ensure you copied the entire cookie value

### "Failed to generate suggestions" error
- Check OpenAI API key is valid
- Ensure you have API credits
- Check backend logs for detailed error

### Transfer execution fails
- Verify transfer is legal (budget, squad limits)
- Check FPL website hasn't changed their API
- Ensure cookie is still valid

## Future Enhancements

- [ ] Automatic transfer execution on schedule
- [ ] Chip strategy recommendations (Wildcard, Bench Boost, etc.)
- [ ] Price change predictions
- [ ] League comparison and differential finder
- [ ] Historical data analysis and ML predictions
- [ ] Mobile app (React Native)
- [ ] Email/SMS notifications

## Credits

Built with:
- [FastAPI](https://fastapi.tiangolo.com/)
- [LangChain](https://python.langchain.com/)
- [LangGraph](https://github.com/langchain-ai/langgraph)
- [OpenAI GPT-4o](https://openai.com/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)

FPL API documentation: https://www.oliverlooney.com/blogs/FPL-APIs-Explained

## License

This project is for educational purposes. Use responsibly and in accordance with Fantasy Premier League's terms of service.

---

**Happy FPL managing! May your transfers always return green arrows! 📈⚽**
