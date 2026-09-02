import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // scale-96 on press is the tactile cue; transition names only what changes.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold outline-none transition-[background-color,border-color,color,box-shadow,scale] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 not-data-static:active:scale-96",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-raised hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-raised hover:bg-destructive/90',
        outline: 'border border-input bg-transparent hover:bg-secondary/60',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-secondary/60',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 [&_svg]:size-4',
        sm: 'h-8 rounded-sm px-3 text-xs [&_svg]:size-3.5',
        lg: 'h-12 rounded-lg px-6 text-base [&_svg]:size-5',
        icon: 'size-10 [&_svg]:size-4',
        'icon-sm': 'size-8 rounded-sm [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, static: isStatic, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        data-static={isStatic ? '' : undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
