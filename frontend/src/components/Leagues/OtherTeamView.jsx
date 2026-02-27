import React, { useEffect, useState } from 'react';
import { teamAPI } from '../../services/api';

const OtherTeamView = ({ managerId, managerName, onBack }) => {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pitch');

  useEffect(() => { loadTeam(); }, [managerId]);

  const loadTeam = async () => {
    try {
      setLoading(true);
      const data = await teamAPI.getTeam(managerId);
      setTeam(data);
    } catch (err) {
      setError('Failed to load team data. The team might not be visible before the deadline.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '16px' }}>
      <div className="typing-indicator"><span></span><span></span><span></span></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading {managerName}'s squad...</p>
    </div>
  );
  if (error) return (
    <div className="team-view">
      <button className="nav-tab" onClick={onBack} style={{ width: 'fit-content' }}>← Back</button>
      <div className="error-message">{error}</div>
    </div>
  );
  if (!team) return null;

  const { summary, gameweek, players } = team;
  const starters = players.filter((p) => p.pick.position <= 11);
  const bench = players.filter((p) => p.pick.position > 11);

  const getStatusClass = (status) => {
    if (status === 'a') return 'available';
    if (status === 'd') return 'doubtful';
    return 'injured';
  };

  const renderPlayerCard = (player, pick, isBench = false) => {
    return (
      <div key={player.id} className={`player-card ${isBench ? 'bench' : ''}`}>
        <div className={`status-dot ${getStatusClass(player.status)}`}></div>
        <div className="player-visual-top">
          <img 
            src={`https://resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png`}
            alt={player.web_name}
            className={`player-face-sm ${isBench ? 'bench-face' : ''}`}
            onError={(e) => e.target.src = 'https://resources.premierleague.com/premierleague/photos/players/250x250/p0.png'}
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
          </div>
          <div className="player-info">
            <span>{player.position} • {player.team_name}</span>
            <span>£{(player.now_cost / 10).toFixed(1)}m</span>
          </div>
          <div className="player-stats">
            <span>Pts: {player.total_points}</span>
          </div>
        </div>
      </div>
    );
  };

  const totalValue = (summary.value / 10).toFixed(1);
  const bank = (summary.bank / 10).toFixed(1);

  return (
    <div className="team-view">
      {/* Header Section */}
      <div className="team-header-section">
        <button className="nav-tab" onClick={onBack} style={{ marginBottom: '16px', background: 'var(--bg-card)' }}>← Back</button>
        <div className="team-header">
          <h2>{managerName}'s Squad <span className="gw-label">GW{gameweek}</span></h2>
          <div className="team-stats">
            <div className="stat highlight"><span>Total Points</span><strong>{summary.total_points}</strong></div>
            <div className="stat"><span>Team Value</span><strong>£{totalValue}m</strong></div>
            <div className="stat"><span>In the Bank</span><strong>£{bank}m</strong></div>
            <div className="stat"><span>Overall Rank</span><strong>{summary.rank?.toLocaleString() || '—'}</strong></div>
            <div className="stat"><span>GW Transfers</span><strong>{summary.event_transfers}</strong></div>
          </div>
        </div>
      </div>

      <div className="quick-actions" style={{ marginBottom: '20px' }}>
        <button className={`quick-action-btn ${activeTab === 'pitch' ? 'active' : ''}`} onClick={() => setActiveTab('pitch')}>
          <span className="action-icon">🏟️</span>
          <span className="action-text"><span className="action-title">Pitch View</span></span>
        </button>
        <button className={`quick-action-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          <span className="action-icon">📋</span>
          <span className="action-text"><span className="action-title">List View</span></span>
        </button>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'pitch' && (
        <>
          <div>
            <div className="section-heading">
              <h3><span className="section-icon">⚽</span> Starting XI</h3>
              <span className="section-badge">{starters.length} players</span>
            </div>
            <div className="players-grid">
              {starters.map(({ player, pick }) => renderPlayerCard(player, pick))}
            </div>
          </div>
          <div>
            <div className="section-heading">
              <h3><span className="section-icon">🔄</span> Bench</h3>
              <span className="section-badge">{bench.length} players</span>
            </div>
            <div className="players-grid">
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
          <table className="mini-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'var(--bg-card)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px' }}>Player</th>
                <th style={{ padding: '12px' }}>Position</th>
                <th style={{ padding: '12px' }}>Cost</th>
                <th style={{ padding: '12px' }}>Total Pts</th>
              </tr>
            </thead>
            <tbody>
              {players.sort((a, b) => a.player.element_type - b.player.element_type).map(({ player, pick }) => (
                <tr key={player.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}>
                     {player.web_name}{pick.is_captain ? ' (C)' : pick.is_vice_captain ? ' (VC)' : ''}
                  </td>
                  <td style={{ padding: '12px' }}>{player.position}</td>
                  <td style={{ padding: '12px' }}>£{(player.now_cost / 10).toFixed(1)}m</td>
                  <td style={{ padding: '12px' }}>{player.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OtherTeamView;
