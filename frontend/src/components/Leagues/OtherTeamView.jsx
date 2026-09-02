import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowLeftRight, TrendingUp, TriangleAlert, Trophy, Wallet,
} from 'lucide-react';
import { teamAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Stat } from '@/components/ui/stat';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PitchView, GridView, ListView } from '@/components/Team/SquadViews';
import { money } from '@/components/Team/teamHelpers';
import { BallLoader } from '@/components/ui/football';

const OtherTeamView = ({ managerId, managerName, onBack }) => {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerId]);

  const loadTeam = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await teamAPI.getTeam(managerId);
      setTeam(data);
    } catch {
      setError('Failed to load team data. The team might not be visible before the deadline.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center">
        <BallLoader stacked size={44} label={`Loading ${managerName}'s squad…`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft strokeWidth={2} />
          Back
        </Button>
        <Card className="ring-destructive/25">
          <CardContent className="flex items-center gap-2 p-5 text-sm">
            <TriangleAlert className="size-4 shrink-0 text-destructive" strokeWidth={2} />
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!team) return null;

  const { summary, gameweek, players } = team;
  const starters = players.filter((p) => p.pick.position <= 11);
  const bench = players.filter((p) => p.pick.position > 11);

  // Read-only squad: no watchlist or compare interactions on rival teams.
  const cardProps = () => ({});
  const viewProps = { starters, bench, cardProps };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft strokeWidth={2} />
          Back to standings
        </Button>
        <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight">
          {managerName}'s squad{' '}
          <span className="align-middle text-xs font-bold text-muted-foreground">
            GW{gameweek}
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total points" value={summary.total_points} icon={Trophy} tone="primary" />
        <Stat label="Team value" value={money(summary.value)} icon={Wallet} />
        <Stat label="In the bank" value={money(summary.bank)} icon={Wallet} tone="muted" />
        <Stat
          label="Overall rank"
          value={summary.rank?.toLocaleString() || '—'}
          icon={TrendingUp}
        />
        <Stat label="GW transfers" value={summary.event_transfers} icon={ArrowLeftRight} />
      </div>

      <Tabs defaultValue="pitch">
        <TabsList>
          <TabsTrigger value="pitch">Pitch</TabsTrigger>
          <TabsTrigger value="grid">Grid</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
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
      </Tabs>
    </div>
  );
};

export default OtherTeamView;
