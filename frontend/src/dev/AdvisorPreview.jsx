/**
 * Renders the rebuilt Advisor pieces against mock data: suggestion cards, the
 * chat shell, and each branch of the approval modal.
 */
import React, { useState } from 'react';
import '@/styles/theme.css';
import { Button } from '@/components/ui/button';
import SuggestionList from '@/components/Transfers/SuggestionList';
import ApprovalModal from '@/components/Transfers/ApprovalModal';

const P = (id, code, name, pos, team, teamCode, cost, form) => ({
  id, code, web_name: name, position: pos, team_name: team, team_code: teamCode,
  now_cost: cost, form,
});

const SUGGESTIONS = [
  {
    priority: 1,
    expected_points_gain: 7.5,
    rationale:
      'Ajayi is in excellent form with 10.0 PPG and strong xGI. Maguire is underperforming at 2.5 points per game and faces a difficult run.',
    player_out: P(418, 95658, 'Maguire', 'DEF', 'Man Utd', 1, 50, '2.5'),
    player_in: P(279, 146426, 'Ajayi', 'DEF', 'Hull City', 88, 41, '10.0'),
    player_out_fixtures_msg: 'Tough run',
    player_in_fixtures_msg: 'Favourable',
    captain_name: 'Haaland',
    vice_captain_name: 'B.Fernandes',
    cost_change: -0.9,
    bank_after: 1.0,
  },
  {
    priority: 2,
    expected_points_gain: 4.2,
    rationale:
      'Van Hecke offers a cheaper route into the Brighton defence, freeing funds for a midfield upgrade next week.',
    player_out: P(112, 445122, 'Van Hecke', 'DEF', 'Spurs', 6, 50, '1.5'),
    player_in: P(115, 465351, 'De Cuyper', 'DEF', 'Brighton', 36, 47, '5.0'),
    cost_change: -0.3,
    bank_after: 0.4,
  },
  {
    priority: 3,
    expected_points_gain: 2.8,
    rationale: 'A straight swap for form: Kudus is on penalties and set pieces.',
    player_out: P(300, 200002, 'Szoboszlai', 'MID', 'Liverpool', 14, 65, '3.0'),
    player_in: P(301, 200001, 'Kudus', 'MID', 'West Ham', 21, 64, '6.5'),
    cost_change: 0.1,
    bank_after: 0.3,
  },
];

const TRANSFERS_INFO = {
  none: { limit: 1, made: 1, cost: 4 },
  free: { limit: 2, made: 0, cost: 4 },
  unknown: { error: '403 Forbidden from my-team' },
};

export default function AdvisorPreview() {
  const [modal, setModal] = useState(null); // 'none' | 'free' | 'unknown'

  return (
    <div className="ui-root min-h-screen bg-background p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Advisor preview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suggestion cards and every approval-modal branch, on mock data.
          </p>
        </header>

        <section>
          <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Suggestion rail
          </h2>
          <SuggestionList
            suggestions={SUGGESTIONS}
            loading={false}
            embedded
            onReplace={() => {}}
            onExecute={() => setModal('none')}
          />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Approval modal branches
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => setModal('none')}>
              No free transfers (-4)
            </Button>
            <Button onClick={() => setModal('free')}>Free transfer available</Button>
            <Button variant="outline" onClick={() => setModal('unknown')}>
              Count unavailable
            </Button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Loading state
          </h2>
          <SuggestionList suggestions={[]} loading embedded />
        </section>

        {modal && (
          <ApprovalModal
            suggestion={SUGGESTIONS[0]}
            gameweek={3}
            transfersInfo={TRANSFERS_INFO[modal]}
            onConfirm={async () => setModal(null)}
            onCancel={() => setModal(null)}
          />
        )}
      </div>
    </div>
  );
}
