/**
 * Transfer suggestions, as a ranked vertical list. All options are visible at
 * once so the ranking reads top to bottom; each row expands for its rationale.
 * Captaincy is squad-level advice, so it is hoisted out of the rows and shown
 * once above the list.
 */
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Inbox } from 'lucide-react';
import { BallLoader } from '@/components/ui/football';
import { Badge } from '@/components/ui/badge';
import SuggestionCard from './SuggestionCard';

const keyOf = (s) => `${s.player_out?.id}-${s.player_in?.id}`;

const SuggestionList = ({ suggestions, loading, embedded = false, onReplace, onExecute }) => {
  const [expandedKey, setExpandedKey] = useState(null);

  if (loading) {
    return (
      <div className="ui-root space-y-2">
        <BallLoader label="Analyzing your team with AI — this can take 10–20 seconds…" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[68px] animate-pulse rounded-lg bg-secondary/70" />
        ))}
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="ui-root flex items-center gap-2 rounded-md bg-secondary/40 p-4 text-xs text-muted-foreground ring-1 ring-border/50">
        <Inbox className="size-4" strokeWidth={2} />
        No suggestions available
      </div>
    );
  }

  // The captaincy pick is generated once per suggestion set; surface it once.
  const captaincy = suggestions.find((s) => s.captain_name);

  return (
    <div className="ui-root">
      {!embedded && (
        <div className="mb-3">
          <h2 className="font-display text-lg font-bold tracking-tight">Transfer suggestions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ranked by expected points gain from form, fixtures and value.
          </p>
        </div>
      )}

      {captaincy && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">
            Captaincy
          </span>
          <Badge variant="warning">C · {captaincy.captain_name}</Badge>
          {captaincy.vice_captain_name && <Badge>VC · {captaincy.vice_captain_name}</Badge>}
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={keyOf(suggestion)}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0, delay: index * 0.05 }}
            >
              <SuggestionCard
                suggestion={suggestion}
                rank={index + 1}
                expanded={expandedKey === keyOf(suggestion)}
                onToggle={() =>
                  setExpandedKey((k) => (k === keyOf(suggestion) ? null : keyOf(suggestion)))
                }
                onReplace={onReplace}
                onExecute={onExecute}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SuggestionList;
