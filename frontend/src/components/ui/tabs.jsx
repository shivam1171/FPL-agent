import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

// Concentric: list padding 4px (p-1), so inner radius = outer(md) - 4px = sm.
const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1 rounded-md bg-secondary/50 p-1 ring-1 ring-border/60',
      className
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold',
      'text-muted-foreground transition-[background-color,color,box-shadow,scale] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
      'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      'active:scale-96 disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-raised',
      '[&_svg]:size-3.5',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
