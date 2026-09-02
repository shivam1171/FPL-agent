import { Trophy, HeartPulse, CheckCircle2, ChartColumn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayerCard } from './PlayerCard';
import { getPlayerImageUrl, handlePlayerImageError } from '@/utils/playerImage';
import {
  availabilityFor, formTone, FORM_TONE_TEXT, money,
} from './teamHelpers';

const ROWS = ['FWD', 'MID', 'DEF', 'GKP'];

/** Formation view. Rows are ordered attack-first so it reads like a broadcast graphic. */
export function PitchView({ starters, bench, cardProps }) {
  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative overflow-hidden rounded-lg p-6 sm:p-10',
          'bg-(--pitch) ring-1 ring-border/60'
        )}
      >
        {/* Pitch markings, purely decorative */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-foreground/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-16 w-1/3 rounded-b-lg border-x border-b border-foreground/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-16 w-1/3 rounded-t-lg border-x border-t border-foreground/10"
        />

        <div className="relative space-y-8">
          {ROWS.map((pos) => {
            const row = starters.filter((p) => p.player.position === pos);
            if (row.length === 0) return null;
            return (
              <div key={pos} className="flex flex-wrap justify-center gap-3">
                {row.map(({ player, pick }) => (
                  <PlayerCard key={player.id} player={player} pick={pick} pitch {...cardProps(player)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <SquadSection title="Bench" count={bench.length}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {bench.map(({ player, pick }) => (
            <PlayerCard key={player.id} player={player} pick={pick} bench {...cardProps(player)} />
          ))}
        </div>
      </SquadSection>
    </div>
  );
}

export function SquadSection({ title, count, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {count != null && <Badge variant="outline">{count}</Badge>}
      </div>
      {children}
    </div>
  );
}

export function GridView({ starters, bench, cardProps }) {
  return (
    <div className="space-y-4">
      <SquadSection title="Starting XI" count={starters.length}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {starters.map(({ player, pick }) => (
            <PlayerCard key={player.id} player={player} pick={pick} {...cardProps(player)} />
          ))}
        </div>
      </SquadSection>
      <SquadSection title="Bench" count={bench.length}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {bench.map(({ player, pick }) => (
            <PlayerCard key={player.id} player={player} pick={pick} bench {...cardProps(player)} />
          ))}
        </div>
      </SquadSection>
    </div>
  );
}

function PlayerCell({ player, suffix }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src={getPlayerImageUrl(player.code)}
        alt=""
        onError={handlePlayerImageError(player)}
        className="h-8 shrink-0 object-contain"
      />
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold">
          {player.web_name}
          {suffix}
        </div>
        <div className="truncate text-[0.65rem] text-muted-foreground">{player.team_name}</div>
      </div>
    </div>
  );
}

const TH = ({ className, children }) => (
  <th
    className={cn(
      'px-3 py-2 text-left text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground',
      className
    )}
  >
    {children}
  </th>
);

const TD = ({ className, children }) => (
  <td className={cn('px-3 py-2 text-xs', className)}>{children}</td>
);

export function ListView({ players }) {
  const sorted = [...players].sort((a, b) => a.player.element_type - b.player.element_type);

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-125">
          <thead>
            <tr className="border-b border-border">
              <TH>Player</TH>
              <TH>Pos</TH>
              <TH className="text-right">Cost</TH>
              <TH className="text-right">Form</TH>
              <TH className="text-right">Pts</TH>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ player, pick }) => (
              <tr key={player.id} className="border-b border-border/50 last:border-0">
                <TD>
                  <PlayerCell
                    player={player}
                    suffix={pick.is_captain ? ' (C)' : pick.is_vice_captain ? ' (VC)' : ''}
                  />
                </TD>
                <TD className="text-muted-foreground">{player.position}</TD>
                <TD className="text-right tabular-nums">{money(player.now_cost)}</TD>
                <TD
                  className={cn(
                    'text-right font-bold tabular-nums',
                    FORM_TONE_TEXT[formTone(player.form)]
                  )}
                >
                  {player.form}
                </TD>
                <TD className="text-right tabular-nums">{player.total_points}</TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function AnalyticsView({ players, topPerformers }) {
  const unavailable = players.filter((p) => p.player.status !== 'a');

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-1.5 p-4 pb-2">
          <Trophy className="size-4 text-warning" strokeWidth={2} />
          <h3 className="font-display text-sm font-bold tracking-tight">Top performers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-100">
            <thead>
              <tr className="border-b border-border">
                <TH>Player</TH>
                <TH className="text-right">Form</TH>
                <TH className="text-right">PPG</TH>
                <TH className="text-right">Pts</TH>
              </tr>
            </thead>
            <tbody>
              {topPerformers.map((player) => (
                <tr key={player.id} className="border-b border-border/50 last:border-0">
                  <TD>
                    <PlayerCell player={player} suffix="" />
                  </TD>
                  <TD
                    className={cn(
                      'text-right font-bold tabular-nums',
                      FORM_TONE_TEXT[formTone(player.form)]
                    )}
                  >
                    {player.form}
                  </TD>
                  <TD className="text-right tabular-nums">{player.points_per_game}</TD>
                  <TD className="text-right tabular-nums">{player.total_points}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-1.5 p-4 pb-2">
          <ChartColumn className="size-4 text-info" strokeWidth={2} />
          <h3 className="font-display text-sm font-bold tracking-tight">Squad breakdown</h3>
        </div>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {['GKP', 'DEF', 'MID', 'FWD'].map((pos) => {
              const group = players.filter((p) => p.player.position === pos);
              const avg = group.length
                ? (
                    group.reduce((a, p) => a + parseFloat(p.player.form || 0), 0) / group.length
                  ).toFixed(1)
                : '0.0';
              const pts = group.reduce((a, p) => a + (p.player.total_points || 0), 0);
              return (
                <div key={pos} className="rounded-md bg-secondary/40 p-3 ring-1 ring-border/50">
                  <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                    {pos} ({group.length})
                  </div>
                  <div className="mt-1 font-display text-base font-bold tabular-nums">
                    {pts} pts
                  </div>
                  <div className="text-[0.65rem] text-muted-foreground">Avg form {avg}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center gap-1.5 p-4 pb-2">
          <HeartPulse className="size-4 text-destructive" strokeWidth={2} />
          <h3 className="font-display text-sm font-bold tracking-tight">Availability</h3>
        </div>
        <CardContent>
          {unavailable.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-md bg-primary/10 p-4 text-xs font-medium text-primary ring-1 ring-primary/20">
              <CheckCircle2 className="size-4" strokeWidth={2} />
              Every player is fit and available
            </div>
          ) : (
            <div className="space-y-2">
              {unavailable.map(({ player }) => {
                const status = availabilityFor(player.status);
                return (
                  <div
                    key={player.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/40 p-2.5 ring-1 ring-border/50"
                  >
                    <span className="text-xs font-semibold">
                      {player.web_name}{' '}
                      <span className="font-normal text-muted-foreground">
                        ({player.position})
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={status.tone === 'destructive' ? 'destructive' : 'warning'}
                      >
                        {status.label}
                      </Badge>
                      {player.news && (
                        <span className="text-[0.65rem] text-muted-foreground">{player.news}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
