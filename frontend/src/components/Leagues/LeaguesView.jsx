import React, { useEffect, useState } from 'react';
import { leaguesAPI } from '../../services/api';
import OtherTeamView from './OtherTeamView';

const LeaguesView = ({ managerId }) => {
  const [leaguesData, setLeaguesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [standings, setStandings] = useState(null);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const [viewingManager, setViewingManager] = useState(null); // { id, name }

  useEffect(() => {
    loadLeagues();
  }, [managerId]);

  const loadLeagues = async () => {
    try {
      setLoading(true);
      const data = await leaguesAPI.getManagerLeagues(managerId);
      setLeaguesData(data);
    } catch (err) {
      setError('Failed to load leagues.');
    } finally {
      setLoading(false);
    }
  };

  const loadLeagueStandings = async (leagueId) => {
    try {
      setStandingsLoading(true);
      setSelectedLeagueId(leagueId);
      setStandings(null);
      const data = await leaguesAPI.getLeagueStandings(leagueId);
      setStandings(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load standings for this league.');
      setSelectedLeagueId(null);
    } finally {
      setStandingsLoading(false);
    }
  };

  if (viewingManager) {
    return (
      <OtherTeamView 
        managerId={viewingManager.id} 
        managerName={viewingManager.name} 
        onBack={() => setViewingManager(null)} 
      />
    );
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '16px' }}>
      <div className="typing-indicator"><span></span><span></span><span></span></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading competitions...</p>
    </div>
  );

  if (error) return <div className="error-message">{error}</div>;
  if (!leaguesData) return null;

  if (selectedLeagueId) {
    return (
      <div className="leagues-view animate-stagger">
        <div className="team-header-section" style={{ marginBottom: '24px' }}>
          <button className="nav-tab" onClick={() => setSelectedLeagueId(null)} style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.05)' }}>← Back to Leagues</button>
          <h2>{standings?.league?.name || 'League Standings'}</h2>
        </div>
        
        {standingsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><div className="typing-indicator"><span></span><span></span><span></span></div></div>
        ) : (
          <div className="table-container" style={{ background: 'rgba(16, 23, 41, 0.5)', backdropFilter: 'blur(12px)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
            <table className="mini-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '18px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Rank</th>
                  <th style={{ padding: '18px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Team & Manager</th>
                  <th style={{ padding: '18px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>GW Pts</th>
                  <th style={{ padding: '18px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Total Pts</th>
                  <th style={{ padding: '18px 24px' }}></th>
                </tr>
              </thead>
              <tbody className="animate-stagger">
                {standings?.standings?.results?.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background='rgba(34, 211, 238, 0.05)'} onMouseLeave={(e) => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '16px 24px', fontWeight: '800', fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>
                       {row.rank} <span style={{ fontSize: '0.9rem', marginLeft: '8px' }}>{row.rank < row.last_rank ? <span style={{color:'var(--accent-green)', textShadow:'0 0 10px rgba(0,210,106,0.5)'}}>▲</span> : row.rank > row.last_rank ? <span style={{color:'var(--accent-red)'}}>▼</span> : <span style={{color:'var(--text-muted)'}}>-</span>}</span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: '#fff' }}>{row.entry_name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.player_name}</div>
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: '600', fontFamily: 'var(--font-display)' }}>{row.event_total}</td>
                    <td style={{ padding: '16px 24px', fontWeight: '800', color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{row.total}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <button 
                        className="nav-tab" 
                        style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}
                        onClick={() => setViewingManager({ id: row.entry, name: row.player_name })}
                      >
                        View Team
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const { classic, h2h } = leaguesData;

  return (
    <div className="leagues-view">
      <div className="team-header-section" style={{ marginBottom: '24px' }}>
        <h2>🏆 Active Competitions</h2>
        <p style={{ color: 'var(--text-secondary)' }}>View your leagues, ranks, and spy on your friends' teams.</p>
      </div>

      <div className="section-heading">
        <h3><span className="section-icon">🥇</span> Classic Leagues</h3>
      </div>
      <div className="leagues-grid animate-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {classic && classic.map(league => (
          <div 
            key={league.id} 
            className="stat" 
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
            onClick={() => loadLeagueStandings(league.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{league.name}</span>
              <span className="gw-badge" style={{ fontSize: '0.75rem' }}>Rank {league.entry_rank?.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>Previous: {league.entry_last_rank?.toLocaleString()} {league.entry_rank < league.entry_last_rank ? <span style={{color:'var(--accent-green)'}}>▲</span> : league.entry_rank > league.entry_last_rank ? <span style={{color:'var(--accent-red)'}}>▼</span> : ''}</span>
              <span>Total Entries: {league.max_entries == null || league.max_entries === 0 ? 'Unlimited' : league.max_entries.toLocaleString()}</span>
            </div>
          </div>
        ))}
        {(!classic || classic.length === 0) && <p>No classic leagues found.</p>}
      </div>

      {h2h && h2h.length > 0 && (
        <>
          <div className="section-heading">
            <h3><span className="section-icon">⚔️</span> Head-to-Head Leagues</h3>
          </div>
          <div className="leagues-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {h2h.map(league => (
              <div key={league.id} className="stat">
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{league.name}</span>
                    <span className="gw-badge" style={{ fontSize: '0.7rem' }}>Rank {league.entry_rank}</span>
                 </div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>H2H leagues standings view not supported yet.</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LeaguesView;
