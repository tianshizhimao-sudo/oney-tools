/**
 * Oney & Co — Utility Functions
 * 通用工具函数
 * Version: 1.0.0
 * Date: 2026-02-03
 */

const OneyUtils = (function() {
  'use strict';
  
  // ========================================
  // Number Formatting
  // ========================================
  
  /**
   * Format number with thousand separators
   */
  function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    return Number(num).toLocaleString('en-AU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  /**
   * Format as currency (AUD)
   */
  function formatCurrency(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    return '$' + formatNumber(num, decimals);
  }
  
  /**
   * Format as percentage
   */
  function formatPercent(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    return formatNumber(num, decimals) + '%';
  }
  
  /**
   * Format as multiplier (e.g., 1.50x)
   */
  function formatMultiple(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    return formatNumber(num, decimals) + 'x';
  }
  
  /**
   * Format compact number (e.g., 1.5M, 500K)
   */
  function formatCompact(num) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if (absNum >= 1e9) return sign + (absNum / 1e9).toFixed(1) + 'B';
    if (absNum >= 1e6) return sign + (absNum / 1e6).toFixed(1) + 'M';
    if (absNum >= 1e3) return sign + (absNum / 1e3).toFixed(0) + 'K';
    return sign + formatNumber(absNum);
  }
  
  /**
   * Parse string to number (removes formatting)
   */
  function parseNumber(str) {
    if (typeof str === 'number') return str;
    return parseFloat((str || '').toString().replace(/[,$%]/g, '').trim()) || 0;
  }
  
  // ========================================
  // Date Formatting
  // ========================================
  
  /**
   * Format date
   */
  function formatDate(date, format = 'short') {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '--';
    
    const options = {
      short: { day: '2-digit', month: 'short', year: 'numeric' },
      long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
      iso: null
    };
    
    if (format === 'iso') {
      return d.toISOString().split('T')[0];
    }
    
    return d.toLocaleDateString('en-AU', options[format] || options.short);
  }
  
  /**
   * Get relative time (e.g., "2 hours ago")
   */
  function timeAgo(date) {
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const seconds = Math.floor((now - d) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };
    
    for (const [unit, secs] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secs);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }
    
    return 'just now';
  }
  
  // ========================================
  // Financial Calculations
  // ========================================
  
  /**
   * Calculate monthly repayment (P&I)
   */
  function calcMonthlyRepayment(principal, annualRate, years) {
    const monthlyRate = annualRate / 100 / 12;
    const numPayments = years * 12;
    
    if (monthlyRate === 0) return principal / numPayments;
    
    return principal * 
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  }
  
  /**
   * Calculate interest only payment
   */
  function calcInterestOnly(principal, annualRate) {
    return principal * (annualRate / 100 / 12);
  }
  
  /**
   * Calculate annual interest
   */
  function calcAnnualInterest(principal, annualRate) {
    return principal * (annualRate / 100);
  }
  
  /**
   * Calculate LVR (Loan to Value Ratio)
   */
  function calcLVR(loanAmount, propertyValue) {
    if (!propertyValue || propertyValue === 0) return 0;
    return (loanAmount / propertyValue) * 100;
  }
  
  /**
   * Calculate ICR (Interest Coverage Ratio)
   */
  function calcICR(netIncome, annualInterest) {
    if (!annualInterest || annualInterest === 0) return 0;
    return netIncome / annualInterest;
  }
  
  /**
   * Calculate DSCR (Debt Service Coverage Ratio)
   */
  function calcDSCR(netOperatingIncome, annualDebtService) {
    if (!annualDebtService || annualDebtService === 0) return 0;
    return netOperatingIncome / annualDebtService;
  }
  
  /**
   * Determine status based on value and thresholds
   */
  function getStatus(value, passThreshold, warnThreshold, isHigherBetter = true) {
    if (isHigherBetter) {
      if (value >= passThreshold) return 'pass';
      if (value >= warnThreshold) return 'warn';
      return 'fail';
    } else {
      if (value <= passThreshold) return 'pass';
      if (value <= warnThreshold) return 'warn';
      return 'fail';
    }
  }
  
  // ========================================
  // Australian Specific
  // ========================================
  
  /**
   * Australian states list
   */
  const AU_STATES = [
    { value: 'NSW', label: 'New South Wales' },
    { value: 'VIC', label: 'Victoria' },
    { value: 'QLD', label: 'Queensland' },
    { value: 'WA', label: 'Western Australia' },
    { value: 'SA', label: 'South Australia' },
    { value: 'TAS', label: 'Tasmania' },
    { value: 'ACT', label: 'Australian Capital Territory' },
    { value: 'NT', label: 'Northern Territory' }
  ];
  
  /**
   * Property types
   */
  const PROPERTY_TYPES = [
    { value: 'residential', label: 'Residential' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'retail', label: 'Retail' },
    { value: 'rural', label: 'Rural' },
    { value: 'mixed', label: 'Mixed Use' }
  ];
  
  /**
   * Industry types for specialised lending
   */
  const INDUSTRIES = [
    { value: 'financial-planning', label: 'Financial Planning' },
    { value: 'finance-broker', label: 'Finance Broker' },
    { value: 'accounting', label: 'Accounting' },
    { value: 'legal', label: 'Legal Services' },
    { value: 'real-estate', label: 'Real Estate' },
    { value: 'childcare', label: 'Childcare' },
    { value: 'medical', label: 'Medical Practice' },
    { value: 'hospitality', label: 'Hospitality' },
    { value: 'retail', label: 'Retail' },
    { value: 'other', label: 'Other' }
  ];
  
  // ========================================
  // Validation
  // ========================================
  
  /**
   * Validate email
   */
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  /**
   * Validate Australian phone number
   */
  function isValidPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 8 && cleaned.length <= 12;
  }
  
  /**
   * Validate ABN (Australian Business Number)
   */
  function isValidABN(abn) {
    const cleaned = abn.replace(/\D/g, '');
    if (cleaned.length !== 11) return false;
    
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;
    
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(cleaned[i], 10);
      sum += (i === 0 ? digit - 1 : digit) * weights[i];
    }
    
    return sum % 89 === 0;
  }
  
  // ========================================
  // DOM Helpers
  // ========================================
  
  /**
   * Get element by ID with type safety
   */
  function $(id) {
    return document.getElementById(id);
  }
  
  /**
   * Get element value by ID
   */
  function getValue(id) {
    const el = $(id);
    return el ? el.value : '';
  }
  
  /**
   * Get numeric value from element
   */
  function getNumericValue(id) {
    return parseNumber(getValue(id));
  }
  
  /**
   * Set element value
   */
  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value;
  }
  
  /**
   * Set element text content
   */
  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }
  
  /**
   * Set element HTML
   */
  function setHTML(id, html) {
    const el = $(id);
    if (el) el.innerHTML = html;
  }
  
  /**
   * Toggle class on element
   */
  function toggleClass(id, className, force) {
    const el = $(id);
    if (el) el.classList.toggle(className, force);
  }
  
  /**
   * Show/hide element
   */
  function show(id, visible = true) {
    toggleClass(id, 'hidden', !visible);
  }
  
  // ========================================
  // Debounce & Throttle
  // ========================================
  
  /**
   * Debounce function
   */
  function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  /**
   * Throttle function
   */
  function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // ========================================
  // Misc Utilities
  // ========================================
  
  /**
   * Generate unique ID
   */
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Deep clone object
   */
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
  
  /**
   * Check if object is empty
   */
  function isEmpty(obj) {
    if (!obj) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  }
  
  /**
   * Sleep/delay function
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ========================================
  // Public API
  // ========================================
  
  return {
    // Number formatting
    formatNumber,
    formatCurrency,
    formatPercent,
    formatMultiple,
    formatCompact,
    parseNumber,
    
    // Date formatting
    formatDate,
    timeAgo,
    
    // Financial calculations
    calcMonthlyRepayment,
    calcInterestOnly,
    calcAnnualInterest,
    calcLVR,
    calcICR,
    calcDSCR,
    getStatus,
    
    // Australian data
    AU_STATES,
    PROPERTY_TYPES,
    INDUSTRIES,
    
    // Validation
    isValidEmail,
    isValidPhone,
    isValidABN,
    
    // DOM helpers
    $,
    getValue,
    getNumericValue,
    setValue,
    setText,
    setHTML,
    toggleClass,
    show,
    
    // Function utilities
    debounce,
    throttle,
    
    // Misc
    generateId,
    deepClone,
    isEmpty,
    sleep
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OneyUtils;
}
