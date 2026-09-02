/**
 * Chip Advisor component — displays chip status, DGW/BGW intelligence,
 * and provides AI-powered chip strategy recommendations.
 */
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  Bot, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Clock, Crown,
  Loader2, Rocket, Sparkles, Target, TriangleAlert, TrendingUp, XCircle, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { transferAPI } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const CHIP_META = {
  wildcard: { icon: Rocket, name: 'Wildcard', desc: 'Unlimited free transfers for one gameweek' },
  freehit: { icon: Zap, name: 'Free Hit', desc: 'Temporary squad for one gameweek only' },
  bboost: { icon: TrendingUp, name: 'Bench Boost', desc: 'All 15 players score points' },
  '3xc': { icon: Crown, name: 'Triple Captain', desc: 'Captain scores 3× points' },
};

function GwIntelPanel({ gwDetails }) {
  const notable = gwDetails.filter((gw) => gw.is_double || gw.is_blank);
  if (notable.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={2} />
        <h4 className="text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">
          Gameweek intelligence
        </h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {notable.map((gw) => (
          <div
            key={gw.gameweek}
            className="rounded-md bg-secondary/50 p-2.5 text-[0.7rem] ring-1 ring-border/50"
          >
            <div className="flex items-center gap-1.5">
              <span className="font-bold">
                {gw.is_current ? 'This GW' : gw.is_next ? 'Next GW' : `GW${gw.gameweek}`}
              </span>
              {gw.is_double && <Badge variant="info">Double</Badge>}
              {gw.is_blank && <Badge variant="warning">Blank</Badge>}
            </div>
            {gw.teams_with_double?.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                2 fixtures: {gw.teams_with_double.join(', ')}
              </p>
            )}
            {gw.teams_with_blank?.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                No fixture: {gw.teams_with_blank.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SquadPanel({ rec }) {
  if (!rec.squad || rec.squad.length === 0) return null;
  return (
    <div className="rounded-lg bg-secondary/40 p-4 ring-1 ring-border/50">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-bold">Suggested squad ({rec.squad.length})</h4>
        {rec.total_cost != null && (
          <span className="text-[0.68rem] tabular-nums text-muted-foreground">
            £{rec.total_cost.toFixed(1)}m
            {rec.bank_remaining != null && ` · bank £${rec.bank_remaining.toFixed(1)}m`}
          </span>
        )}
      </div>

      {['GKP', 'DEF', 'MID', 'FWD'].map((pos) => {
        const posPlayers = rec.squad.filter((p) => p.position === pos);
        if (posPlayers.length === 0) return null;
        return (
          <div key={pos} className="mt-3">
            <div className="mb-1 text-[0.6rem] font-bold uppercase tracking-widest text-muted-foreground">
              {pos}
            </div>
            <div className="space-y-1">
              {posPlayers.map((player, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-md bg-card px-2.5 py-1.5 ring-1 ring-border/50',
                    !player.is_starter && 'opacity-70'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      {player.is_captain && <Badge variant="warning" className="px-1 py-0">C</Badge>}
                      {player.is_vice_captain && <Badge className="px-1 py-0">VC</Badge>}
                      {player.player_name}
                      {!player.is_starter && (
                        <span className="text-[0.6rem] font-bold uppercase text-muted-foreground">
                          Bench
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[0.7rem] tabular-nums text-muted-foreground">
                      £{player.cost?.toFixed(1)}m · form {player.form}
                    </span>
                  </div>
                  {player.rationale && (
                    <p className="mt-0.5 text-[0.65rem] leading-relaxed text-muted-foreground">
                      {player.rationale}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ChipAdvisor = ({ managerId, gameweek, chipStatus, gwIntelligence }) => {
  const [analyzing, setAnalyzing] = useState(null);
  const [recommendations, setRecommendations] = useState({});
  const [expandedChip, setExpandedChip] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async (chipName) => {
    setAnalyzing(chipName);
    setError(null);
    try {
      const result = await transferAPI.getChipAdvice(managerId, chipName);
      if (result.success && result.chip_recommendation) {
        setRecommendations((prev) => ({ ...prev, [chipName]: result.chip_recommendation }));
        setExpandedChip(chipName);
      } else {
        setError(`Failed to analyze ${CHIP_META[chipName]?.name || chipName}`);
      }
    } catch (err) {
      console.error('Chip advice error:', err);
      setError(err?.response?.data?.detail || 'Failed to get chip advice');
    } finally {
      setAnalyzing(null);
    }
  };

  const chips = chipStatus?.chips || [];
  const availableChipNames = chipStatus?.available_chips || [];
  const gwDetails = gwIntelligence?.gameweek_details || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <Target className="size-4 text-primary" strokeWidth={2} />
        <h3 className="font-display text-sm font-bold tracking-tight">Chip strategy</h3>
        <span className="text-[0.7rem] text-muted-foreground">
          — recommendations from your squad, fixtures and upcoming gameweeks
        </span>
      </div>

      <GwIntelPanel gwDetails={gwDetails} />

      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(CHIP_META).map(([key, meta]) => {
          const isAvailable = availableChipNames.includes(key);
          const rec = recommendations[key];
          const isExpanded = expandedChip === key;
          const isAnalyzing = analyzing === key;
          const Icon = meta.icon;

          return (
            <Card key={key} className={cn('stagger-item p-4', !isAvailable && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <Icon className="size-4" strokeWidth={2} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{meta.name}</h4>
                    <p className="text-[0.68rem] text-muted-foreground">{meta.desc}</p>
                  </div>
                </div>
                {isAvailable ? (
                  <Badge variant="primary">Available</Badge>
                ) : (
                  <Badge variant="outline">Used</Badge>
                )}
              </div>

              {isAvailable && (
                <Button
                  variant={rec ? 'outline' : 'secondary'}
                  size="sm"
                  className="mt-3 w-full"
                  disabled={isAnalyzing}
                  onClick={() =>
                    isExpanded && rec ? setExpandedChip(null) : rec ? setExpandedChip(key) : handleAnalyze(key)
                  }
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="animate-spin" strokeWidth={2} />
                      Analyzing…
                    </>
                  ) : isExpanded && rec ? (
                    <>
                      <ChevronUp strokeWidth={2} />
                      Collapse
                    </>
                  ) : rec ? (
                    <>
                      <ChevronDown strokeWidth={2} />
                      Show recommendation
                    </>
                  ) : (
                    <>
                      <Bot strokeWidth={2} />
                      Analyze {meta.name}
                    </>
                  )}
                </Button>
              )}

              <AnimatePresence initial={false}>
              {isExpanded && rec && (
                <motion.div
                  key="recommendation"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
                  className="overflow-hidden"
                >
                <div className="mt-3 space-y-3">
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-md p-3 ring-1',
                      rec.should_play
                        ? 'bg-primary/10 text-primary ring-primary/25'
                        : 'bg-secondary/60 text-secondary-foreground ring-border/50'
                    )}
                  >
                    {rec.should_play ? (
                      <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} />
                    ) : (
                      <Clock className="size-4 shrink-0" strokeWidth={2} />
                    )}
                    <strong className="text-xs">
                      {rec.should_play ? `Play ${meta.name} now` : `Save ${meta.name}`}
                    </strong>
                    {rec.confidence && (
                      <Badge variant="outline" className="ml-auto">
                        {rec.confidence} confidence
                      </Badge>
                    )}
                  </div>

                  <div className="text-[0.72rem] leading-relaxed text-muted-foreground [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-1.5 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc">
                    <ReactMarkdown>{rec.reasoning}</ReactMarkdown>
                  </div>

                  {rec.best_gameweek && !rec.should_play && (
                    <div className="flex items-center gap-2 rounded-md bg-info/10 p-2.5 text-xs text-info ring-1 ring-info/25">
                      <Sparkles className="size-3.5 shrink-0" strokeWidth={2} />
                      Best used in <strong>GW{rec.best_gameweek}</strong>
                    </div>
                  )}

                  {rec.validation_warnings && rec.validation_warnings.length > 0 && (
                    <div className="rounded-md bg-destructive/10 p-3 text-[0.7rem] leading-relaxed text-destructive ring-1 ring-destructive/25">
                      <strong className="flex items-center gap-1.5">
                        <TriangleAlert className="size-3.5" strokeWidth={2} />
                        This squad breaks FPL rules and is not submittable as-is:
                      </strong>
                      <ul className="ml-5 mt-1 list-disc">
                        {rec.validation_warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <SquadPanel rec={rec} />
                </div>
                </motion.div>
              )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive ring-1 ring-destructive/25">
          <XCircle className="mt-px size-4 shrink-0" strokeWidth={2} />
          {error}
        </div>
      )}
    </div>
  );
};

export default ChipAdvisor;
