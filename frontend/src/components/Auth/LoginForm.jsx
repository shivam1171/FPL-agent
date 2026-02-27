/**
 * Login form with dual auth: Email/Password or Cookie-based login
 */
import React, { useState } from 'react';
import { authAPI } from '../../services/api';

const LoginForm = ({ onLoginSuccess }) => {
  const [managerId, setManagerId] = useState('');
  const [fplCookie, setFplCookie] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [loginMethod, setLoginMethod] = useState('credentials'); // 'credentials' or 'cookie'

  const handleCredentialLogin = async (e) => {
    e.preventDefault();
    if (!managerId || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await authAPI.loginWithCredentials(email, password, managerId);
      if (result.success) {
        onLoginSuccess(managerId, result.cookie);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed. Check your credentials.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleCookieLogin = async (e) => {
    e.preventDefault();
    if (!managerId || !fplCookie) {
      setError('Please provide both Manager ID and FPL Cookie');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await authAPI.login(fplCookie, managerId);
      if (result.success) {
        onLoginSuccess(managerId, fplCookie);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed. Check your cookie.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-container-overlay"></div>
      <div className="login-header">
        <img 
          src="/pl-logo-white.png" 
          alt="Premier League" 
          className="login-pl-logo"
        />
        <h1 className="login-title">FPL Agent</h1>
        <p className="login-subtitle">Your AI-Powered Fantasy Premier League Assistant</p>
      </div>

      <div className="login-card">
        {/* Login Method Toggle */}
        <div className="login-method-toggle">
          <button 
            className={`method-tab ${loginMethod === 'credentials' ? 'active' : ''}`}
            onClick={() => { setLoginMethod('credentials'); setError(''); }}
            type="button"
          >
            🔑 Email & Password
          </button>
          <button 
            className={`method-tab ${loginMethod === 'cookie' ? 'active' : ''}`}
            onClick={() => { setLoginMethod('cookie'); setError(''); }}
            type="button"
          >
            🍪 Cookie
          </button>
        </div>

        {/* Manager ID — shared between both methods */}
        <div className="input-group">
          <label>MANAGER ID</label>
          <input
            type="text"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            placeholder="e.g. 123456"
          />
          <span className="input-hint">Find this in your FPL URL: fantasy.premierleague.com/entry/<strong>123456</strong>/event/1</span>
        </div>

        {/* Credential Login */}
        {loginMethod === 'credentials' && (
          <form onSubmit={handleCredentialLogin}>
            <div className="input-group">
              <label>FPL EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>
            <div className="input-group">
              <label>FPL PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <span className="login-loading">
                  <span className="spinner"></span> Connecting...
                </span>
              ) : (
                <>Connect to FPL &nbsp;→</>
              )}
            </button>
          </form>
        )}

        {/* Cookie Login */}
        {loginMethod === 'cookie' && (
          <form onSubmit={handleCookieLogin}>
            <div className="input-group">
              <label>
                FPL COOKIE
                <button type="button" className="help-toggle" onClick={() => setShowHelp(!showHelp)}>?</button>
              </label>
              <textarea
                value={fplCookie}
                onChange={(e) => setFplCookie(e.target.value)}
                placeholder="Paste your full FPL cookie string here..."
                rows={3}
              />
            </div>
            {showHelp && (
              <div className="cookie-help">
                <p><strong>How to get your FPL cookie:</strong></p>
                <ol>
                  <li>Log in to <a href="https://fantasy.premierleague.com" target="_blank" rel="noreferrer">fantasy.premierleague.com</a></li>
                  <li>Open DevTools (F12) → Application → Cookies</li>
                  <li>Copy all cookie values</li>
                </ol>
              </div>
            )}
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <span className="login-loading">
                  <span className="spinner"></span> Verifying...
                </span>
              ) : (
                <>Connect to FPL &nbsp;→</>
              )}
            </button>
          </form>
        )}
      </div>

      <div className="login-features">
        <div className="login-feature">
          <div className="login-feature-icon">🤖</div>
          <div className="login-feature-text">AI-Powered Transfer Suggestions</div>
        </div>
        <div className="login-feature">
          <div className="login-feature-icon">📊</div>
          <div className="login-feature-text">Fixture & Form Analysis</div>
        </div>
        <div className="login-feature">
          <div className="login-feature-icon">💬</div>
          <div className="login-feature-text">Interactive Chat Feedback</div>
        </div>
        <div className="login-feature">
          <div className="login-feature-icon">⏰</div>
          <div className="login-feature-text">Live Deadline Countdown</div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
