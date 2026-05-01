/**
 * Transfer approval confirmation modal
 */
import React, { useState } from 'react';
import { getPlayerImageUrl, handlePlayerImageError } from '../../utils/playerImage';

const ApprovalModal = ({ suggestion, gameweek, onConfirm, onCancel }) => {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setExecuting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || 'Transfer failed. Please try again.');
      setExecuting(false);
    }
  };

  const playerOut = suggestion.player_out;
  const playerIn = suggestion.player_in;

  const getTeamBadge = (code) =>
    `https://resources.premierleague.com/premierleague/badges/70/t${code}.png`;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !executing && onCancel()}>
      <div className="modal-content approval-modal">
        <div className="approval-modal-header">
          <span className="approval-modal-icon">⚡</span>
          <div>
            <h2>Confirm Transfer</h2>
            {gameweek > 0 && <p className="approval-gw">Gameweek {gameweek}</p>}
          </div>
        </div>

        <div className="approval-players">
          {/* Player Out */}
          <div className="approval-player out">
            <div className="approval-player-img-wrap">
              <img
                src={getPlayerImageUrl(playerOut.code)}
                alt={playerOut.web_name}
                className="approval-player-img"
                onError={handlePlayerImageError(playerOut)}
              />
              <img src={getTeamBadge(playerOut.team_code)} alt="" className="approval-badge" />
            </div>
            <span className="approval-direction-label out-label">OUT</span>
            <strong className="approval-player-name">{playerOut.web_name}</strong>
            <span className="approval-player-meta">{playerOut.position} · {playerOut.team_name}</span>
            <span className="approval-player-price">£{(playerOut.now_cost / 10).toFixed(1)}m</span>
          </div>

          <div className="approval-arrow">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Player In */}
          <div className="approval-player in">
            <div className="approval-player-img-wrap">
              <img
                src={getPlayerImageUrl(playerIn.code)}
                alt={playerIn.web_name}
                className="approval-player-img"
                onError={handlePlayerImageError(playerIn)}
              />
              <img src={getTeamBadge(playerIn.team_code)} alt="" className="approval-badge" />
            </div>
            <span className="approval-direction-label in-label">IN</span>
            <strong className="approval-player-name">{playerIn.web_name}</strong>
            <span className="approval-player-meta">{playerIn.position} · {playerIn.team_name}</span>
            <span className="approval-player-price">£{(playerIn.now_cost / 10).toFixed(1)}m</span>
          </div>
        </div>

        <div className="approval-stats">
          <div className="approval-stat-row">
            <span>Expected pts gain</span>
            <strong className="text-green">+{suggestion.expected_points_gain.toFixed(1)} pts</strong>
          </div>
          <div className="approval-stat-row">
            <span>Cost change</span>
            <strong>{suggestion.cost_change > 0 ? '-' : '+'}£{Math.abs(suggestion.cost_change).toFixed(1)}m</strong>
          </div>
          <div className="approval-stat-row">
            <span>Bank after transfer</span>
            <strong>£{suggestion.bank_after.toFixed(1)}m</strong>
          </div>
        </div>

        <div className="approval-warning">
          <span>⚠️</span>
          <span>This will make a <strong>live transfer</strong> in your FPL team. This action cannot be undone before the gameweek deadline.</span>
        </div>

        {error && (
          <div className="approval-error">
            ❌ {error}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onCancel} className="cancel-btn" disabled={executing}>
            Cancel
          </button>
          <button onClick={handleConfirm} className="confirm-btn" disabled={executing}>
            {executing ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                Executing...
              </span>
            ) : (
              '✅ Confirm Transfer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;

