 /**
 * API client for FPL Agent backend
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// FPL session held in module memory for the lifetime of the tab.
// Both pieces are needed: the cookie passes DataDome / Cloudflare checks; the
// access_token authenticates per-user endpoints like /api/my-team/ via
// X-Api-Authorization. Without the token, my-team returns 403 and the squad
// view can't compute free transfers.
let fplCookie = null;
let fplAccessToken = null;

export const setFPLCookie = (cookie) => {
  fplCookie = cookie;
};

export const setFPLAccessToken = (token) => {
  fplAccessToken = token;
};

api.interceptors.request.use((config) => {
  if (fplCookie) {
    config.headers['X-FPL-Cookie'] = fplCookie;
  }
  if (fplAccessToken) {
    config.headers['X-FPL-Access-Token'] = fplAccessToken;
  }
  return config;
});

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Login with FPL cookie
   */
  login: async (cookie, managerId) => {
    const response = await api.post('/auth/login', {
      fpl_cookie: cookie,
      manager_id: parseInt(managerId),
    });
    if (response.data.success) {
      setFPLCookie(cookie);
    }
    return response.data;
  },

  /**
   * Login with email and password. Manager ID is derived from /api/me/ on the backend.
   */
  loginWithCredentials: async (email, password) => {
    const response = await api.post('/auth/login-credentials', {
      email,
      password,
    });
    if (response.data.success) {
      if (response.data.cookie) setFPLCookie(response.data.cookie);
      if (response.data.access_token) setFPLAccessToken(response.data.access_token);
    }
    return response.data;
  },

  /**
   * Validate current session
   */
  validate: async () => {
    const response = await api.get('/auth/validate');
    return response.data;
  },
};

/**
 * Team API
 */
export const teamAPI = {
  /**
   * Get user's team
   */
  getTeam: async (managerId) => {
    const response = await api.get(`/team/${managerId}`);
    return response.data;
  },

  /**
   * Get team picks for gameweek
   */
  getPicks: async (managerId, gameweek) => {
    const response = await api.get(`/team/${managerId}/picks/${gameweek}`);
    return response.data;
  },
};

/**
 * Transfer API
 */
export const transferAPI = {
  /**
   * Get AI-generated transfer suggestions
   */
  getSuggestions: async (managerId, feedback = null, currentSuggestions = null) => {
    const response = await api.post('/transfers/suggest', {
      manager_id: parseInt(managerId),
      feedback,
      current_suggestions: currentSuggestions,
    });
    return response.data;
  },

  /**
   * Execute transfer on FPL
   */
  executeTransfer: async (managerId, gameweek, transfers, chip = null) => {
    const response = await api.post('/transfers/execute', {
      manager_id: parseInt(managerId),
      gameweek: parseInt(gameweek),
      transfers,
      chip,
    });
    return response.data;
  },

  /**
   * Get AI-powered chip advice (Wildcard, Free Hit, Bench Boost, Triple Captain)
   */
  getChipAdvice: async (managerId, chip) => {
    const response = await api.post('/transfers/chip-advice', {
      manager_id: parseInt(managerId),
      chip,
    });
    return response.data;
  },
};

/**
 * Leagues API
 */
export const leaguesAPI = {
  getManagerLeagues: async (managerId) => {
    const response = await api.get(`/leagues/manager/${managerId}`);
    return response.data;
  },
  getLeagueStandings: async (leagueId, page = 1) => {
    const response = await api.get(`/leagues/${leagueId}/standings?page=${page}`);
    return response.data;
  }
};

/**
 * Chat API — for conversational questions (not suggestion generation)
 */
export const chatAPI = {
  /**
   * Send a chat message and get an AI response
   */
  sendMessage: async (managerId, message, context = null) => {
    const response = await api.post('/chat/message', {
      manager_id: parseInt(managerId),
      message,
      context,
    });
    return response.data;
  },
};

export default api;
