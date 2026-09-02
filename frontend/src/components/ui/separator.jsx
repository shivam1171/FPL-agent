import { cn } from '@/lib/utils';

// Borders that communicate structure are kept as borders, per better-ui.
function Separator({ className, orientation = 'horizontal', ...props }) {
  return (
    <div
      role="separator"
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      {...props}
    />
  );
}

export { Separator };
