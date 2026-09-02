/**
 * Transfer approval confirmation modal
 */
import React, { useState } from 'react';
import {
  ArrowRight, AlertTriangle, CheckCircle2, HelpCircle, Loader2, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { getPlayerImageUrl, handlePlayerImageError } from '@/utils/playerImage';

const teamBadge = (code) =>
  `https://resources.premierleague.com/premierleague/badges/70/t${code}.png`;

function Notice({ tone, icon: Icon, children }) {
  const tones = {
    destructive: 'bg-destructive/10 text-destructive ring-destructive/25',
    primary: 'bg-primary/10 text-primary ring-primary/25',
    warning: 'bg-warning/10 text-warning ring-warning/25',
  };
  return (
    <div
      className={cn(
        'mx-5 flex items-start gap-2.5 rounded-md p-3 text-xs leading-relaxed ring-1',
        tones[tone]
      )}
    >
      <Icon className="mt-px size-4 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}

function Side({ player, direction }) {
  const out = direction === 'out';
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span
        className={cn(
          'text-[0.6rem] font-bold uppercase tracking-widest',
          out ? 'text-destructive' : 'text-primary'
        )}
      >
        {out ? 'Out' : 'In'}
      </span>
      <div className="relative">
        <img
          src={getPlayerImageUrl(player.code)}
          alt=""
          onError={handlePlayerImageError(player)}
          className={cn(
            'h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.22)]',
            out && 'saturate-50'
          )}
        />
        <img
          src={teamBadge(player.team_code)}
          alt=""
          className="absolute -bottom-1 -right-1 size-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
        />
      </div>
      <div className="text-sm font-bold">{player.web_name}</div>
      <div className="text-[0.65rem] text-muted-foreground">
        {player.position} · {player.team_name}
      </div>
      <div className="text-xs font-bold tabular-nums text-muted-foreground">
        £{(player.now_cost / 10).toFixed(1)}m
      </div>
    </div>
  );
}

const ApprovalModal = ({ suggestion, gameweek, transfersInfo = null, onConfirm, onCancel }) => {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setExecuting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || 'Transfer failed. Please try again.');
      setExecuting(false);
    }
  };

  const playerOut = suggestion.player_out;
  const playerIn = suggestion.player_in;

  // FPL charges hitCost points per transfer beyond the free allowance.
  // transfersInfo comes straight from /api/my-team: { limit, made, cost }.
  const ftLimit = transfersInfo?.limit;
  const ftKnown = !transfersInfo?.error && ftLimit != null;
  const freeRemaining = ftKnown ? Math.max(0, ftLimit - (transfersInfo.made || 0)) : null;
  const hitCost = transfersInfo?.cost ?? 4;
  const costsHit = ftKnown && freeRemaining === 0;

  return (
    <Dialog open onOpenChange={(open) => !open && !executing && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm transfer</DialogTitle>
          <DialogDescription>Gameweek {gameweek}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-6 px-5 pb-4">
          <Side player={playerOut} direction="out" />
          <ArrowRight className="size-6 shrink-0 text-muted-foreground" strokeWidth={2} />
          <Side player={playerIn} direction="in" />
        </div>

        <div className="mx-5 mb-3 space-y-1 rounded-md bg-secondary/40 p-3 ring-1 ring-border/50">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Expected points gain</span>
            <strong className="tabular-nums text-primary">
              +{suggestion.expected_points_gain.toFixed(1)} pts
            </strong>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Bank after transfer</span>
            <strong className="tabular-nums">£{suggestion.bank_after.toFixed(1)}m</strong>
          </div>
        </div>

        <div className="space-y-2">
          {costsHit && (
            <Notice tone="destructive" icon={AlertTriangle}>
              You have <strong>no free transfers left</strong> this gameweek, so this will cost
              a <strong>-{hitCost} point hit</strong>.
              {suggestion.expected_points_gain != null && (
                <>
                  {' '}
                  Net expected gain:{' '}
                  <strong className="tabular-nums">
                    {(suggestion.expected_points_gain - hitCost).toFixed(1)} pts
                  </strong>
                  .
                </>
              )}
            </Notice>
          )}

          {ftKnown && freeRemaining > 0 && (
            <Notice tone="primary" icon={CheckCircle2}>
              This uses{' '}
              <strong>
                1 of your {freeRemaining} free transfer{freeRemaining === 1 ? '' : 's'}
              </strong>{' '}
              — no points hit.
            </Notice>
          )}

          {!ftKnown && (
            <Notice tone="warning" icon={HelpCircle}>
              Your free-transfer count is <strong>unavailable</strong>
              {transfersInfo?.error ? ' (session may have expired)' : ''}, so this could cost a{' '}
              <strong>-{hitCost} hit</strong>. Check the FPL site if unsure.
            </Notice>
          )}

          <Notice tone="warning" icon={AlertTriangle}>
            This makes a <strong>live transfer</strong> in your FPL team. It cannot be undone
            before the gameweek deadline.
          </Notice>

          {error && (
            <Notice tone="destructive" icon={AlertTriangle}>
              {error}
            </Notice>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button variant="ghost" onClick={onCancel} disabled={executing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={executing}>
            {executing ? (
              <>
                <Loader2 className="animate-spin" strokeWidth={2} />
                Executing…
              </>
            ) : (
              <>
                <Check strokeWidth={2} />
                Confirm transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalModal;
