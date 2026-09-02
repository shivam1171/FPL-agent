import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { getPlayerImageUrl, handlePlayerImageError } from '@/utils/playerImage';
import { money } from './teamHelpers';

function Side({ player }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <img
        src={getPlayerImageUrl(player.code)}
        alt=""
        onError={handlePlayerImageError(player)}
        className="h-20 object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.22)]"
      />
      <div className="text-xs font-bold">{player.web_name}</div>
      <div className="text-[0.65rem] text-muted-foreground">
        {player.team_name} · {player.position}
      </div>
    </div>
  );
}

/**
 * Side-by-side stat comparison. The higher value in each numeric row is
 * highlighted; rows that are not numeric are shown without a winner.
 */
export function PlayerCompare({ a, b, onClose }) {
  if (!a || !b) return null;

  const rows = [
    { label: 'Form', a: a.form, b: b.form },
    { label: 'Total pts', a: a.total_points, b: b.total_points },
    { label: 'PPG', a: a.points_per_game, b: b.points_per_game },
    { label: 'Cost', a: money(a.now_cost), b: money(b.now_cost), raw: [a.now_cost, b.now_cost], lowerWins: true },
    { label: 'Ownership', a: `${a.selected_by_percent}%`, b: `${b.selected_by_percent}%` },
    { label: 'xG', a: a.expected_goals ?? '—', b: b.expected_goals ?? '—' },
    { label: 'xA', a: a.expected_assists ?? '—', b: b.expected_assists ?? '—' },
    { label: 'xGI', a: a.expected_goal_involvements ?? '—', b: b.expected_goal_involvements ?? '—' },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Player comparison</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 px-5">
          <Side player={a} />
          <div className="w-px self-stretch bg-border" />
          <Side player={b} />
        </div>

        <div className="mt-4 space-y-1 p-5 pt-0">
          {rows.map((row) => {
            const [av, bv] = row.raw || [parseFloat(row.a), parseFloat(row.b)];
            const comparable = !Number.isNaN(av) && !Number.isNaN(bv) && av !== bv;
            const aWins = comparable && (row.lowerWins ? av < bv : av > bv);
            const bWins = comparable && !aWins;

            return (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-sm px-2 py-1.5 odd:bg-secondary/30"
              >
                <span
                  className={cn(
                    'text-right text-xs tabular-nums',
                    aWins ? 'font-bold text-primary' : 'text-muted-foreground'
                  )}
                >
                  {row.a}
                </span>
                <span className="min-w-20 text-center text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </span>
                <span
                  className={cn(
                    'text-left text-xs tabular-nums',
                    bWins ? 'font-bold text-primary' : 'text-muted-foreground'
                  )}
                >
                  {row.b}
                </span>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
