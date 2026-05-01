/**
 * Chip Advisor component — displays chip status, DGW/BGW intelligence,
 * and provides AI-powered chip strategy recommendations.
 */
import React, { useState, useEffect } from 'react';
import { transferAPI } from '../../services/api';
import ReactMarkdown from 'react-markdown';

const CHIP_META = {
  wildcard: { icon: '🃏', name: 'Wildcard', desc: 'Unlimited free transfers for this GW', color: '#a855f7' },
  freehit:  { icon: '⚡', name: 'Free Hit', desc: 'Temporary squad for one GW only', color: '#3b82f6' },
  bboost:   { icon: '📈', name: 'Bench Boost', desc: 'All 15 players score points', color: '#10b981' },
  '3xc':    { icon: '👑', name: 'Triple Captain', desc: 'Captain scores 3× points', color: '#f59e0b' },
};

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
        setRecommendations(prev => ({ ...prev, [chipName]: result.chip_recommendation }));
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

  // DGW/BGW display
  const gwDetails = gwIntelligence?.gameweek_details || [];
  const hasNotableGWs = gwDetails.some(gw => gw.is_double || gw.is_blank);

  return (
    <div className="chip-advisor">
      <div className="chip-advisor-header">
        <h3>🎯 Chip Strategy Hub</h3>
        <p className="chip-advisor-subtitle">
          AI-powered chip recommendations based on your squad, fixtures, and upcoming gameweeks
        </p>
      </div>

      {/* DGW/BGW Intelligence Panel */}
      {hasNotableGWs && (
        <div className="gw-intelligence-panel">
          <h4>📅 Gameweek Intelligence</h4>
          <div className="gw-intel-cards">
            {gwDetails.filter(gw => gw.is_double || gw.is_blank).map(gw => (
              <div key={gw.gameweek} className={`gw-intel-card ${gw.is_double ? 'dgw' : 'bgw'}`}>
                <div className="gw-intel-badge">
                  {gw.is_current ? '🔴 NOW' : gw.is_next ? '🟡 NEXT' : `GW${gw.gameweek}`}
                </div>
                <div className="gw-intel-type">
                  {gw.is_double && <span className="gw-tag dgw-tag">DOUBLE GW</span>}
                  {gw.is_blank && <span className="gw-tag bgw-tag">BLANK GW</span>}
                </div>
                {gw.teams_with_double?.length > 0 && (
                  <div className="gw-intel-teams">
                    <span className="gw-team-label">2 fixtures:</span>
                    <span className="gw-team-list">{gw.teams_with_double.join(', ')}</span>
                  </div>
                )}
                {gw.teams_with_blank?.length > 0 && (
                  <div className="gw-intel-teams">
                    <span className="gw-team-label">No fixture:</span>
                    <span className="gw-team-list">{gw.teams_with_blank.join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chip Status Cards */}
      <div className="chip-cards-grid">
        {Object.entries(CHIP_META).map(([key, meta]) => {
          const chipData = chips.find(c => c.name === key);
          const isAvailable = availableChipNames.includes(key);
          const rec = recommendations[key];
          const isExpanded = expandedChip === key;
          const isAnalyzing = analyzing === key;

          return (
            <div 
              key={key} 
              className={`chip-card ${isAvailable ? 'available' : 'used'} ${isExpanded && rec ? 'expanded' : ''}`}
              style={{ '--chip-color': meta.color }}
            >
              <div className="chip-card-header">
                <div className="chip-icon-wrap">
                  <span className="chip-icon">{meta.icon}</span>
                </div>
                <div className="chip-card-info">
                  <h4>{meta.name}</h4>
                  <p>{meta.desc}</p>
                </div>
                <div className={`chip-status-badge ${isAvailable ? 'available' : 'used'}`}>
                  {isAvailable ? '✅ Available' : '❌ Used'}
                </div>
              </div>

              {isAvailable && (
                <button 
                  className="chip-analyze-btn"
                  onClick={() => isExpanded && rec ? setExpandedChip(null) : handleAnalyze(key)}
                  disabled={isAnalyzing}
                  style={{ '--chip-color': meta.color }}
                >
                  {isAnalyzing ? (
                    <span className="chip-btn-loading">
                      <span className="btn-spinner" />
                      Analyzing...
                    </span>
                  ) : isExpanded && rec ? (
                    '▲ Collapse'
                  ) : rec ? (
                    '▼ Show Recommendation'
                  ) : (
                    `🤖 Analyze ${meta.name}`
                  )}
                </button>
              )}

              {/* Recommendation Panel */}
              {isExpanded && rec && (
                <div className="chip-recommendation-panel">
                  <div className={`chip-verdict ${rec.should_play ? 'play' : 'wait'}`}>
                    <span className="verdict-icon">{rec.should_play ? '✅' : '⏳'}</span>
                    <div>
                      <strong>{rec.should_play ? `Play ${meta.name} Now!` : `Save ${meta.name}`}</strong>
                      <span className={`confidence-badge ${rec.confidence?.toLowerCase()}`}>
                        {rec.confidence} confidence
                      </span>
                    </div>
                  </div>

                  <div className="chip-reasoning">
                    <ReactMarkdown>{rec.reasoning}</ReactMarkdown>
                  </div>

                  {rec.best_gameweek && !rec.should_play && (
                    <div className="chip-best-gw">
                      💡 Best used in: <strong>GW{rec.best_gameweek}</strong>
                    </div>
                  )}

                  {/* Full Squad Display for Wildcard / Free Hit */}
                  {rec.squad && rec.squad.length > 0 && (
                    <div className="chip-squad-panel">
                      <h4>📋 Suggested Squad ({rec.squad.length} players)</h4>
                      {rec.total_cost && (
                        <div className="chip-squad-budget">
                          Total cost: £{rec.total_cost.toFixed(1)}m
                          {rec.bank_remaining != null && ` · Bank: £${rec.bank_remaining.toFixed(1)}m`}
                        </div>
                      )}
                      
                      {/* Formation Display */}
                      {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
                        const posPlayers = rec.squad.filter(p => p.position === pos);
                        if (posPlayers.length === 0) return null;
                        return (
                          <div key={pos} className="chip-squad-position">
                            <div className="chip-pos-label">{pos}</div>
                            <div className="chip-pos-players">
                              {posPlayers.map((player, i) => (
                                <div 
                                  key={i} 
                                  className={`chip-squad-player ${player.is_starter ? 'starter' : 'bench'} ${player.is_captain ? 'captain' : ''} ${player.is_vice_captain ? 'vice-captain' : ''}`}
                                >
                                  <div className="chip-player-top">
                                    <span className="chip-player-name">
                                      {player.is_captain && <span className="role-badge cap">C</span>}
                                      {player.is_vice_captain && <span className="role-badge vice">VC</span>}
                                      {player.player_name}
                                    </span>
                                    <span className="chip-player-cost">£{player.cost?.toFixed(1)}m</span>
                                  </div>
                                  <div className="chip-player-bottom">
                                    <span className="chip-player-team">{player.team_name}</span>
                                    {!player.is_starter && <span className="bench-tag">BENCH</span>}
                                    <span className="chip-player-form">Form: {player.form}</span>
                                  </div>
                                  {player.rationale && (
                                    <div className="chip-player-rationale">{player.rationale}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="chip-error">
          ❌ {error}
        </div>
      )}
    </div>
  );
};

export default ChipAdvisor;
