import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'h-10 w-full rounded-md bg-card px-3 text-sm text-foreground ring-1 ring-input',
      'placeholder:text-muted-foreground/70',
      'transition-[box-shadow,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-md bg-card px-3 py-2 text-sm text-foreground ring-1 ring-input',
      'placeholder:text-muted-foreground/70',
      'transition-[box-shadow,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

function Label({ className, ...props }) {
  return (
    <label
      className={cn(
        'text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export { Input, Textarea, Label };
