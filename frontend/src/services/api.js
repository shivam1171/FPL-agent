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

// Store FPL cookie in memory
let fplCookie = null;

export const setFPLCookie = (cookie) => {
  fplCookie = cookie;
};

// Add cookie to requests
api.interceptors.request.use((config) => {
  if (fplCookie) {
    config.headers['X-FPL-Cookie'] = fplCookie;
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
   * Login with email and password
   */
  loginWithCredentials: async (email, password, managerId) => {
    const response = await api.post('/auth/login-credentials', {
      email,
      password,
      manager_id: parseInt(managerId),
    });
    if (response.data.success && response.data.cookie) {
      setFPLCookie(response.data.cookie);
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
