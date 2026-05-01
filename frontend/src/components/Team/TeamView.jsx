/**
 * Enhanced Team view with Watchlist (comparison, price alerts, AI integration), 
 * Top Performers, Deadline Timer, and more
 */
import React, { useEffect, useState, useCallback } from 'react';
import { teamAPI } from '../../services/api';
import { getPlayerImageUrl, handlePlayerImageError } from '../../utils/playerImage';

// Countdown to a specific ISO deadline (e.g. "2026-05-01T17:30:00Z" from FPL).
const useDeadlineTimer = (deadlineIso) => {
  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    if (!deadlineIso) { setTimeLeft(null); return; }
    const deadline = new Date(deadlineIso);
    if (Number.isNaN(deadline.getTime())) { setTimeLeft(null); return; }
    const tick = () => {
      const diff = deadline - new Date();
      if (diff <= 0) { setTimeLeft({ d: 0, h: 0, m: 0, s: 0, expired: true }); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ d, h, m, s, expired: false });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineIso]);
  return timeLeft;
};

// Pick the next GW whose deadline hasn't passed yet from the gw_intelligence payload.
const findNextDeadlineGw = (gwIntel) => {
  const details = gwIntel?.gameweek_details;
  if (!Array.isArray(details)) return null;
  const now = Date.now();
  return details.find(d => d?.deadline_time && new Date(d.deadline_time).getTime() > now) || null;
};

// Price movement prediction based on transfer activity
const getPriceMovement = (player) => {
  const netTransfers = (player.transfers_in_event || 0) - (player.transfers_out_event || 0);
  const ownership = parseFloat(player.selected_by_percent || 0);
  if (netTransfers > 50000) return { direction: 'up', label: '📈 Rising', cls: 'change-up', detail: `+${(netTransfers / 1000).toFixed(0)}k net transfers` };
  if (netTransfers > 20000) return { direction: 'up', label: '↑ Likely rise', cls: 'change-up', detail: `+${(netTransfers / 1000).toFixed(0)}k net transfers` };
  if (netTransfers < -50000) return { direction: 'down', label: '📉 Falling', cls: 'change-down', detail: `${(netTransfers / 1000).toFixed(0)}k net transfers` };
  if (netTransfers < -20000) return { direction: 'down', label: '↓ Likely drop', cls: 'change-down', detail: `${(netTransfers / 1000).toFixed(0)}k net transfers` };
  return { direction: 'stable', label: '→ Stable', cls: '', detail: `${(netTransfers / 1000).toFixed(0)}k net transfers` };
};

// Simple sparkline component for form trend
const MiniSparkline = ({ values, width = 60, height = 20 }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`).join(' ');
  const lastVal = values[values.length - 1];
  const color = lastVal >= 5 ? 'var(--accent-green)' : lastVal >= 3 ? 'var(--accent-gold)' : 'var(--accent-red)';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length - 1) * stepX} cy={height - ((lastVal - min) / range) * height} r="3" fill={color} />
    </svg>
  );
};

const TeamView = ({ managerId, onGetSuggestions, watchlist, setWatchlist, onTeamLoaded }) => {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topPerformers, setTopPerformers] = useState([]);
  const [activeTab, setActiveTab] = useState('pitch');

  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);

  useEffect(() => { loadTeam(); }, [managerId]);

  const loadTeam = async () => {
    try {
      setLoading(true);
      const data = await teamAPI.getTeam(managerId);
      setTeam(data);
      if (data?.players) {
        const allPlayers = data.players.map(p => p.player);
        const sorted = [...allPlayers].sort((a, b) => parseFloat(b.form || 0) - parseFloat(a.form || 0));
        setTopPerformers(sorted.slice(0, 5));
      }
      if (onTeamLoaded) onTeamLoaded(data);
    } catch (err) {
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const toggleWatchlist = useCallback((player) => {
    setWatchlist(prev => {
      const exists = prev.find(p => p.id === player.id);
      const updated = exists ? prev.filter(p => p.id !== player.id) : [...prev, player];
      localStorage.setItem('fpl_watchlist', JSON.stringify(updated));
      return updated;
    });
  }, [setWatchlist]);

  const handleCompareSelect = (player) => {
    if (!compareMode) return;
    if (!compareA) { setCompareA(player); }
    else if (!compareB && player.id !== compareA.id) { setCompareB(player); }
    else { setCompareA(player); setCompareB(null); }
  };

  const nextDeadlineGw = findNextDeadlineGw(team?.gameweek_intelligence);
  const timeLeft = useDeadlineTimer(nextDeadlineGw?.deadline_time);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '16px' }}>
      <div className="typing-indicator"><span></span><span></span><span></span></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading your squad...</p>
    </div>
  );
  if (error) return <div className="error-message">{error}</div>;
  if (!team) return null;

  const { summary, gameweek, players } = team;
  const starters = players.filter((p) => p.pick.position <= 11);
  const bench = players.filter((p) => p.pick.position > 11);

  const getStatusClass = (status) => {
    if (status === 'a') return 'available';
    if (status === 'd') return 'doubtful';
    return 'injured';
  };

  const getFormLevel = (form) => {
    const f = parseFloat(form || 0);
    if (f >= 6) return { cls: 'form-excellent', pct: Math.min(f * 10, 100) };
    if (f >= 4) return { cls: 'form-good', pct: Math.min(f * 12, 100) };
    if (f >= 2) return { cls: 'form-average', pct: Math.min(f * 15, 100) };
    return { cls: 'form-poor', pct: Math.max(f * 20, 5) };
  };

  const renderPlayerCard = (player, pick, isBench = false, isPitchMode = false) => {
    const form = getFormLevel(player.form);
    const isWatched = watchlist.find(p => p.id === player.id);
    const isCompareSelected = compareMode && (compareA?.id === player.id || compareB?.id === player.id);
    return (
      <div 
        key={player.id} 
        className={`player-card ${isBench ? 'bench' : ''} ${isCompareSelected ? 'compare-selected' : ''} ${isPitchMode ? 'pitch-mode' : ''}`} 
        onClick={() => compareMode ? handleCompareSelect(player) : toggleWatchlist(player)} 
        title={compareMode ? "Click to compare" : "Click to add/remove from watchlist"}
      >
        <div className={`status-dot ${getStatusClass(player.status)}`}></div>
        <div className="player-visual-top">
          <img
            src={getPlayerImageUrl(player.code)}
            alt={player.web_name}
            className={`player-face-sm ${isBench ? 'bench-face' : ''}`}
            onError={handlePlayerImageError(player)}
          />
          <img 
            src={`https://resources.premierleague.com/premierleague/badges/70/t${player.team_code}.png`}
            alt={player.team_name}
            className="team-badge-xs"
          />
        </div>
        <div className="player-card-body">
          <div className="player-name">
            {player.web_name}
            {pick?.is_captain && <span className="badge captain">C</span>}
            {pick?.is_vice_captain && <span className="badge vice">VC</span>}
            {isWatched && <span style={{ fontSize: '0.7rem' }}>👁️</span>}
          </div>
          <div className="player-info">
            <span>{player.position} {!isPitchMode && `• ${player.team_name}`}</span>
            {isPitchMode ? <span className="pts-pill">{player.total_points} pts</span> : <span>£{(player.now_cost / 10).toFixed(1)}m</span>}
          </div>
          <div className="player-stats">
            <span>Form: {player.form}</span>
            <span>Pts: {player.total_points}</span>
          </div>
          <div className="player-form-bar">
            <div className={`player-form-fill ${form.cls}`} style={{ width: `${form.pct}%` }}></div>
          </div>
        </div>
      </div>
    );
  };

  const totalValue = (summary.value / 10).toFixed(1);
  const bank = (summary.bank / 10).toFixed(1);
  const avgForm = (players.reduce((acc, p) => acc + parseFloat(p.player.form || 0), 0) / players.length).toFixed(1);
  const freeTransfers = team.transfers?.error 
    ? <span style={{ cursor: 'help', color: 'var(--accent-red)', fontSize: '0.9rem' }} title={`Not available: ${team.transfers.error}`}>⚠️ N/A</span>
    : team.transfers?.limit !== undefined 
      ? Math.max(0, team.transfers.limit - (team.transfers.made || 0)) 
      : '—';
  // Generate synthetic form trend from available data for sparklines
  const getFormTrend = (player) => {
    const form = parseFloat(player.form || 0);
    const ppg = parseFloat(player.points_per_game || 0);
    // Simulate a 5-point trend based on available stats
    const baseline = ppg * 0.8;
    return [
      Math.max(baseline * 0.7, 0.5),
      Math.max(baseline * 0.9, 0.5),
      Math.max(ppg, 0.5),
      Math.max((form + ppg) / 2, 0.5),
      Math.max(form, 0.5)
    ];
  };

  return (
    <div className="team-view">
      {/* Deadline Timer — uses the actual FPL deadline for the next GW */}
      {timeLeft && nextDeadlineGw && (
        <div className="deadline-banner">
          <span className="deadline-label">⏰ GW{nextDeadlineGw.gameweek} Deadline</span>
          <div>
            {timeLeft.expired ? (
              <span className="deadline-time">Locked</span>
            ) : (
              <>
                <span className="deadline-time">{timeLeft.d}</span><span className="deadline-unit">d </span>
                <span className="deadline-time">{String(timeLeft.h).padStart(2, '0')}</span><span className="deadline-unit">h </span>
                <span className="deadline-time">{String(timeLeft.m).padStart(2, '0')}</span><span className="deadline-unit">m </span>
                <span className="deadline-time">{String(timeLeft.s).padStart(2, '0')}</span><span className="deadline-unit">s</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="team-header-section">
        <div className="team-header">
          <h2>Your Squad <span className="gw-label">GW{gameweek}</span></h2>
          <div className="team-stats animate-stagger">
            <div className="stat highlight"><span>Total Points</span><strong>{summary.total_points}</strong></div>
            <div className="stat"><span>Team Value</span><strong>£{totalValue}m</strong></div>
            <div className="stat"><span>In the Bank</span><strong>£{bank}m</strong></div>
            <div className="stat"><span>Free Transfers</span><strong>{freeTransfers}</strong></div>
            <div className="stat"><span>GW Transfers</span><strong>{summary.event_transfers}</strong></div>
            <div className="stat"><span>Overall Rank</span><strong>{summary.rank?.toLocaleString() || '—'}</strong></div>
            <div className="stat"><span>Avg Form</span><strong>{avgForm}</strong></div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions animate-stagger" style={{ justifyContent: 'center' }}>
        <button className="quick-action-btn" onClick={onGetSuggestions} style={{ flex: '0 1 auto' }}>
          <span className="action-icon">🤖</span>
          <span className="action-text">
            <span className="action-title">AI Transfer Suggestions</span>
            <span className="action-desc">Get GPT-powered recommendations{watchlist.length > 0 ? ` (${watchlist.length} watched)` : ''}</span>
          </span>
        </button>
        <button className="quick-action-btn" onClick={() => setActiveTab(activeTab === 'analytics' ? 'pitch' : 'analytics')} style={{ flex: '0 1 auto' }}>
          <span className="action-icon">📊</span>
          <span className="action-text">
            <span className="action-title">Squad Analytics</span>
            <span className="action-desc">View top performers & insights</span>
          </span>
        </button>
      </div>

      {/* Watchlist Section */}
      <div className="watchlist-section">
        <div className="section-heading">
          <h3 style={{ display: 'flex', alignItems: 'center' }}>
            <span className="section-icon">👁️</span> Watchlist
            <div className="watchlist-help-container">
              <div className="watchlist-help-toggle" title="Learn about the Watchlist">?</div>
              <div className="watchlist-instructions-tooltip">
                <div className="wi-grid">
                  <div className="wi-item">
                    <span className="wi-icon">👆</span>
                    <div>
                      <strong>Add to Watchlist</strong>
                      <p>Click any player card to add or remove them from your watchlist.</p>
                    </div>
                  </div>
                  <div className="wi-item">
                    <span className="wi-icon">🤖</span>
                    <div>
                      <strong>AI-Aware</strong>
                      <p>Your watchlist is automatically shared with the AI advisor. It will factor in the players you're monitoring when generating transfer suggestions.</p>
                    </div>
                  </div>
                  <div className="wi-item">
                    <span className="wi-icon">📈</span>
                    <div>
                      <strong>Price Alerts</strong>
                      <p>See predicted price changes based on net transfer activity. Green arrows = price likely rising, red = likely falling.</p>
                    </div>
                  </div>
                  <div className="wi-item">
                    <span className="wi-icon">📊</span>
                    <div>
                      <strong>Form Trends</strong>
                      <p>Mini sparkline charts show each player's form trajectory — see at a glance who's trending up or down.</p>
                    </div>
                  </div>
                  <div className="wi-item">
                    <span className="wi-icon">⚖️</span>
                    <div>
                      <strong>Compare Players</strong>
                      <p>Click "Compare" then select two players from your squad to see a detailed side-by-side stat comparison.</p>
                    </div>
                  </div>
                  <div className="wi-item">
                    <span className="wi-icon">💾</span>
                    <div>
                      <strong>Persisted</strong>
                      <p>Your watchlist is saved locally — it will survive closing and reopening your browser.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className={`watchlist-action-btn ${compareMode ? 'active' : ''}`}
              onClick={() => { setCompareMode(!compareMode); setCompareA(null); setCompareB(null); }}
            >
              ⚖️ {compareMode ? 'Exit Compare' : 'Compare'}
            </button>
            <span className="section-badge">{watchlist.length} players</span>
          </div>
        </div>

        {/* Compare Mode Banner */}
        {compareMode && (
          <div className="compare-banner">
            <span>⚖️ Compare Mode Active — Click two players to compare them side-by-side</span>
            {compareA && <span className="compare-tag">1: {compareA.web_name}</span>}
            {compareB && <span className="compare-tag">2: {compareB.web_name}</span>}
          </div>
        )}

        {/* Comparison Modal */}
        {compareA && compareB && (
          <div className="comparison-card">
            <div className="comparison-header">
              <h4>⚖️ Player Comparison</h4>
              <button className="close-compare" onClick={() => { setCompareA(null); setCompareB(null); setCompareMode(false); }}>✕</button>
            </div>
            <div className="comparison-body">
              <div className="compare-col">
                <img
                  src={getPlayerImageUrl(compareA.code)}
                  alt={compareA.web_name}
                  className="compare-img"
                  onError={handlePlayerImageError(compareA)}
                />
                <strong>{compareA.web_name}</strong>
                <span className="compare-team">{compareA.team_name} • {compareA.position}</span>
              </div>
              <div className="compare-stats-col">
                {[
                  { label: 'Form', a: compareA.form, b: compareB.form },
                  { label: 'Total Pts', a: compareA.total_points, b: compareB.total_points },
                  { label: 'PPG', a: compareA.points_per_game, b: compareB.points_per_game },
                  { label: 'Cost', a: `£${(compareA.now_cost / 10).toFixed(1)}m`, b: `£${(compareB.now_cost / 10).toFixed(1)}m` },
                  { label: 'Ownership', a: `${compareA.selected_by_percent}%`, b: `${compareB.selected_by_percent}%` },
                  { label: 'xG', a: compareA.expected_goals ?? '—', b: compareB.expected_goals ?? '—' },
                  { label: 'xA', a: compareA.expected_assists ?? '—', b: compareB.expected_assists ?? '—' },
                ].map(row => {
                  const aNum = parseFloat(row.a);
                  const bNum = parseFloat(row.b);
                  const aWins = !isNaN(aNum) && !isNaN(bNum) && aNum > bNum;
                  const bWins = !isNaN(aNum) && !isNaN(bNum) && bNum > aNum;
                  return (
                    <div className="compare-row" key={row.label}>
                      <span className={`compare-val ${aWins ? 'winner' : ''}`}>{row.a}</span>
                      <span className="compare-label">{row.label}</span>
                      <span className={`compare-val ${bWins ? 'winner' : ''}`}>{row.b}</span>
                    </div>
                  );
                })}
              </div>
              <div className="compare-col">
                <img
                  src={getPlayerImageUrl(compareB.code)}
                  alt={compareB.web_name}
                  className="compare-img"
                  onError={handlePlayerImageError(compareB)}
                />
                <strong>{compareB.web_name}</strong>
                <span className="compare-team">{compareB.team_name} • {compareB.position}</span>
              </div>
            </div>
          </div>
        )}

        {/* Watchlist Pills with Price Alerts & Form Trends */}
        {watchlist.length === 0 ? (
          <div className="watchlist-empty">
            <span style={{ fontSize: '1.5rem' }}>👁️</span>
            <p>Click any player card to add them to your watchlist</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tracked players are shared with the AI advisor for smarter suggestions</p>
          </div>
        ) : (
          <div className="watchlist-detailed">
            {watchlist.map(player => {
              const priceMovement = getPriceMovement(player);
              const trend = getFormTrend(player);
              return (
                <div key={player.id} className="watchlist-card">
                  <div className="wc-left">
                    <img
                      src={getPlayerImageUrl(player.code)}
                      alt={player.web_name}
                      className="wc-img"
                      onError={handlePlayerImageError(player)}
                    />
                    <div className="wc-info">
                      <span className="wc-name">{player.web_name}</span>
                      <span className="wc-meta">{player.position} • {player.team_name} • £{(player.now_cost / 10).toFixed(1)}m</span>
                    </div>
                  </div>
                  <div className="wc-middle">
                    <div className="wc-stat">
                      <span className="wc-stat-label">Form</span>
                      <span className="wc-stat-value" style={{ color: parseFloat(player.form) >= 5 ? 'var(--accent-green)' : parseFloat(player.form) >= 3 ? 'var(--accent-gold)' : 'var(--accent-red)' }}>
                        {player.form}
                      </span>
                    </div>
                    <div className="wc-stat">
                      <span className="wc-stat-label">Trend</span>
                      <MiniSparkline values={trend} />
                    </div>
                    <div className="wc-stat">
                      <span className="wc-stat-label">Price</span>
                      <span className={`wc-stat-value ${priceMovement.cls}`} title={priceMovement.detail}>
                        {priceMovement.label}
                      </span>
                    </div>
                    <div className="wc-stat">
                      <span className="wc-stat-label">Pts</span>
                      <span className="wc-stat-value">{player.total_points}</span>
                    </div>
                  </div>
                  <button className="remove-pill" onClick={(e) => { e.stopPropagation(); toggleWatchlist(player); }} title="Remove from watchlist">×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Tabs */}
      <div className="view-mode-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
        <button className="nav-tab" onClick={() => setActiveTab('pitch')} style={{ background: activeTab === 'pitch' ? 'var(--accent-cyan)' : 'var(--bg-elevated)', color: activeTab === 'pitch' ? '#000' : 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)' }}>🏟️ Pitch View</button>
        <button className="nav-tab" onClick={() => setActiveTab('grid')} style={{ background: activeTab === 'grid' ? 'var(--accent-cyan)' : 'var(--bg-elevated)', color: activeTab === 'grid' ? '#000' : 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)' }}>🔲 Grid View</button>
        <button className="nav-tab" onClick={() => setActiveTab('list')} style={{ background: activeTab === 'list' ? 'var(--accent-cyan)' : 'var(--bg-elevated)', color: activeTab === 'list' ? '#000' : 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)' }}>📋 List View</button>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'pitch' && (() => {
        const fwd = starters.filter(p => p.player.position === 'FWD');
        const mid = starters.filter(p => p.player.position === 'MID');
        const def = starters.filter(p => p.player.position === 'DEF');
        const gkp = starters.filter(p => p.player.position === 'GKP');

        return (
          <>
            <div className="section-heading">
              <h3><span className="section-icon">⚽</span> Starting XI</h3>
              <span className="section-badge">{starters.length} players</span>
            </div>
            
            <div className="pitch-container animate-stagger">
              <div className="pitch-box-top"></div>
              <div className="pitch-box-bottom"></div>
              
              <div className="pitch-row fwd-row">
                {fwd.map(({ player, pick }) => renderPlayerCard(player, pick, false, true))}
              </div>
              <div className="pitch-row mid-row">
                {mid.map(({ player, pick }) => renderPlayerCard(player, pick, false, true))}
              </div>
              <div className="pitch-row def-row">
                {def.map(({ player, pick }) => renderPlayerCard(player, pick, false, true))}
              </div>
              <div className="pitch-row gkp-row">
                {gkp.map(({ player, pick }) => renderPlayerCard(player, pick, false, true))}
              </div>
            </div>

            <div>
              <div className="section-heading">
                <h3><span className="section-icon">🔄</span> Bench</h3>
                <span className="section-badge">{bench.length} players</span>
              </div>
              <div className="players-grid animate-stagger">
                {bench.map(({ player, pick }) => renderPlayerCard(player, pick, true, false))}
              </div>
            </div>
          </>
        );
      })()}

      {activeTab === 'grid' && (
        <>
          <div>
            <div className="section-heading">
              <h3><span className="section-icon">⚽</span> Starting XI</h3>
              <span className="section-badge">{starters.length} players</span>
            </div>
            <div className="players-grid animate-stagger">
              {starters.map(({ player, pick }) => renderPlayerCard(player, pick))}
            </div>
          </div>
          <div>
            <div className="section-heading">
              <h3><span className="section-icon">🔄</span> Bench</h3>
              <span className="section-badge">{bench.length} players</span>
            </div>
            <div className="players-grid animate-stagger">
              {bench.map(({ player, pick }) => renderPlayerCard(player, pick, true))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'list' && (
        <div>
          <div className="section-heading">
            <h3><span className="section-icon">📋</span> Squad Details</h3>
          </div>
          <table className="mini-table">
            <thead>
              <tr><th>Player</th><th>Position</th><th>Cost</th><th>Form</th><th>Total Pts</th></tr>
            </thead>
            <tbody>
              {players.sort((a, b) => a.player.element_type - b.player.element_type).map(({ player, pick }) => (
                <tr key={player.id}>
                  <td>
                    <div className="player-cell">
                      <img
                        src={getPlayerImageUrl(player.code)}
                        alt={player.web_name}
                        onError={handlePlayerImageError(player)}
                      />
                      <div className="player-info-mini">
                        <span className="pi-name">{player.web_name}{pick.is_captain ? ' (C)' : pick.is_vice_captain ? ' (VC)' : ''}</span>
                        <span className="pi-team">{player.team_name}</span>
                      </div>
                    </div>
                  </td>
                  <td>{player.position}</td>
                  <td>£{(player.now_cost / 10).toFixed(1)}m</td>
                  <td style={{ color: parseFloat(player.form) >= 5 ? 'var(--accent-green)' : parseFloat(player.form) >= 3 ? 'var(--accent-gold)' : 'var(--accent-red)', fontWeight: 700 }}>
                    {player.form}
                  </td>
                  <td>{player.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div className="section-heading">
              <h3><span className="section-icon">🏆</span> Your Top Performers</h3>
            </div>
            <table className="mini-table">
              <thead><tr><th>Player</th><th>Form</th><th>PPG</th><th>Total Pts</th></tr></thead>
              <tbody>
                {topPerformers.map(player => (
                  <tr key={player.id}>
                    <td>
                      <div className="player-cell">
                        <img
                          src={getPlayerImageUrl(player.code)}
                          alt={player.web_name}
                          onError={handlePlayerImageError(player)}
                        />
                        <div className="player-info-mini">
                          <span className="pi-name">{player.web_name}</span>
                          <span className="pi-team">{player.team_name} • {player.position}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{player.form}</td>
                    <td>{player.points_per_game}</td>
                    <td>{player.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="section-heading">
              <h3><span className="section-icon">📈</span> Squad Breakdown</h3>
            </div>
            <div className="team-stats">
              {['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
                const posPlayers = players.filter(p => p.player.position === pos);
                const avgForm = posPlayers.length ? (posPlayers.reduce((a, p) => a + parseFloat(p.player.form || 0), 0) / posPlayers.length).toFixed(1) : '0';
                const totalPts = posPlayers.reduce((a, p) => a + (p.player.total_points || 0), 0);
                return (
                  <div key={pos} className="stat">
                    <span>{pos} ({posPlayers.length})</span>
                    <strong>{totalPts} pts</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avg form: {avgForm}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div className="section-heading">
              <h3><span className="section-icon">🏥</span> Availability Alerts</h3>
            </div>
            {players.filter(p => p.player.status !== 'a').length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--accent-green)', fontSize: '0.9rem', background: 'rgba(0,210,106,0.05)', borderRadius: '8px', border: '1px solid var(--border)' }}>✅ All players fit and available!</div>
            ) : (
              <div className="price-changes">
                {players.filter(p => p.player.status !== 'a').map(({ player }) => (
                  <div key={player.id} className="price-change-item">
                    <span>{player.web_name} ({player.position})</span>
                    <span className="change-down">
                      {player.status === 'i' ? '🔴 Injured' : player.status === 'd' ? '🟡 Doubtful' : player.status === 's' ? '🔴 Suspended' : '⚪ Unavailable'}
                      {player.news && ` — ${player.news}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button className="get-suggestions-btn" onClick={onGetSuggestions}>
        🤖 Get AI Transfer Suggestions {watchlist.length > 0 && `(${watchlist.length} on watchlist)`}
      </button>
    </div>
  );
};

export default TeamView;
