import { Eye, Shirt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getPlayerImageUrl, handlePlayerImageError } from '@/utils/playerImage';
import {
  formPercent, formTone, FORM_TONE_BG, FORM_TONE_TEXT, money, teamBadgeUrl,
} from './teamHelpers';

const STATUS_RING = {
  a: 'bg-primary',
  d: 'bg-warning',
};

/**
 * One squad player. `pitch` is the compact variant used on the formation view,
 * where the team name and price are dropped for density.
 */
export function PlayerCard({
  player,
  pick,
  bench = false,
  pitch = false,
  watched = false,
  selected = false,
  onClick,
  title,
}) {
  const tone = formTone(player.form);
  const statusDot = STATUS_RING[player.status] || 'bg-destructive';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'group relative flex w-full flex-col gap-2 rounded-md p-2.5 text-left',
        'bg-card ring-1 ring-border/60 shadow-raised',
        'transition-[background-color,box-shadow,scale,outline-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
        'hover:bg-card/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        bench && 'opacity-80',
        selected && 'outline-2 outline-offset-2 outline-primary',
        pitch && 'w-[142px] gap-2 p-3'
      )}
    >
      <span
        className={cn('absolute right-2 top-2 size-1.5 rounded-full', statusDot)}
        aria-hidden="true"
      />

      <div className="relative mx-auto">
        <img
          src={getPlayerImageUrl(player.code)}
          alt=""
          onError={handlePlayerImageError(player)}
          className={cn(
            'mx-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]',
            pitch ? 'h-20' : 'h-16'
          )}
        />
        <img
          src={teamBadgeUrl(player.team_code)}
          alt=""
          className="absolute -bottom-1 -right-1 size-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
        />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-xs font-bold">{player.web_name}</span>
          {pick?.is_captain && <Badge variant="warning" className="px-1 py-0">C</Badge>}
          {pick?.is_vice_captain && <Badge className="px-1 py-0">VC</Badge>}
          {watched && (
            <Eye className="size-3 shrink-0 text-info" strokeWidth={2} aria-label="On watchlist" />
          )}
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-1 text-[0.65rem] text-muted-foreground">
          <span className="truncate">
            {player.position}
            {!pitch && ` · ${player.team_name}`}
          </span>
          <span className="shrink-0 tabular-nums">
            {pitch ? `${player.total_points} pts` : money(player.now_cost)}
          </span>
        </div>

        {!pitch && (
          <div className="mt-1 flex items-center justify-between text-[0.65rem] text-muted-foreground">
            <span>
              Form <span className={cn('font-bold', FORM_TONE_TEXT[tone])}>{player.form}</span>
            </span>
            <span className="tabular-nums">{player.total_points} pts</span>
          </div>
        )}

        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary/70">
          <div
            className={cn('h-full rounded-full', FORM_TONE_BG[tone])}
            style={{ width: `${formPercent(player.form)}%` }}
          />
        </div>
      </div>
    </button>
  );
}

/** Empty-state stand-in used when a formation row has no players. */
export function PlayerCardEmpty() {
  return (
    <div className="flex h-[124px] w-[104px] items-center justify-center rounded-md bg-secondary/20 ring-1 ring-border/40">
      <Shirt className="size-5 text-muted-foreground/40" strokeWidth={2} />
    </div>
  );
}
