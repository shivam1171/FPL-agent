import { useEffect, useState } from 'react';

/** Live countdown to an ISO deadline. Returns null when there is nothing to count. */
export function useDeadlineTimer(deadlineIso) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!deadlineIso) {
      setTimeLeft(null);
      return;
    }
    const deadline = new Date(deadlineIso);
    if (Number.isNaN(deadline.getTime())) {
      setTimeLeft(null);
      return;
    }
    const tick = () => {
      const diff = deadline - new Date();
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0, expired: true });
        return;
      }
      setTimeLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        expired: false,
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineIso]);

  return timeLeft;
}

/** First gameweek in the intelligence payload whose deadline is still ahead. */
export function findNextDeadlineGw(gwIntel) {
  const details = gwIntel?.gameweek_details;
  if (!Array.isArray(details)) return null;
  const now = Date.now();
  return (
    details.find((d) => d?.deadline_time && new Date(d.deadline_time).getTime() > now) || null
  );
}

/** Predicted price movement from this gameweek's net transfer activity. */
export function getPriceMovement(player) {
  const net = (player.transfers_in_event || 0) - (player.transfers_out_event || 0);
  const k = `${net >= 0 ? '+' : ''}${(net / 1000).toFixed(0)}k net transfers`;
  if (net > 50000) return { direction: 'up', label: 'Rising', detail: k };
  if (net > 20000) return { direction: 'up', label: 'Likely rise', detail: k };
  if (net < -50000) return { direction: 'down', label: 'Falling', detail: k };
  if (net < -20000) return { direction: 'down', label: 'Likely drop', detail: k };
  return { direction: 'stable', label: 'Stable', detail: k };
}

/** Tone for a form value, shared by every surface that colours form. */
export function formTone(form) {
  const f = parseFloat(form || 0);
  if (f >= 5) return 'primary';
  if (f >= 3) return 'warning';
  return 'destructive';
}

export const FORM_TONE_TEXT = {
  primary: 'text-primary',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

export const FORM_TONE_BG = {
  primary: 'bg-primary',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

/** Form bar fill percentage, clamped so a zero-form player still shows a sliver. */
export function formPercent(form) {
  const f = parseFloat(form || 0);
  if (f >= 6) return Math.min(f * 10, 100);
  if (f >= 4) return Math.min(f * 12, 100);
  if (f >= 2) return Math.min(f * 15, 100);
  return Math.max(f * 20, 5);
}

/**
 * Five-point trend for the sparkline. FPL's bootstrap payload carries no
 * per-gameweek history, so this is derived from form and points-per-game — a
 * shape indicator, not real match data.
 */
export function getFormTrend(player) {
  const form = parseFloat(player.form || 0);
  const ppg = parseFloat(player.points_per_game || 0);
  const baseline = ppg * 0.8;
  return [
    Math.max(baseline * 0.7, 0.5),
    Math.max(baseline * 0.9, 0.5),
    Math.max(ppg, 0.5),
    Math.max((form + ppg) / 2, 0.5),
    Math.max(form, 0.5),
  ];
}

export const AVAILABILITY = {
  i: { label: 'Injured', tone: 'destructive' },
  s: { label: 'Suspended', tone: 'destructive' },
  d: { label: 'Doubtful', tone: 'warning' },
  u: { label: 'Unavailable', tone: 'default' },
  n: { label: 'Not eligible', tone: 'default' },
};

export function availabilityFor(status) {
  return AVAILABILITY[status] || { label: 'Unavailable', tone: 'default' };
}

export function teamBadgeUrl(teamCode) {
  return `https://resources.premierleague.com/premierleague/badges/70/t${teamCode}.png`;
}

export const money = (tenths) => `£${(tenths / 10).toFixed(1)}m`;
