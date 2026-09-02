import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ChevronRight, Minus, Swords, TriangleAlert, Trophy,
  TrendingDown, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { leaguesAPI } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import OtherTeamView from './OtherTeamView';

function MovementIcon({ rank, lastRank }) {
  if (rank < lastRank) return <TrendingUp className="size-3.5 text-primary" strokeWidth={2} />;
  if (rank > lastRank) return <TrendingDown className="size-3.5 text-destructive" strokeWidth={2} />;
  return <Minus className="size-3.5 text-muted-foreground" strokeWidth={2} />;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

const LeaguesView = ({ managerId }) => {
  const [leaguesData, setLeaguesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [standings, setStandings] = useState(null);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const [viewingManager, setViewingManager] = useState(null); // { id, name }

  useEffect(() => {
    loadLeagues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerId]);

  const loadLeagues = async () => {
    try {
      setLoading(true);
      const data = await leaguesAPI.getManagerLeagues(managerId);
      setLeaguesData(data);
    } catch {
      setError('Failed to load leagues.');
    } finally {
      setLoading(false);
    }
  };

  const loadLeagueStandings = async (leagueId) => {
    try {
      setStandingsLoading(true);
      setSelectedLeagueId(leagueId);
      setStandings(null);
      const data = await leaguesAPI.getLeagueStandings(leagueId);
      setStandings(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load standings for this league.');
      setSelectedLeagueId(null);
    } finally {
      setStandingsLoading(false);
    }
  };

  if (viewingManager) {
    return (
      <OtherTeamView
        managerId={viewingManager.id}
        managerName={viewingManager.name}
        onBack={() => setViewingManager(null)}
      />
    );
  }

  if (loading) return <LoadingState />;

  if (error && !leaguesData) {
    return (
      <Card className="ring-destructive/25">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <TriangleAlert className="size-5 text-destructive" strokeWidth={2} />
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={loadLeagues}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!leaguesData) return null;

  // ---- Standings for one league ----
  if (selectedLeagueId) {
    return (
      <div className="space-y-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedLeagueId(null)}>
            <ArrowLeft strokeWidth={2} />
            All leagues
          </Button>
          <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight">
            {standings?.league?.name || 'League standings'}
          </h2>
        </div>

        {standingsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-130">
                <thead>
                  <tr className="border-b border-border">
                    {['Rank', 'Team & manager', 'GW', 'Total', ''].map((h, i) => (
                      <th
                        key={i}
                        className={cn(
                          'px-4 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground',
                          (h === 'GW' || h === 'Total') && 'text-right'
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings?.standings?.results?.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-display text-sm font-bold tabular-nums">
                          {row.rank}
                          <MovementIcon rank={row.rank} lastRank={row.last_rank} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-bold">{row.entry_name}</div>
                        <div className="text-[0.7rem] text-muted-foreground">{row.player_name}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">{row.event_total}</td>
                      <td className="px-4 py-3 text-right font-display text-sm font-bold tabular-nums text-primary">
                        {row.total}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingManager({ id: row.entry, name: row.player_name })}
                        >
                          View team
                          <ChevronRight strokeWidth={2} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ---- League overview ----
  const { classic, h2h } = leaguesData;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-extrabold tracking-tight">Competitions</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your leagues, ranks, and your rivals' squads.
        </p>
      </div>

      <section>
        <div className="mb-2 flex items-center gap-1.5">
          <Trophy className="size-3.5 text-muted-foreground" strokeWidth={2} />
          <h3 className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">
            Classic leagues
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classic?.map((league) => (
            <button
              key={league.id}
              type="button"
              data-static=""
              onClick={() => loadLeagueStandings(league.id)}
              className={cn(
                'stagger-item hover-lift rounded-lg bg-card p-4 text-left shadow-raised ring-1 ring-border/60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-display text-sm font-bold tracking-tight">{league.name}</span>
                <Badge variant="primary" className="shrink-0 tabular-nums">
                  #{league.entry_rank?.toLocaleString() ?? '—'}
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-[0.7rem] text-muted-foreground">
                <span className="flex items-center gap-1 tabular-nums">
                  Was {league.entry_last_rank?.toLocaleString() ?? '—'}
                  <MovementIcon rank={league.entry_rank} lastRank={league.entry_last_rank} />
                </span>
                <span className="tabular-nums">
                  {league.rank_count
                    ? `${league.rank_count.toLocaleString()} entries`
                    : league.max_entries
                      ? `${league.max_entries.toLocaleString()} max`
                      : 'Open entry'}
                </span>
              </div>
            </button>
          ))}
          {(!classic || classic.length === 0) && (
            <p className="text-xs text-muted-foreground">No classic leagues found.</p>
          )}
        </div>
      </section>

      {h2h && h2h.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-1.5">
            <Swords className="size-3.5 text-muted-foreground" strokeWidth={2} />
            <h3 className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">
              Head-to-head leagues
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {h2h.map((league) => (
              <Card key={league.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold">{league.name}</span>
                  <Badge variant="outline" className="tabular-nums">#{league.entry_rank}</Badge>
                </div>
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  H2H standings view not supported yet.
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default LeaguesView;
