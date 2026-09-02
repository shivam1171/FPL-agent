/**
 * Squad screen: deadline countdown, headline stats, watchlist, and the pitch /
 * grid / list / analytics views.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Bot, ChartColumn, LayoutGrid, List, Shirt, Trophy, Wallet, ArrowLeftRight,
  TrendingUp, Activity, TriangleAlert,
} from 'lucide-react';
import { teamAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Stat } from '@/components/ui/stat';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WatchlistPanel } from './WatchlistPanel';
import { PlayerCompare } from './PlayerCompare';
import { PitchView, GridView, ListView, AnalyticsView } from './SquadViews';
import { DeadlineBanner } from './DeadlineBanner';
import { findNextDeadlineGw, money, useDeadlineTimer } from './teamHelpers';
import { BallLoader } from '@/components/ui/football';

function LoadingState() {
  return (
    <div className="ui-root flex min-h-[65vh] flex-col items-center justify-center">
      <BallLoader stacked size={44} label="Loading your squad…" />
    </div>
  );
}

const TeamView = ({
  managerId,
  onGetSuggestions,
  watchlist,
  setWatchlist,
  onTeamLoaded,
  refreshKey = 0,
}) => {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topPerformers, setTopPerformers] = useState([]);
  const [view, setView] = useState('pitch');

  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);

  const loadTeam = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await teamAPI.getTeam(managerId);
      setTeam(data);
      if (data?.players) {
        const sorted = data.players
          .map((p) => p.player)
          .sort((a, b) => parseFloat(b.form || 0) - parseFloat(a.form || 0));
        setTopPerformers(sorted.slice(0, 5));
      }
      // Lifts chip status, gameweek intelligence and the free-transfer count to App.
      if (onTeamLoaded) onTeamLoaded(data);
    } catch {
      setError('Failed to load team data.');
    } finally {
      setLoading(false);
    }
    // onTeamLoaded is an inline arrow in App, so it is intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam, refreshKey]);

  const toggleWatchlist = useCallback(
    (player) => {
      setWatchlist((prev) => {
        const exists = prev.find((p) => p.id === player.id);
        const updated = exists ? prev.filter((p) => p.id !== player.id) : [...prev, player];
        localStorage.setItem('fpl_watchlist', JSON.stringify(updated));
        return updated;
      });
    },
    [setWatchlist]
  );

  const handleCompareSelect = (player) => {
    if (!compareA) setCompareA(player);
    else if (!compareB && player.id !== compareA.id) setCompareB(player);
    else {
      setCompareA(player);
      setCompareB(null);
    }
  };

  const exitCompare = () => {
    setCompareMode(false);
    setCompareA(null);
    setCompareB(null);
  };

  const nextDeadlineGw = findNextDeadlineGw(team?.gameweek_intelligence);
  const timeLeft = useDeadlineTimer(nextDeadlineGw?.deadline_time);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="ui-root">
        <Card className="ring-destructive/25">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <TriangleAlert className="size-5 text-destructive" strokeWidth={2} />
            <p className="text-sm font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={loadTeam}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!team) return null;

  const { summary, gameweek, players } = team;
  const starters = players.filter((p) => p.pick.position <= 11);
  const bench = players.filter((p) => p.pick.position > 11);

  const avgForm = (
    players.reduce((acc, p) => acc + parseFloat(p.player.form || 0), 0) / players.length
  ).toFixed(1);

  const ftUnavailable = Boolean(team.transfers?.error);
  const freeTransfers = ftUnavailable
    ? 'N/A'
    : team.transfers?.limit != null
      ? Math.max(0, team.transfers.limit - (team.transfers.made || 0))
      : '—';

  // Watchlist toggling and compare selection share the same card click.
  const cardProps = (player) => ({
    watched: Boolean(watchlist.find((p) => p.id === player.id)),
    selected: compareMode && (compareA?.id === player.id || compareB?.id === player.id),
    onClick: () => (compareMode ? handleCompareSelect(player) : toggleWatchlist(player)),
    title: compareMode ? 'Select to compare' : 'Add to or remove from watchlist',
  });

  const viewProps = { starters, bench, cardProps };

  return (
    <div className="ui-root space-y-4 pb-8">
      {nextDeadlineGw && (
        <DeadlineBanner gameweek={nextDeadlineGw.gameweek} timeLeft={timeLeft} />
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-extrabold tracking-tight">
          Your squad{' '}
          <span className="align-middle text-xs font-bold text-muted-foreground">
            GW{gameweek}
          </span>
        </h2>
        <Button onClick={onGetSuggestions}>
          <Bot strokeWidth={2} />
          AI transfer suggestions
          {watchlist.length > 0 && (
            <span className="text-primary-foreground/70">· {watchlist.length} watched</span>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat className="stagger-item" label="Total points" value={summary.total_points} icon={Trophy} tone="primary" />
        <Stat className="stagger-item" label="Team value" value={money(summary.value)} icon={Wallet} />
        <Stat className="stagger-item" label="In the bank" value={money(summary.bank)} icon={Wallet} tone="muted" />
        <Stat
          className="stagger-item"
          label="Free transfers"
          value={freeTransfers}
          icon={ArrowLeftRight}
          tone={ftUnavailable ? 'destructive' : 'default'}
          hint={ftUnavailable ? 'my-team unavailable' : undefined}
        />
        <Stat className="stagger-item" label="GW transfers" value={summary.event_transfers} icon={ArrowLeftRight} />
        <Stat
          className="stagger-item"
          label="Overall rank"
          value={summary.rank?.toLocaleString() || '—'}
          icon={TrendingUp}
        />
        <Stat className="stagger-item" label="Avg form" value={avgForm} icon={Activity} />
      </div>

      <WatchlistPanel
        watchlist={watchlist}
        onRemove={toggleWatchlist}
        compareMode={compareMode}
        onToggleCompare={() => (compareMode ? exitCompare() : setCompareMode(true))}
        compareA={compareA}
        compareB={compareB}
      />

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="pitch">
            <Shirt strokeWidth={2} /> Pitch
          </TabsTrigger>
          <TabsTrigger value="grid">
            <LayoutGrid strokeWidth={2} /> Grid
          </TabsTrigger>
          <TabsTrigger value="list">
            <List strokeWidth={2} /> List
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <ChartColumn strokeWidth={2} /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pitch" className="mt-3">
          <PitchView {...viewProps} />
        </TabsContent>
        <TabsContent value="grid" className="mt-3">
          <GridView {...viewProps} />
        </TabsContent>
        <TabsContent value="list" className="mt-3">
          <ListView players={players} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-3">
          <AnalyticsView players={players} topPerformers={topPerformers} />
        </TabsContent>
      </Tabs>

      <PlayerCompare a={compareA} b={compareB} onClose={exitCompare} />
    </div>
  );
};

export default TeamView;
