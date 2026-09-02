/**
 * Dev-only preview harness. Renders the new primitives and the rebuilt screens
 * against mock data, so the UI can be reviewed without a live FPL session.
 * Reachable at http://localhost:5173/?ui-preview — not bundled into any route.
 */
import React, { useState } from 'react';
import '@/styles/theme.css';
import {
  ArrowRight, TrendingUp, TrendingDown, Minus, Star, Wallet, Trophy,
  AlertTriangle, CheckCircle2, HelpCircle, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Stat } from '@/components/ui/stat';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function UiPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="ui-root min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            UI primitives
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tailwind v4 + shadcn tokens. Press any button to check the scale-96 cue.
          </p>
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">
              Large <ArrowRight strokeWidth={2} />
            </Button>
            <Button size="icon" variant="outline" aria-label="Star">
              <Star strokeWidth={2} />
            </Button>
            <Button static variant="secondary">No press scale</Button>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="primary">
              <TrendingUp strokeWidth={2} /> Rising
            </Badge>
            <Badge variant="destructive">
              <TrendingDown strokeWidth={2} /> Falling
            </Badge>
            <Badge variant="warning">Captain</Badge>
            <Badge variant="info">DGW</Badge>
            <Badge variant="outline">
              <Minus strokeWidth={2} /> Stable
            </Badge>
          </div>
        </Section>

        <Section title="Stat tiles">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Points" value="115" icon={Trophy} tone="primary" hint="GW3" />
            <Stat label="Overall rank" value="102,982" icon={TrendingUp} />
            <Stat label="Team value" value="£100.3m" icon={Wallet} />
            <Stat label="Bank" value="£0.1m" icon={Wallet} tone="muted" />
          </div>
        </Section>

        <Section title="Cards, concentric radius">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Squad</CardTitle>
                <CardDescription>Outer radius lg, inner rows md, padding 4</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {['Verbruggen', 'Saliba', 'B.Fernandes'].map((n) => (
                  <div
                    key={n}
                    className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm ring-1 ring-border/50"
                  >
                    <span className="font-medium">{n}</span>
                    <span className="tabular-nums text-muted-foreground">£5.0m</span>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="secondary">
                  View all
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Loading state</CardTitle>
                <CardDescription>Skeletons match final layout</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-2/3" />
                <Separator className="my-3" />
                <div className="flex gap-2">
                  <Skeleton className="size-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="pitch">
            <TabsList>
              <TabsTrigger value="pitch">Pitch</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="watchlist">
                <Star strokeWidth={2} /> Watchlist
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pitch" className="mt-3 text-sm text-muted-foreground">
              Pitch view content.
            </TabsContent>
            <TabsContent value="list" className="mt-3 text-sm text-muted-foreground">
              List view content.
            </TabsContent>
            <TabsContent value="watchlist" className="mt-3 text-sm text-muted-foreground">
              Watchlist content.
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Transfer cost notices">
          <div className="space-y-2">
            <div className="flex items-start gap-2.5 rounded-md bg-destructive/10 p-3 text-xs leading-relaxed text-destructive ring-1 ring-destructive/25">
              <AlertTriangle className="mt-px size-4 shrink-0" strokeWidth={2} />
              <span>
                No free transfers left this gameweek, so this costs a{' '}
                <strong className="font-bold">-4 point hit</strong>. Net expected gain:{' '}
                <strong className="font-bold tabular-nums">3.5 pts</strong>.
              </span>
            </div>
            <div className="flex items-start gap-2.5 rounded-md bg-primary/10 p-3 text-xs leading-relaxed text-primary ring-1 ring-primary/25">
              <CheckCircle2 className="mt-px size-4 shrink-0" strokeWidth={2} />
              <span>
                Uses <strong className="font-bold">1 of your 2 free transfers</strong> — no points hit.
              </span>
            </div>
            <div className="flex items-start gap-2.5 rounded-md bg-warning/10 p-3 text-xs leading-relaxed text-warning ring-1 ring-warning/25">
              <HelpCircle className="mt-px size-4 shrink-0" strokeWidth={2} />
              <span>Free-transfer count unavailable — this could cost a -4 hit.</span>
            </div>
          </div>
        </Section>

        <Section title="Dialog">
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            <Sparkles strokeWidth={2} /> Open confirmation
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm transfer</DialogTitle>
                <DialogDescription>Gameweek 3</DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center gap-4 px-5 pb-4">
                <div className="text-center">
                  <div className="text-[0.65rem] font-bold uppercase tracking-wider text-destructive">
                    Out
                  </div>
                  <div className="mt-1 text-sm font-bold">Van Hecke</div>
                  <div className="tabular-nums text-xs text-muted-foreground">£5.0m</div>
                </div>
                <ArrowRight className="size-5 text-muted-foreground" strokeWidth={2} />
                <div className="text-center">
                  <div className="text-[0.65rem] font-bold uppercase tracking-wider text-primary">
                    In
                  </div>
                  <div className="mt-1 text-sm font-bold">De Cuyper</div>
                  <div className="tabular-nums text-xs text-muted-foreground">£4.7m</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>
      </div>
    </div>
  );
}
