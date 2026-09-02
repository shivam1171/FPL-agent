/**
 * One transfer suggestion, rendered as a ranked row. The collapsed row carries
 * only the decision surface — who out, who in, expected gain, actions — and the
 * rationale, stat comparison and finances fold out on demand.
 */
import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getPlayerImageUrl, handlePlayerImageError } from '@/utils/playerImage';

const teamBadge = (code) =>
  `https://resources.premierleague.com/premierleague/badges/70/t${code}.png`;

function PlayerCell({ player, direction }) {
  const out = direction === 'out';
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative shrink-0">
        <img
          src={getPlayerImageUrl(player.code)}
          alt=""
          onError={handlePlayerImageError(player)}
          className={cn('h-11 w-9 object-contain object-bottom', out && 'saturate-50')}
        />
        <img
          src={teamBadge(player.team_code)}
          alt=""
          className="absolute -bottom-0.5 -right-1 size-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
        />
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            'mb-0.5 text-[0.55rem] font-bold uppercase tracking-widest',
            out ? 'text-destructive' : 'text-primary'
          )}
        >
          {out ? 'Out' : 'In'}
        </div>
        <div className="truncate text-xs font-bold leading-tight">{player.web_name}</div>
        <div className="truncate text-[0.65rem] tabular-nums text-muted-foreground">
          {player.position} · £{(player.now_cost / 10).toFixed(1)}m
        </div>
      </div>
    </div>
  );
}

function CompareStat({ label, out, inn }) {
  return (
    <div className="rounded-md bg-secondary/40 p-2.5 ring-1 ring-border/50">
      <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-xs tabular-nums">
        <span className="text-destructive/90">{out}</span>
        <ArrowRight className="size-3 text-muted-foreground" strokeWidth={2} />
        <span className="font-semibold text-primary">{inn}</span>
      </div>
    </div>
  );
}

const SuggestionCard = ({ suggestion, rank, expanded, onToggle, onReplace, onExecute }) => {
  const playerOut = suggestion.player_out;
  const playerIn = suggestion.player_in;

  return (
    <div className="rounded-lg bg-card shadow-raised ring-1 ring-border/60">
      <div className="flex items-center gap-3 p-3">
        {rank != null && (
          <span className="hidden w-5 shrink-0 text-center font-display text-sm font-bold text-muted-foreground/70 sm:block">
            {rank}
          </span>
        )}

        {/* The out → in pair is also the expand toggle. */}
        <button
          type="button"
          data-static=""
          onClick={onToggle}
          aria-expanded={expanded}
          className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PlayerCell player={playerOut} direction="out" />
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
          <PlayerCell player={playerIn} direction="in" />
        </button>

        {/* The decision number — largest text in the row. */}
        <div className="shrink-0 text-right">
          <div className="font-display text-lg font-extrabold tabular-nums leading-none text-primary">
            +{suggestion.expected_points_gain.toFixed(1)}
          </div>
          <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
            pts
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {onExecute && (
            <Button size="sm" onClick={() => onExecute(suggestion)}>
              <Check strokeWidth={2} />
              <span className="hidden md:inline">Execute</span>
            </Button>
          )}
          {onReplace && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onReplace(suggestion)}
              aria-label="Replace this suggestion"
              title="Request a different transfer for this slot"
            >
              <RefreshCw strokeWidth={2} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label={expanded ? 'Hide details' : 'Show details'}
          >
            <ChevronDown
              strokeWidth={2}
              className={cn(
                'transition-[rotate] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
                expanded && 'rotate-180'
              )}
            />
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border p-3.5">
              <div className="flex gap-2.5 rounded-md bg-secondary/40 p-3 ring-1 ring-border/50">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2} />
                <p className="text-[0.72rem] leading-relaxed text-secondary-foreground/90">
                  {suggestion.rationale}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <CompareStat label="Form" out={playerOut.form} inn={playerIn.form} />
                <CompareStat
                  label="Fixtures"
                  out={suggestion.player_out_fixtures_msg || 'Mixed'}
                  inn={suggestion.player_in_fixtures_msg || 'Good'}
                />
                <CompareStat
                  label="Price"
                  out={`£${(playerOut.now_cost / 10).toFixed(1)}m`}
                  inn={`£${(playerIn.now_cost / 10).toFixed(1)}m`}
                />
                <div className="rounded-md bg-secondary/40 p-2.5 ring-1 ring-border/50">
                  <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
                    Bank after
                  </div>
                  <div className="mt-1 text-xs font-semibold tabular-nums">
                    £{suggestion.bank_after.toFixed(1)}m
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({suggestion.cost_change > 0 ? '−' : '+'}£
                      {Math.abs(suggestion.cost_change).toFixed(1)}m)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SuggestionCard;
