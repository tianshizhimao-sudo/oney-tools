/**
 * Oney & Co — Storage Module
 * 统一数据存储管理
 * Version: 1.0.0
 * Date: 2026-02-03
 */

const OneyStorage = (function() {
  'use strict';
  
  // Storage keys
  const KEYS = {
    USER_PROFILE: 'oney_user_profile',
    AUTH: 'oney_auth',
    PREFERENCES: 'oney_preferences',
    RECENT_CALCS: 'oney_recent_calculations',
    SESSION: 'oney_session'
  };
  
  // Default user profile schema
  const DEFAULT_PROFILE = {
    version: '1.0.0',
    lastUpdated: null,
    personal: {
      name: '',
      email: '',
      phone: ''
    },
    income: {
      salary: 0,
      rental: 0,
      business: 0,
      other: 0
    },
    expenses: {
      living: 0,
      existing_debt: 0,
      other: 0
    },
    property: {
      value: 0,
      existing_debt: 0,
      state: 'NSW',
      type: 'residential'
    },
    business: {
      name: '',
      industry: '',
      abn: '',
      revenue: 0,
      ebitda: 0,
      ebit: 0
    },
    preferences: {
      currency: 'AUD',
      remember_inputs: true
    }
  };
  
  // ========================================
  // Core Storage Functions
  // ========================================
  
  /**
   * Get item from localStorage with JSON parsing
   */
  function get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (e) {
      console.warn('[OneyStorage] Error reading:', key, e);
      return defaultValue;
    }
  }
  
  /**
   * Set item to localStorage with JSON stringification
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[OneyStorage] Error writing:', key, e);
      return false;
    }
  }
  
  /**
   * Remove item from localStorage
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('[OneyStorage] Error removing:', key, e);
      return false;
    }
  }
  
  /**
   * Clear all Oney-related storage
   */
  function clearAll() {
    Object.values(KEYS).forEach(key => remove(key));
  }
  
  // ========================================
  // User Profile Functions
  // ========================================
  
  /**
   * Get user profile, creating default if not exists
   */
  function getProfile() {
    let profile = get(KEYS.USER_PROFILE, null);
    if (!profile) {
      profile = { ...DEFAULT_PROFILE };
      profile.lastUpdated = new Date().toISOString();
      set(KEYS.USER_PROFILE, profile);
    }
    return profile;
  }
  
  /**
   * Update user profile (deep merge)
   */
  function updateProfile(updates) {
    const profile = getProfile();
    const merged = deepMerge(profile, updates);
    merged.lastUpdated = new Date().toISOString();
    set(KEYS.USER_PROFILE, merged);
    return merged;
  }
  
  /**
   * Update specific section of profile
   */
  function updateSection(section, data) {
    const profile = getProfile();
    if (profile[section]) {
      profile[section] = { ...profile[section], ...data };
      profile.lastUpdated = new Date().toISOString();
      set(KEYS.USER_PROFILE, profile);
    }
    return profile;
  }
  
  /**
   * Get specific section from profile
   */
  function getSection(section) {
    const profile = getProfile();
    return profile[section] || null;
  }
  
  // ========================================
  // Session Storage (auth, temp data)
  // ========================================
  
  /**
   * Check if user is authenticated
   */
  function isAuthenticated() {
    return sessionStorage.getItem(KEYS.AUTH) === 'true';
  }
  
  /**
   * Set authentication status
   */
  function setAuthenticated(status) {
    if (status) {
      sessionStorage.setItem(KEYS.AUTH, 'true');
    } else {
      sessionStorage.removeItem(KEYS.AUTH);
    }
  }
  
  /**
   * Get session data
   */
  function getSession(key, defaultValue = null) {
    try {
      const data = sessionStorage.getItem(`${KEYS.SESSION}_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }
  
  /**
   * Set session data
   */
  function setSession(key, value) {
    try {
      sessionStorage.setItem(`${KEYS.SESSION}_${key}`, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // ========================================
  // Recent Calculations
  // ========================================
  
  /**
   * Save a calculation to history (max 10)
   */
  function saveCalculation(toolId, data) {
    const calcs = get(KEYS.RECENT_CALCS, []);
    const newCalc = {
      id: Date.now(),
      tool: toolId,
      timestamp: new Date().toISOString(),
      data: data
    };
    
    // Add to front, limit to 10
    calcs.unshift(newCalc);
    if (calcs.length > 10) calcs.pop();
    
    set(KEYS.RECENT_CALCS, calcs);
    return newCalc;
  }
  
  /**
   * Get recent calculations
   */
  function getRecentCalculations(toolId = null, limit = 10) {
    let calcs = get(KEYS.RECENT_CALCS, []);
    if (toolId) {
      calcs = calcs.filter(c => c.tool === toolId);
    }
    return calcs.slice(0, limit);
  }
  
  /**
   * Clear calculation history
   */
  function clearCalculations() {
    return remove(KEYS.RECENT_CALCS);
  }
  
  // ========================================
  // URL Parameter Handling
  // ========================================
  
  /**
   * Parse URL parameters and auto-fill profile data
   */
  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const data = {};
    
    // Map common URL params to profile fields
    const mapping = {
      // Income
      'income': 'income.salary',
      'salary': 'income.salary',
      'rental': 'income.rental',
      'rental_income': 'income.rental',
      
      // Property
      'property_value': 'property.value',
      'prop_value': 'property.value',
      'property_debt': 'property.existing_debt',
      'state': 'property.state',
      
      // Business
      'revenue': 'business.revenue',
      'ebitda': 'business.ebitda',
      'ebit': 'business.ebit',
      'industry': 'business.industry',
      
      // Loan params (stored in session)
      'loan': '_loan_amount',
      'loan_amount': '_loan_amount',
      'rate': '_interest_rate',
      'interest_rate': '_interest_rate',
      'term': '_loan_term'
    };
    
    params.forEach((value, key) => {
      const mappedKey = mapping[key.toLowerCase()];
      if (mappedKey) {
        // Parse numeric values
        const numValue = parseFloat(value.replace(/,/g, ''));
        data[mappedKey] = isNaN(numValue) ? value : numValue;
      }
    });
    
    return data;
  }
  
  /**
   * Apply URL params to profile and session
   */
  function applyUrlParams() {
    const params = parseUrlParams();
    const profileUpdates = {};
    const sessionData = {};
    
    Object.entries(params).forEach(([key, value]) => {
      if (key.startsWith('_')) {
        // Session data (temp loan params)
        sessionData[key.substring(1)] = value;
      } else {
        // Profile data (nested path like 'income.salary')
        const parts = key.split('.');
        if (parts.length === 2) {
          if (!profileUpdates[parts[0]]) profileUpdates[parts[0]] = {};
          profileUpdates[parts[0]][parts[1]] = value;
        }
      }
    });
    
    // Update profile if there's data
    if (Object.keys(profileUpdates).length > 0) {
      updateProfile(profileUpdates);
    }
    
    // Store session data
    Object.entries(sessionData).forEach(([key, value]) => {
      setSession(key, value);
    });
    
    return { profile: profileUpdates, session: sessionData };
  }
  
  /**
   * Generate URL with data params for sharing/linking
   */
  function generateUrl(toolPath, data = {}) {
    const url = new URL(toolPath, window.location.origin);
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' && value !== 0) {
        url.searchParams.set(key, value);
      }
    });
    
    return url.toString();
  }
  
  // ========================================
  // Preferences
  // ========================================
  
  /**
   * Get user preferences
   */
  function getPreferences() {
    return get(KEYS.PREFERENCES, {
      theme: 'dark',
      currency: 'AUD',
      remember_inputs: true,
      auto_save: true
    });
  }
  
  /**
   * Update preferences
   */
  function updatePreferences(prefs) {
    const current = getPreferences();
    const merged = { ...current, ...prefs };
    set(KEYS.PREFERENCES, merged);
    return merged;
  }
  
  // ========================================
  // Utilities
  // ========================================
  
  /**
   * Deep merge two objects
   */
  function deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
          output[key] = deepMerge(target[key], source[key]);
        } else {
          output[key] = source[key];
        }
      }
    }
    
    return output;
  }
  
  /**
   * Get storage usage stats
   */
  function getStorageStats() {
    let totalSize = 0;
    const items = {};
    
    Object.values(KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        const size = new Blob([item]).size;
        items[key] = size;
        totalSize += size;
      }
    });
    
    return {
      total: totalSize,
      items: items,
      percentage: (totalSize / (5 * 1024 * 1024) * 100).toFixed(2) // 5MB limit
    };
  }
  
  // ========================================
  // Public API
  // ========================================
  
  return {
    // Keys reference
    KEYS,
    
    // Core
    get,
    set,
    remove,
    clearAll,
    
    // Profile
    getProfile,
    updateProfile,
    updateSection,
    getSection,
    
    // Session
    isAuthenticated,
    setAuthenticated,
    getSession,
    setSession,
    
    // Calculations
    saveCalculation,
    getRecentCalculations,
    clearCalculations,
    
    // URL Params
    parseUrlParams,
    applyUrlParams,
    generateUrl,
    
    // Preferences
    getPreferences,
    updatePreferences,
    
    // Utils
    getStorageStats
  };
})();

// Auto-apply URL params on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const applied = OneyStorage.applyUrlParams();
    if (Object.keys(applied.profile).length > 0 || Object.keys(applied.session).length > 0) {
      console.log('[OneyStorage] Applied URL params:', applied);
    }
  });
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OneyStorage;
}
