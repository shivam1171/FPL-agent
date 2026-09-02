import { Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

function Unit({ value, unit }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="font-display text-base font-bold tabular-nums">{value}</span>
      <span className="text-[0.65rem] font-semibold text-muted-foreground">{unit}</span>
    </span>
  );
}

/**
 * Countdown to the next FPL deadline. Goes destructive under an hour so the
 * urgency reads without needing the numbers.
 */
export function DeadlineBanner({ gameweek, timeLeft }) {
  if (!timeLeft) return null;

  const urgent = !timeLeft.expired && timeLeft.d === 0 && timeLeft.h < 1;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg p-3 ring-1',
        urgent
          ? 'bg-destructive/10 ring-destructive/25'
          : 'bg-card ring-border/60 shadow-raised'
      )}
    >
      <div className="flex items-center gap-2">
        {timeLeft.expired ? (
          <Lock className="size-4 text-muted-foreground" strokeWidth={2} />
        ) : (
          <Clock
            className={cn(
              'size-4',
              urgent ? 'animate-soft-pulse text-destructive' : 'text-muted-foreground'
            )}
            strokeWidth={2}
          />
        )}
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          GW{gameweek} deadline
        </span>
      </div>

      {timeLeft.expired ? (
        <span className="text-sm font-bold text-muted-foreground">Locked</span>
      ) : (
        <div className={cn('flex items-baseline gap-2', urgent && 'text-destructive')}>
          <Unit value={timeLeft.d} unit="d" />
          <Unit value={String(timeLeft.h).padStart(2, '0')} unit="h" />
          <Unit value={String(timeLeft.m).padStart(2, '0')} unit="m" />
          <Unit value={String(timeLeft.s).padStart(2, '0')} unit="s" />
        </div>
      )}
    </div>
  );
}
