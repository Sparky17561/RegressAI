// /src/services/api.js
import axios from 'axios';
import { authService } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add Firebase ID token to requests
api.interceptors.request.use(async (config) => {
  const token = await authService.getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add user_id to request data if not already present
  const userId = localStorage.getItem('user_id');
  if (userId && config.data) {
    // If data is FormData, append user_id if not already there
    if (config.data instanceof FormData) {
      if (!config.data.has('user_id')) {
        config.data.append('user_id', userId);
      }
    } 
    // If data is JSON object, add user_id if not already present
    else if (typeof config.data === 'object' && !config.data.user_id) {
      config.data = { ...config.data, user_id: userId };
    }
  }
  
  return config;
});
// inside /src/services/api.js (replace fetchVersion)
function removeNulls(obj) {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const arr = obj
      .map(removeNulls)
      .filter((v) => v !== undefined);
    return arr;
  }
  if (typeof obj === 'object') {
    const out = {};
    Object.keys(obj).forEach((k) => {
      const v = removeNulls(obj[k]);
      if (v !== undefined) out[k] = v;
    });
    // if object becomes empty, return empty object (not undefined) — preserves structure
    return Object.keys(out).length ? out : {};
  }
  // primitive (string/number/boolean)
  return obj;
}

const normalizeVersionForFrontend = (version) => {
  if (!version) return version;
  // ensure analysis_response exists
  const rawAr = version.analysis_response || {};
  // deep-clean null values inside analysis_response
  const cleanedAr = removeNulls(rawAr);
  // put cleaned analysis_response back, keep original top-level metadata
  return {
    ...version,
    analysis_response: cleanedAr,
  };
};

export const apiService = {
  // User Management
  initUser: (data) => api.post('/api/user/init', data).then(res => res.data),
  
  // API Key Management
  getApiKeyStatus: () => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/user/api-key/status', {
      user_id: userId
    }).then(res => res.data);
  },
  
  saveApiKey: (apiKey) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/user/api-key', {
      user_id: userId,
      api_key: apiKey
    }).then(res => res.data);
  },
  
  // Cases
  fetchCases: () => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/cases/list', {
      user_id: userId
    }).then(res => res.data);
  },
  
  createCase: (name, description = '') => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/cases', {
      user_id: userId,
      name,
      description
    }).then(res => res.data);
  },
  
  fetchCase: (caseId) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/cases/get', {
      user_id: userId,
      case_id: caseId
    }).then(res => res.data);
  },
  
  updateCase: (caseId, updates) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/cases/update', {
      user_id: userId,
      case_id: caseId,
      ...updates
    }).then(res => res.data);
  },
  
  deleteCase: (caseId) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/cases/delete', {
      user_id: userId,
      case_id: caseId
    }).then(res => res.data);
  },
  
  // Versions
  fetchVersion: (versionId) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/versions/get', {
      user_id: userId,
      version_id: versionId
    })
    .then(res => {
      const version = res.data || {};
      // Normalize/clean so frontend snapshot is tidy and shows full analysis_response
      return normalizeVersionForFrontend(version);
    })
    .catch(err => {
      // bubble up
      console.error('[API] fetchVersion failed', err);
      throw err;
    });
  },

  
  listVersions: (caseId) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/versions/list', {
      user_id: userId,
      case_id: caseId
    }).then(res => res.data);
  },
  
  // Analysis
  runAnalysis: (payload) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/analyze', {
      ...payload,
      user_id: userId
    }).then(res => res.data);
  },
  
  runDeepDive: (payload) => {
  const userId = localStorage.getItem('user_id');
  
  // 🔍 DEBUG
  console.log('🔥 API_BASE_URL:', API_BASE_URL);
  console.log('🔥 Full URL will be:', `${API_BASE_URL}/api/deep-dive`);
  
  return api.post('/api/deep-dive', {
    ...payload,
    user_id: userId
  }).then(res => res.data);
},
  // Team & Collaboration
  fetchTeamMembers: (caseId) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/team/members', {
      user_id: userId,
      case_id: caseId
    }).then(res => {
      return res.data.members || [];
    });
  },
  
  inviteMember: (data) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/team/invite', {
      user_id: userId,
      ...data
    }).then(res => res.data);
  },
  
  fetchPendingInvitations: () => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/invitations/pending', {
      user_id: userId
    }).then(res => res.data);
  },
  
  respondToInvitation: (invitationId, action) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/invitations/respond', {
      user_id: userId,
      invitation_id: invitationId,
      action
    }).then(res => res.data);
  },
  
  // Comments
  fetchComments: (versionId) => {
    return api.post('/api/comments/list', {
      version_id: versionId
    }).then(res => res.data);
  },
  
  addComment: (data) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/comments/create', {
      user_id: userId,
      ...data
    }).then(res => res.data);
  },
  
  // Notifications
  fetchNotifications: () => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/notifications/list', {
      user_id: userId
    }).then(res => res.data);
  },
  
  markNotificationAsRead: (notificationId) => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/notifications/read', {
      user_id: userId,
      notification_id: notificationId
    }).then(res => res.data);
  },
  
  markAllNotificationsAsRead: () => {
    const userId = localStorage.getItem('user_id');
    return api.post('/api/notifications/read-all', {
      user_id: userId
    }).then(res => res.data);
  },
  
// Replace the checkSubscription function in api.js with this:

checkSubscription: () => {
  const userId = localStorage.getItem('user_id');
  
  if (!userId) {
    return Promise.resolve({
      tier: 'free',
      is_premium: false,
      deep_dives_remaining: 0,
      deep_dive_reset_date: null
    });
  }
  
  return api.post('/api/subscription/check', { user_id: userId })
    .then(res => {
      console.log('[API] Subscription check response:', res.data);
      
      // Backend now returns lowercase strings
      const tier = (res.data.tier || 'free').toLowerCase();
      const isPremium = tier === 'pro';
      
      return {
        tier: tier,  // "free" or "pro" as lowercase string
        is_premium: isPremium,
        deep_dives_remaining: parseInt(res.data.deep_dives_remaining || 0),
        deep_dive_reset_date: res.data.deep_dive_reset_date
      };
    })
    .catch(error => {
      console.error('Subscription check API failed:', error);
      return {
        tier: 'free',
        is_premium: false,
        deep_dives_remaining: 0,
        deep_dive_reset_date: null
      };
    });
},
  
  upgradeToPro: () => {
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      return Promise.reject(new Error('User not logged in'));
    }
    
    return api.post('/api/subscription/upgrade', { user_id: userId })
      .then(res => res.data)
      .catch(error => {
        console.error('Demo upgrade failed:', error);
        throw error;
      });
  },
  
  // Payment Methods
  createOrder: () => {
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      return Promise.reject(new Error('User not logged in'));
    }
    
    return api.post('/api/payments/create-order', { user_id: userId })
      .then(res => {
        console.log('Order created:', res.data);
        return res.data;
      })
      .catch(error => {
        console.error('Create order failed:', error);
        throw error;
      });
  },
  
  verifyPayment: (paymentData) => {
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      return Promise.reject(new Error('User not logged in'));
    }
    
    return api.post('/api/payments/verify', {
      user_id: userId,
      ...paymentData
    })
    .then(res => {
      console.log('Payment verified:', res.data);
      return res.data;
    })
    .catch(error => {
      console.error('Payment verification failed:', error);
      throw error;
    });
  }
};

// Response interceptors for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const token = await authService.getAuthToken();
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
      
      await authService.signOut();
      window.location.href = '/login';
    }
    
    // Handle other errors
    if (error.response?.status === 403) {
      alert('Access denied. You do not have permission to perform this action.');
    } else if (error.response?.status === 404) {
      console.error('Resource not found:', error.config.url);
    } else if (error.response?.status >= 500) {
      alert('Server error. Please try again later.');
    }
    
    return Promise.reject(error);
  }
);

export default apiService;