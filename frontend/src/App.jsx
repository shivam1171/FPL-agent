/**
 * Main App component — FPL Agent
 */
import React, { useState } from 'react';
import LoginForm from './components/Auth/LoginForm';
import TeamView from './components/Team/TeamView';
import ChatInterface from './components/Transfers/ChatInterface';
import LeaguesView from './components/Leagues/LeaguesView';
import { transferAPI } from './services/api';
import './styles/App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [managerId, setManagerId] = useState(null);
  const [fplCookie, setFplCookie] = useState(null);
  const [view, setView] = useState('team');
  const [initialSuggestions, setInitialSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [gameweek, setGameweek] = useState(0);
  
  // Watchlist state lifted here so both TeamView and ChatInterface can access it
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('fpl_watchlist');
    return saved ? JSON.parse(saved) : [];
  });

  const handleLoginSuccess = (id, cookie) => {
    setManagerId(id);
    setFplCookie(cookie);
    setIsAuthenticated(true);
  };

  const handleGetSuggestions = async (feedback = null, currentSuggestions = null) => {
    if (!feedback) {
      setLoadingSuggestions(true);
      setView('chat');
      setInitialSuggestions([]);
    }
    
    // Inject watchlist context into the first request
    let enrichedFeedback = feedback;
    if (!feedback && watchlist.length > 0) {
      const watchlistContext = watchlist.map(p => `${p.web_name} (${p.position}, £${(p.now_cost / 10).toFixed(1)}m, form: ${p.form})`).join(', ');
      // We pass this as part of the feedback for initial generation
      enrichedFeedback = `IMPORTANT CONTEXT — The manager is currently watching these players on their watchlist: ${watchlistContext}. Please factor these players into your analysis and mention any relevant observations about watched players in your suggestions.`;
    }
    
    try {
      const result = await transferAPI.getSuggestions(managerId, enrichedFeedback || feedback, currentSuggestions);
      if (!feedback && result.success) {
        setInitialSuggestions(result.suggestions);
        if (result.gameweek) setGameweek(result.gameweek);
      }
      return result;
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      if (!feedback) {
        setView('team');
      }
      return null;
    } finally {
      if (!feedback) setLoadingSuggestions(false);
    }
  };

  const handleBackToTeam = () => setView('team');
  const handleLogout = () => { setIsAuthenticated(false); setManagerId(null); setFplCookie(null); setView('team'); };

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app">
      <div className="app-header-container animate-stagger">
        <header className="app-header">
          <div className="app-header-left">
            <span className="app-logo">⚽ FPL Agent</span>
            <h1>Manager #{managerId}</h1>
          </div>
          <nav className="header-nav">
            <button className={`nav-tab ${view === 'team' ? 'active' : ''}`} onClick={() => setView('team')}>
              🏟️ Dashboard
            </button>
            <button className={`nav-tab ${view === 'leagues' ? 'active' : ''}`} onClick={() => setView('leagues')}>
              🏆 Competitions
            </button>
            <button className={`nav-tab ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
              🤖 AI Advisor
            </button>
          </nav>
          <div className="header-actions">
            {watchlist.length > 0 && <span className="gw-badge" title="Players on watchlist">👁️ {watchlist.length}</span>}
            {gameweek > 0 && <span className="gw-badge">GW {gameweek}</span>}
            <button className="back-btn" onClick={handleLogout}>Logout</button>
          </div>
        </header>
      </div>

      <main className="app-main">
        <div style={{ display: view === 'team' ? 'block' : 'none', height: '100%' }}>
          <TeamView 
            managerId={managerId} 
            onGetSuggestions={() => handleGetSuggestions()} 
            watchlist={watchlist}
            setWatchlist={setWatchlist}
          />
        </div>
        <div style={{ display: view === 'chat' ? 'block' : 'none', height: '100%' }}>
          <ChatInterface 
            managerId={managerId}
            gameweek={gameweek}
            onGetSuggestions={handleGetSuggestions}
            initialSuggestions={initialSuggestions}
            loading={loadingSuggestions}
            onBack={handleBackToTeam}
            watchlist={watchlist}
          />
        </div>
        <div style={{ display: view === 'leagues' ? 'block' : 'none', height: '100%' }}>
          <LeaguesView managerId={managerId} />
        </div>
      </main>
    </div>
  );
}

export default App;
