import { cn } from '@/lib/utils';

/**
 * Compact metric tile. Label above value, tabular figures so digits do not
 * jitter when values update.
 */
function Stat({ label, value, hint, tone = 'default', icon: Icon, className }) {
  const toneClass = {
    default: 'text-foreground',
    primary: 'text-primary',
    destructive: 'text-destructive',
    warning: 'text-warning',
    muted: 'text-muted-foreground',
  }[tone];

  return (
    <div className={cn('rounded-md bg-secondary/40 p-3 ring-1 ring-border/50', className)}>
      <div className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="size-3" strokeWidth={2} />}
        {label}
      </div>
      <div className={cn('mt-1 font-display text-lg font-bold tabular-nums', toneClass)}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[0.65rem] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export { Stat };
