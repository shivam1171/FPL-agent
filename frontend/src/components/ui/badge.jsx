import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        primary: 'bg-primary/15 text-primary',
        destructive: 'bg-destructive/15 text-destructive',
        warning: 'bg-warning/15 text-warning',
        info: 'bg-info/15 text-info',
        outline: 'ring-1 ring-border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
