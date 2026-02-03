/**
 * Oney & Co — UI Components
 * 共享 UI 组件库
 * Version: 1.0.0
 * Date: 2026-02-03
 */

const OneyUI = (function() {
  'use strict';
  
  // ========================================
  // Logo Components
  // ========================================
  
  /**
   * Generate Oney & Co Logo SVG
   * @param {Object} options - { width, height, variant: 'full'|'icon' }
   */
  function logo(options = {}) {
    const { 
      width = 180, 
      height = 75, 
      variant = 'full',
      textColor = '#ffffff'
    } = options;
    
    if (variant === 'icon') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${width}" height="${height}">
        <defs><linearGradient id="oneyGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#2ECC85"/><stop offset="100%" style="stop-color:#1FAD73"/></linearGradient></defs>
        <g transform="translate(50, 50)"><path d="M 0 -38 A 38 38 0 1 0 0 -37.99" fill="none" stroke="url(#oneyGrad)" stroke-width="8" stroke-linecap="round" stroke-dasharray="227 12"/><path d="M0 -45 L0 -52" stroke="url(#oneyGrad)" stroke-width="6" stroke-linecap="round"/></g>
      </svg>`;
    }
    
    // Full logo
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 90" width="${width}" height="${height}">
      <defs><linearGradient id="oneyLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#2ECC85"/><stop offset="100%" style="stop-color:#1FAD73"/></linearGradient></defs>
      <g transform="translate(45, 45)"><path d="M 0 -32 A 32 32 0 1 0 0 -31.99" fill="none" stroke="url(#oneyLogoGrad)" stroke-width="7" stroke-linecap="round" stroke-dasharray="191 10"/><path d="M0 -38 L0 -44" stroke="url(#oneyLogoGrad)" stroke-width="5" stroke-linecap="round"/></g>
      <text x="85" y="54" font-family="Inter, Arial" font-size="28" font-weight="700" fill="${textColor}">ney</text>
      <text x="133" y="54" font-family="Inter, Arial" font-size="20" fill="url(#oneyLogoGrad)">&amp;</text>
      <text x="151" y="54" font-family="Inter, Arial" font-size="28" font-weight="700" fill="${textColor}">co</text>
    </svg>`;
  }
  
  /**
   * Generate watermark SVG
   */
  function watermark() {
    return `<svg class="oney-watermark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="position:fixed;top:24px;left:24px;width:80px;height:80px;opacity:0.08;z-index:1;pointer-events:none;">
      <defs><linearGradient id="wmGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#2ECC85"/><stop offset="100%" style="stop-color:#1FAD73"/></linearGradient></defs>
      <g transform="translate(50, 50)"><path d="M 0 -38 A 38 38 0 1 0 0 -37.99" fill="none" stroke="url(#wmGrad)" stroke-width="8" stroke-linecap="round" stroke-dasharray="227 12"/><path d="M0 -45 L0 -52" stroke="url(#wmGrad)" stroke-width="6" stroke-linecap="round"/></g>
    </svg>`;
  }
  
  /**
   * Generate favicon data URL
   */
  function faviconUrl() {
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%232ECC85'/><stop offset='100%25' stop-color='%231FAD73'/></linearGradient></defs><g transform='translate(50,50)'><path d='M0-38A38 38 0 1 0 0-37.99' fill='none' stroke='url(%23g)' stroke-width='8' stroke-linecap='round' stroke-dasharray='227 12'/><path d='M0-45L0-52' stroke='url(%23g)' stroke-width='6' stroke-linecap='round'/></g></svg>`;
  }
  
  // ========================================
  // Form Components
  // ========================================
  
  /**
   * Create form input element
   */
  function input(options = {}) {
    const {
      id,
      label,
      type = 'text',
      placeholder = '',
      value = '',
      inputmode = 'text',
      step,
      format = null, // 'number', 'currency', 'percent'
      className = ''
    } = options;
    
    const formatAttr = format === 'number' || format === 'currency' 
      ? `onkeyup="OneyUI.formatNumber(this)"` 
      : '';
    const stepAttr = step ? `step="${step}"` : '';
    
    return `
      <div class="form-group ${className}">
        ${label ? `<label class="form-label" for="${id}">${label}</label>` : ''}
        <input 
          type="${type}" 
          id="${id}" 
          class="form-input"
          placeholder="${placeholder}"
          value="${value}"
          inputmode="${inputmode}"
          ${stepAttr}
          ${formatAttr}
        >
      </div>
    `;
  }
  
  /**
   * Create select element
   */
  function select(options = {}) {
    const {
      id,
      label,
      options: selectOptions = [],
      value = '',
      className = ''
    } = options;
    
    const optionsHtml = selectOptions.map(opt => {
      const val = typeof opt === 'object' ? opt.value : opt;
      const text = typeof opt === 'object' ? opt.label : opt;
      const selected = val === value ? 'selected' : '';
      return `<option value="${val}" ${selected}>${text}</option>`;
    }).join('');
    
    return `
      <div class="form-group ${className}">
        ${label ? `<label class="form-label" for="${id}">${label}</label>` : ''}
        <select id="${id}" class="form-select">${optionsHtml}</select>
      </div>
    `;
  }
  
  /**
   * Format number with commas
   */
  function formatNumber(input) {
    let value = input.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
    if (value) {
      const parts = value.split('.');
      parts[0] = parseInt(parts[0]).toLocaleString();
      input.value = parts.join('.');
    }
  }
  
  /**
   * Parse formatted number string to float
   */
  function parseNumber(str) {
    return parseFloat((str || '').toString().replace(/,/g, '')) || 0;
  }
  
  // ========================================
  // Card Components
  // ========================================
  
  /**
   * Create a card component
   */
  function card(options = {}) {
    const {
      title,
      icon,
      content,
      variant = '', // 'featured', 'premium', 'glow'
      className = ''
    } = options;
    
    const variantClass = variant ? `card-${variant}` : '';
    
    return `
      <div class="card ${variantClass} ${className}">
        ${title ? `<div class="card-title">${icon ? icon + ' ' : ''}${title}</div>` : ''}
        ${content}
      </div>
    `;
  }
  
  /**
   * Create a tool card (for tool listing)
   */
  function toolCard(options = {}) {
    const {
      href,
      icon,
      name,
      description,
      badge, // { text, type: 'free'|'beta'|'coming'|'pro' }
      variant = '',
      disabled = false
    } = options;
    
    const variantClass = variant ? `card-${variant}` : '';
    const disabledStyle = disabled ? 'style="opacity: 0.6; pointer-events: none;"' : '';
    const badgeHtml = badge ? `<span class="badge badge-${badge.type}">${badge.text}</span>` : '';
    
    return `
      <a href="${href}" class="card card-link ${variantClass}" ${disabledStyle}>
        <div class="tool-icon" style="font-size: 28px; margin-bottom: 12px;">${icon}</div>
        <div class="tool-name" style="font-size: 17px; font-weight: 600; margin-bottom: 6px;">${name}</div>
        <div class="tool-desc" style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">${description}</div>
        ${badgeHtml}
      </a>
    `;
  }
  
  // ========================================
  // Metric & Status Components
  // ========================================
  
  /**
   * Create a metric display
   */
  function metric(options = {}) {
    const {
      id,
      value = '--',
      label,
      status = '', // 'pass', 'warn', 'fail'
      className = ''
    } = options;
    
    return `
      <div class="metric ${status} ${className}" ${id ? `id="${id}"` : ''}>
        <div class="metric-value">${value}</div>
        <div class="metric-label">${label}</div>
      </div>
    `;
  }
  
  /**
   * Create a metrics grid
   */
  function metricsGrid(metrics, columns = 2) {
    const metricsHtml = metrics.map(m => metric(m)).join('');
    return `<div class="grid gap-md" style="grid-template-columns: repeat(${columns}, 1fr);">${metricsHtml}</div>`;
  }
  
  /**
   * Create status bar
   */
  function statusBar(options = {}) {
    const {
      id,
      text = 'Calculating...',
      status = 'pass', // 'pass', 'warn', 'fail'
      icon = ''
    } = options;
    
    const icons = {
      pass: '✓',
      warn: '⚠',
      fail: '✗'
    };
    
    return `
      <div class="status-bar status-${status}" ${id ? `id="${id}"` : ''}>
        <span>${icon || icons[status]}</span>
        <span ${id ? `id="${id}Text"` : ''}>${text}</span>
      </div>
    `;
  }
  
  // ========================================
  // Button Components
  // ========================================
  
  /**
   * Create a button
   */
  function button(options = {}) {
    const {
      text,
      icon,
      variant = 'primary', // 'primary', 'secondary', 'ghost'
      size = '', // 'sm', 'lg'
      pill = false,
      full = false,
      onclick = '',
      className = ''
    } = options;
    
    const classes = [
      'btn',
      `btn-${variant}`,
      size && `btn-${size}`,
      pill && 'btn-pill',
      full && 'btn-full',
      className
    ].filter(Boolean).join(' ');
    
    const iconHtml = icon ? `<span>${icon}</span>` : '';
    
    return `<button class="${classes}" ${onclick ? `onclick="${onclick}"` : ''}>${iconHtml}${text}</button>`;
  }
  
  // ========================================
  // Modal Components
  // ========================================
  
  /**
   * Create a modal/overlay
   */
  function modal(options = {}) {
    const {
      id = 'modal',
      title,
      content,
      showClose = true,
      className = ''
    } = options;
    
    const closeBtn = showClose 
      ? `<button class="btn btn-ghost" onclick="OneyUI.closeModal('${id}')" style="position:absolute;top:16px;right:16px;">✕</button>` 
      : '';
    
    return `
      <div id="${id}" class="modal-overlay hidden ${className}" onclick="if(event.target===this)OneyUI.closeModal('${id}')">
        <div class="card" style="max-width:400px;width:90%;position:relative;">
          ${closeBtn}
          ${title ? `<h2 style="margin-bottom:16px;">${title}</h2>` : ''}
          ${content}
        </div>
      </div>
    `;
  }
  
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
  }
  
  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
  }
  
  // ========================================
  // Password Gate Component
  // ========================================
  
  /**
   * Create password gate overlay
   */
  function passwordGate(options = {}) {
    const {
      password = '',
      title = '🔒 Internal Testing',
      description = 'Enter password to access.',
      onSuccess = null
    } = options;
    
    // Store password in closure
    window._oneyPassword = password;
    window._oneyPasswordSuccess = onSuccess;
    
    return `
      <div class="modal-overlay" id="passwordGate" style="background:var(--bg-primary);position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999;">
        <div class="card text-center" style="max-width:400px;width:90%;">
          <h2 style="margin-bottom:8px;">${title}</h2>
          <p class="text-muted" style="margin-bottom:24px;">${description}</p>
          <input type="password" class="form-input text-center" id="passwordInput" placeholder="Enter password" style="margin-bottom:16px;" onkeypress="if(event.key==='Enter')OneyUI.checkPassword()">
          <button class="btn btn-primary btn-full btn-pill" onclick="OneyUI.checkPassword()">Access →</button>
          <p id="passwordError" class="text-danger hidden" style="margin-top:12px;">Incorrect password.</p>
        </div>
      </div>
    `;
  }
  
  /**
   * Check password and unlock
   */
  function checkPassword() {
    const input = document.getElementById('passwordInput');
    const gate = document.getElementById('passwordGate');
    const error = document.getElementById('passwordError');
    const mainContent = document.getElementById('mainContent');
    
    if (input.value === window._oneyPassword) {
      if (typeof OneyStorage !== 'undefined') {
        OneyStorage.setAuthenticated(true);
      } else {
        sessionStorage.setItem('oney_auth', 'true');
      }
      
      gate.classList.add('hidden');
      if (mainContent) mainContent.classList.remove('hidden');
      
      if (window._oneyPasswordSuccess) {
        window._oneyPasswordSuccess();
      }
    } else {
      error.classList.remove('hidden');
      input.value = '';
      input.focus();
    }
  }
  
  /**
   * Check if already authenticated
   */
  function isAuthenticated() {
    if (typeof OneyStorage !== 'undefined') {
      return OneyStorage.isAuthenticated();
    }
    return sessionStorage.getItem('oney_auth') === 'true';
  }
  
  // ========================================
  // Toast Notifications
  // ========================================
  
  /**
   * Show toast notification
   */
  function toast(message, options = {}) {
    const {
      type = 'info', // 'success', 'warning', 'error', 'info'
      duration = 3000
    } = options;
    
    // Create toast container if not exists
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:10000;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(container);
    }
    
    const colors = {
      success: 'var(--status-success)',
      warning: 'var(--status-warning)',
      error: 'var(--status-danger)',
      info: 'var(--oney-green)'
    };
    
    const toastEl = document.createElement('div');
    toastEl.style.cssText = `
      background: var(--bg-card);
      border: 1px solid ${colors[type]};
      color: ${colors[type]};
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 14px;
      animation: fadeIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    toastEl.textContent = message;
    container.appendChild(toastEl);
    
    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(20px)';
      toastEl.style.transition = 'all 0.3s ease';
      setTimeout(() => toastEl.remove(), 300);
    }, duration);
  }
  
  // ========================================
  // Loading States
  // ========================================
  
  /**
   * Show loading spinner
   */
  function loading(show = true, options = {}) {
    const { target = 'body', text = 'Loading...' } = options;
    const loaderId = 'oneyLoader';
    
    let existing = document.getElementById(loaderId);
    
    if (show) {
      if (existing) return;
      
      const loader = document.createElement('div');
      loader.id = loaderId;
      loader.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,10,0.8);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;';
      loader.innerHTML = `
        <div style="width:40px;height:40px;border:3px solid var(--border-color);border-top-color:var(--oney-green);border-radius:50%;animation:spin 1s linear infinite;"></div>
        <p style="margin-top:16px;color:var(--text-muted);">${text}</p>
      `;
      
      // Add spin keyframes if not exists
      if (!document.getElementById('spinKeyframes')) {
        const style = document.createElement('style');
        style.id = 'spinKeyframes';
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
      }
      
      document.body.appendChild(loader);
    } else {
      if (existing) existing.remove();
    }
  }
  
  // ========================================
  // Copy to Clipboard
  // ========================================
  
  /**
   * Copy text to clipboard with feedback
   */
  async function copyToClipboard(text, successMessage = 'Copied!') {
    try {
      await navigator.clipboard.writeText(text);
      toast(successMessage, { type: 'success' });
      return true;
    } catch (e) {
      toast('Failed to copy', { type: 'error' });
      return false;
    }
  }
  
  // ========================================
  // Section Header
  // ========================================
  
  /**
   * Create section header with line
   */
  function sectionTitle(text, icon = '') {
    return `
      <h2 class="card-title" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        ${icon}${text}
        <span style="flex:1;height:1px;background:var(--border-color);"></span>
      </h2>
    `;
  }
  
  // ========================================
  // Footer
  // ========================================
  
  /**
   * Generate standard footer
   */
  function footer(options = {}) {
    const {
      email = 'dong.m@oneyco.com.au',
      showYear = true
    } = options;
    
    const year = showYear ? new Date().getFullYear() : '';
    
    return `
      <footer class="text-center p-lg" style="border-top:1px solid var(--border-color);color:var(--text-muted);font-size:13px;">
        <p>© ${year} Oney & Co — Financial Health for Everyone</p>
        ${email ? `<p style="margin-top:8px;">Questions? <a href="mailto:${email}" style="color:var(--oney-green);text-decoration:none;">${email}</a></p>` : ''}
      </footer>
    `;
  }
  
  // ========================================
  // Initialization Helper
  // ========================================
  
  /**
   * Initialize standard page with watermark, auth check
   */
  function initPage(options = {}) {
    const {
      password = null,
      requireAuth = false
    } = options;
    
    // Add watermark
    document.body.insertAdjacentHTML('afterbegin', watermark());
    
    // Check auth if needed
    if (requireAuth && password) {
      if (!isAuthenticated()) {
        document.body.insertAdjacentHTML('afterbegin', passwordGate({ password }));
        const mainContent = document.getElementById('mainContent');
        if (mainContent) mainContent.classList.add('hidden');
      } else {
        const gate = document.getElementById('passwordGate');
        if (gate) gate.remove();
      }
    }
  }
  
  // ========================================
  // Public API
  // ========================================
  
  return {
    // Logo & Branding
    logo,
    watermark,
    faviconUrl,
    
    // Forms
    input,
    select,
    formatNumber,
    parseNumber,
    
    // Cards
    card,
    toolCard,
    
    // Metrics & Status
    metric,
    metricsGrid,
    statusBar,
    
    // Buttons
    button,
    
    // Modal
    modal,
    openModal,
    closeModal,
    
    // Password Gate
    passwordGate,
    checkPassword,
    isAuthenticated,
    
    // Toast
    toast,
    
    // Loading
    loading,
    
    // Clipboard
    copyToClipboard,
    
    // Layout
    sectionTitle,
    footer,
    
    // Init
    initPage
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OneyUI;
}
