import { AnimatePresence, motion } from 'motion/react';
import {
  Eye, Scale, X, TrendingUp, TrendingDown, Minus, HelpCircle, MousePointerClick,
  Bot, LineChart, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkline } from '@/components/ui/sparkline';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { getPlayerImageUrl, handlePlayerImageError } from '@/utils/playerImage';
import {
  formTone, FORM_TONE_TEXT, getFormTrend, getPriceMovement, money,
} from './teamHelpers';

const PRICE_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus };
const PRICE_TONE = {
  up: 'text-primary',
  down: 'text-destructive',
  stable: 'text-muted-foreground',
};

const HELP_ITEMS = [
  {
    icon: MousePointerClick,
    title: 'Add to watchlist',
    body: 'Click any player card to add or remove them.',
  },
  {
    icon: Bot,
    title: 'Shared with the AI',
    body: 'Watched players are passed to the advisor and factored into suggestions.',
  },
  {
    icon: TrendingUp,
    title: 'Price alerts',
    body: 'Predicted price moves from net transfer activity this gameweek.',
  },
  {
    icon: LineChart,
    title: 'Form trend',
    body: 'Derived from form and points-per-game — a shape indicator, not match history.',
  },
  {
    icon: Scale,
    title: 'Compare',
    body: 'Turn on Compare, then pick two squad players for a side-by-side.',
  },
  {
    icon: Save,
    title: 'Saved locally',
    body: 'Your watchlist survives closing the browser.',
  },
];

function WatchlistHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="About the watchlist">
          <HelpCircle strokeWidth={2} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Watchlist</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 p-5 pt-0 sm:grid-cols-2">
          {HELP_ITEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-2.5 rounded-md bg-secondary/40 p-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
              <div>
                <div className="text-xs font-bold">{title}</div>
                <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WatchlistRow({ player, onRemove }) {
  const price = getPriceMovement(player);
  const PriceIcon = PRICE_ICON[price.direction];
  const tone = formTone(player.form);

  return (
    <div className="flex items-center gap-3 rounded-md bg-secondary/40 p-2.5 ring-1 ring-border/50">
      <img
        src={getPlayerImageUrl(player.code)}
        alt=""
        onError={handlePlayerImageError(player)}
        className="h-10 shrink-0 object-contain"
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold">{player.web_name}</div>
        <div className="truncate text-[0.65rem] text-muted-foreground">
          {player.position} · {player.team_name} · {money(player.now_cost)}
        </div>
      </div>

      <div className="hidden items-center gap-4 sm:flex">
        <div className="text-center">
          <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
            Form
          </div>
          <div className={cn('text-xs font-bold tabular-nums', FORM_TONE_TEXT[tone])}>
            {player.form}
          </div>
        </div>

        <div className={cn('text-center', FORM_TONE_TEXT[tone])}>
          <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
            Trend
          </div>
          <Sparkline values={getFormTrend(player)} width={56} height={18} />
        </div>

        <div className="text-center" title={price.detail}>
          <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
            Price
          </div>
          <div
            className={cn(
              'flex items-center gap-1 text-[0.7rem] font-bold',
              PRICE_TONE[price.direction]
            )}
          >
            <PriceIcon className="size-3" strokeWidth={2} />
            {price.label}
          </div>
        </div>

        <div className="text-center">
          <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
            Pts
          </div>
          <div className="text-xs font-bold tabular-nums">{player.total_points}</div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label={`Remove ${player.web_name} from watchlist`}
      >
        <X strokeWidth={2} />
      </Button>
    </div>
  );
}

export function WatchlistPanel({
  watchlist,
  onRemove,
  compareMode,
  onToggleCompare,
  compareA,
  compareB,
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 p-4 pb-3">
        <div className="flex items-center gap-1.5">
          <Eye className="size-4 text-info" strokeWidth={2} />
          <h3 className="font-display text-sm font-bold tracking-tight">Watchlist</h3>
          <WatchlistHelp />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={compareMode ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleCompare}
          >
            <Scale strokeWidth={2} />
            {compareMode ? 'Exit compare' : 'Compare'}
          </Button>
          <Badge variant="outline">{watchlist.length}</Badge>
        </div>
      </div>

      {compareMode && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-md bg-info/10 p-2.5 text-[0.7rem] text-info ring-1 ring-info/25">
          <Scale className="size-3.5 shrink-0" strokeWidth={2} />
          <span>Pick two squad players to compare.</span>
          {compareA && <Badge variant="info">1 · {compareA.web_name}</Badge>}
          {compareB && <Badge variant="info">2 · {compareB.web_name}</Badge>}
        </div>
      )}

      <CardContent>
        {watchlist.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-md bg-secondary/30 px-4 py-8 text-center">
            <Eye className="size-5 text-muted-foreground" strokeWidth={2} />
            <p className="text-xs font-medium">Click any player card to watch them</p>
            <p className="text-[0.68rem] text-muted-foreground">
              Watched players are shared with the AI advisor
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false} mode="popLayout">
              {watchlist.map((player) => (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                >
                  <WatchlistRow player={player} onRemove={() => onRemove(player)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
