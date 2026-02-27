/**
 * Individual transfer suggestion card
 */
import React from 'react';

const SuggestionCard = ({ suggestion, onReplace }) => {
  const playerOut = suggestion.player_out;
  const playerIn = suggestion.player_in;

  const priorityClass = {
    1: 'priority-high',
    2: 'priority-medium',
    3: 'priority-low',
  }[suggestion.priority] || 'priority-medium';

  const getPlayerImage = (code) => 
    `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`;

  const getTeamBadge = (code) => 
    `https://resources.premierleague.com/premierleague/badges/70/t${code}.png`;

  return (
    <div className={`suggestion-card ${priorityClass}`}>
      <div className="card-header-visual">
         <div className="priority-tag">Priority {suggestion.priority}</div>
         <div className="expected-gain">+{suggestion.expected_points_gain.toFixed(1)} pts</div>
      </div>

      <div className="transfer-visuals">
        {/* Player Out */}
        <div className="player-visual out">
            <div className="player-card-header">
                <span className="action-label">OUT</span>
                <span className="player-price">£{(playerOut.now_cost / 10).toFixed(1)}m</span>
            </div>
            <div className="player-image-container">
                <img 
                    src={getPlayerImage(playerOut.code)} 
                    alt={playerOut.web_name} 
                    className="player-face"
                    onError={(e) => e.target.src = 'https://resources.premierleague.com/premierleague/photos/players/250x250/p0.png'}
                />
                <img 
                    src={getTeamBadge(playerOut.team_code)} 
                    alt={playerOut.team_name} 
                    className="team-badge-mini"
                />
            </div>
            <div className="player-name">{playerOut.web_name}</div>
            <div className="player-meta">{playerOut.position} • {playerOut.team_name}</div>
        </div>

        {/* Arrow */}
        <div className="transfer-arrow">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </div>

        {/* Player In */}
        <div className="player-visual in">
            <div className="player-card-header">
                <span className="action-label">IN</span>
                <span className="player-price">£{(playerIn.now_cost / 10).toFixed(1)}m</span>
            </div>
            <div className="player-image-container">
                <img 
                    src={getPlayerImage(playerIn.code)} 
                    alt={playerIn.web_name} 
                    className="player-face"
                    onError={(e) => e.target.src = 'https://resources.premierleague.com/premierleague/photos/players/250x250/p0.png'}
                />
                <img 
                    src={getTeamBadge(playerIn.team_code)} 
                    alt={playerIn.team_name} 
                    className="team-badge-mini"
                />
            </div>
            <div className="player-name">{playerIn.web_name}</div>
            <div className="player-meta">{playerIn.position} • {playerIn.team_name}</div>
        </div>
      </div>

      <div className="rationale-box">
        <h4>AI Rationale</h4>
        <p>{suggestion.rationale}</p>
      </div>

      <div className="stats-comparison">
        <div className="stat-row">
            <span className="stat-label">Form</span>
            <span className="stat-val out">{playerOut.form}</span>
            <span className="stat-val in">{playerIn.form}</span>
        </div>
        <div className="stat-row">
            <span className="stat-label">Fixtures</span>
            <span className="stat-val out">{suggestion.player_out_fixtures_msg || 'Mixed'}</span>
            <span className="stat-val in">{suggestion.player_in_fixtures_msg || 'Good'}</span>
        </div>
      </div>
      
      {suggestion.captain_name && (
        <div className="captaincy-recommendation">
          <h4>Captaincy Picks</h4>
          <div className="captain-picks">
            <div className="pick">
              <span className="role-badge cap">C</span> 
              <span>{suggestion.captain_name}</span>
            </div>
            {suggestion.vice_captain_name && (
              <div className="pick">
                <span className="role-badge vice">VC</span> 
                <span>{suggestion.vice_captain_name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="financial-summary">
           <span>Bank change: {suggestion.cost_change > 0 ? '-' : '+'}£{Math.abs(suggestion.cost_change).toFixed(1)}m</span>
           <span>Remaining: £{suggestion.bank_after.toFixed(1)}m</span>
      </div>

      {onReplace && (
        <div className="card-actions-bottom">
           <button 
               className="replace-btn" 
               onClick={() => onReplace(suggestion)}
               title="Request a completely different transfer option to replace this one."
           >
               <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                   <polyline points="23 4 23 10 17 10"></polyline>
                   <polyline points="1 20 1 14 7 14"></polyline>
                   <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
               </svg>
               Replace this option
           </button>
        </div>
      )}
    </div>
  );
};

export default SuggestionCard;
