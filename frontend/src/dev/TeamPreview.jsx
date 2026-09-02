/**
 * Renders the real TeamView against the live backend using a stub cookie. The
 * backend falls back to public historical picks when my-team is unavailable, so
 * this shows real squad shapes without needing an authenticated FPL session.
 */
import React, { useState } from 'react';
import '@/styles/theme.css';
import { setFPLCookie } from '@/services/api';
import TeamView from '@/components/Team/TeamView';

setFPLCookie('pl_profile=preview; csrftoken=preview');

const MANAGER_ID = 6440973;

export default function TeamPreview() {
  const [watchlist, setWatchlist] = useState([]);

  return (
    <div className="ui-root min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-6">
        <TeamView
          managerId={MANAGER_ID}
          onGetSuggestions={() => {}}
          watchlist={watchlist}
          setWatchlist={setWatchlist}
          onTeamLoaded={() => {}}
        />
      </div>
    </div>
  );
}
