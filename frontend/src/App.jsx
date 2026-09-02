/**
 * Main App component — FPL Agent
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PitchLines } from '@/components/ui/football';
import LoginForm from './components/Auth/LoginForm';
import TeamView from './components/Team/TeamView';
import ChatInterface from './components/Transfers/ChatInterface';
import LeaguesView from './components/Leagues/LeaguesView';
import { transferAPI } from './services/api';
import './styles/theme.css';

const NAV = [
  { id: 'team', label: 'Dashboard' },
  { id: 'leagues', label: 'Competitions' },
  { id: 'chat', label: 'AI Advisor' },
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [managerId, setManagerId] = useState(null);
  const [fplCookie, setFplCookie] = useState(null);
  const [view, setView] = useState('team');
  const [initialSuggestions, setInitialSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [gameweek, setGameweek] = useState(0);
  const [transfersInfo, setTransfersInfo] = useState(null);
  // Bumped after a transfer executes so TeamView refetches the live squad.
  const [teamRefreshKey, setTeamRefreshKey] = useState(0);
  const [chipStatus, setChipStatus] = useState(null);
  const [gwIntelligence, setGwIntelligence] = useState(null);

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

  // A completed transfer invalidates the squad, the bank and the free-transfer
  // count, and the executed suggestion must not stay clickable.
  const handleTransferExecuted = (executed) => {
    setTeamRefreshKey((k) => k + 1);
    if (executed) {
      setInitialSuggestions((prev) =>
        (prev || []).filter(
          (s) =>
            !(
              s.player_in?.id === executed.player_in?.id &&
              s.player_out?.id === executed.player_out?.id
            )
        )
      );
    }
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
        if (result.chip_status) setChipStatus(result.chip_status);
        if (result.gameweek_intelligence) setGwIntelligence(result.gameweek_intelligence);
        if (result.transfers) setTransfersInfo(result.transfers);
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
    <div className="flex h-screen flex-col bg-background">
      <header className="relative shrink-0 overflow-hidden border-b border-border bg-card">
        <PitchLines />
        <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <span className="font-display text-base font-extrabold tracking-tight">
              FPL<span className="text-primary"> Agent</span>
            </span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              Manager #{managerId}
            </span>
          </div>

          <nav className="flex items-center gap-1 rounded-md bg-secondary/60 p-1" aria-label="Main">
            {NAV.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cn(
                  'relative rounded-sm px-3 py-1.5 text-xs font-semibold',
                  'transition-[color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  view === id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {view === id && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-sm bg-card shadow-raised"
                    transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {watchlist.length > 0 && (
              <Badge variant="outline" title="Players on watchlist">
                <Eye strokeWidth={2} /> {watchlist.length}
              </Badge>
            )}
            {gameweek > 0 && <Badge variant="primary">GW {gameweek}</Badge>}
            <ThemeToggle />
            <Button variant="ghost" size="icon-sm" onClick={handleLogout} aria-label="Log out">
              <LogOut strokeWidth={2} />
            </Button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <div
          className="h-full overflow-y-auto"
          style={{ display: view === 'team' ? 'block' : 'none' }}
        >
          <div className="mx-auto max-w-6xl px-4 py-6">
          <TeamView
            managerId={managerId}
            onGetSuggestions={() => handleGetSuggestions()}
            watchlist={watchlist}
            setWatchlist={setWatchlist}
            refreshKey={teamRefreshKey}
            onTeamLoaded={(data) => {
              if (data?.chip_status) setChipStatus(data.chip_status);
              if (data?.gameweek_intelligence) setGwIntelligence(data.gameweek_intelligence);
              if (data?.gameweek) setGameweek(data.gameweek);
              // Keeps the free-transfer count behind the -4 warning current.
              if (data?.transfers) setTransfersInfo(data.transfers);
            }}
          />
          </div>
        </div>

        <div
          className="mx-auto h-full max-w-6xl px-4 py-4"
          style={{ display: view === 'chat' ? 'block' : 'none' }}
        >
          <ChatInterface
            managerId={managerId}
            gameweek={gameweek}
            onGetSuggestions={handleGetSuggestions}
            initialSuggestions={initialSuggestions}
            loading={loadingSuggestions}
            onBack={handleBackToTeam}
            watchlist={watchlist}
            chipStatus={chipStatus}
            gwIntelligence={gwIntelligence}
            transfersInfo={transfersInfo}
            onTransferExecuted={handleTransferExecuted}
          />
        </div>

        <div
          className="h-full overflow-y-auto"
          style={{ display: view === 'leagues' ? 'block' : 'none' }}
        >
          <div className="mx-auto max-w-6xl px-4 py-6">
            <LeaguesView managerId={managerId} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
