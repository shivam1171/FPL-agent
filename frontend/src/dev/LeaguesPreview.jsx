/** Renders LeaguesView against the live backend's public endpoints. */
import React from 'react';
import '@/styles/theme.css';
import { setFPLCookie } from '@/services/api';
import LeaguesView from '@/components/Leagues/LeaguesView';

setFPLCookie('pl_profile=preview; csrftoken=preview');

export default function LeaguesPreview() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-6">
        <LeaguesView managerId={6440973} />
      </div>
    </div>
  );
}
