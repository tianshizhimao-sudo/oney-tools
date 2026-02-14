/**
 * ============================================
 * Oney Serve V4.1 — UI Module
 * DOM operations, event handling, and application logic
 * ============================================
 */

// ============================================
// MAIN APPLICATION
// ============================================
const App = {
  mode: 'single',
  repaymentType: 'io',
  portfolioRepaymentType: 'io',
  incomeMethod: 'net', // 'net' or 'gross'
  tenantCounter: 1,
  portfolioProperties: [],
  portfolioPropCounter: 0,
  lastResults: null,
  _autoSaveTimer: null,

  // ── Initialization ──
  init() {
    this.initTheme();
    this.bindCurrencyInputs();
    this.bindPropertyTypeHint();
    this.bindEnterKey();
    this.addPortfolioProperty(); // default first property for portfolio
    this.restoreData();
    this.bindAutoSave();
    this.bindLiveValidation();
  },

  // ══════════════════════════════════════════
  // THEME MANAGEMENT
  // ══════════════════════════════════════════

  initTheme() {
    const saved = localStorage.getItem('oney-serve-theme');
    if (saved === 'light') {
      document.documentElement.classList.add('light');
    }
  },

  toggleTheme() {
    const html = document.documentElement;
    const isLight = html.classList.toggle('light');
    localStorage.setItem('oney-serve-theme', isLight ? 'light' : 'dark');
  },

  // ══════════════════════════════════════════
  // TOAST NOTIFICATIONS
  // ══════════════════════════════════════════

  showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  },

  // ══════════════════════════════════════════
  // AUTO-SAVE / SAVE / RESTORE
  // ══════════════════════════════════════════

  /** Gather all form data into a serializable object */
  gatherFormData() {
    const data = {
      mode: this.mode,
      repaymentType: this.repaymentType,
      portfolioRepaymentType: this.portfolioRepaymentType,
      incomeMethod: this.incomeMethod,
      single: {
        loanAmount: document.getElementById('loanAmount').value,
        interestRate: document.getElementById('interestRate').value,
        loanTerm: document.getElementById('loanTerm').value,
        propertyValue: document.getElementById('propertyValue').value,
        propertyType: document.getElementById('propertyType').value,
        propertyTypeDesc: document.getElementById('propertyTypeDesc')?.value || '',
        rentalIncome: document.getElementById('rentalIncome').value,
        passingRent: document.getElementById('passingRent')?.value || '',
        outgoings: document.getElementById('outgoings')?.value || '',
        tenants: this.gatherTenantsData('#tenantList')
      },
      portfolio: {
        loanAmount: document.getElementById('pLoanAmount').value,
        interestRate: document.getElementById('pInterestRate').value,
        loanTerm: document.getElementById('pLoanTerm').value,
        properties: this.gatherPortfolioData()
      }
    };
    return data;
  },

  gatherTenantsData(selector) {
    const entries = document.querySelectorAll(`${selector} .tenant-entry`);
    return Array.from(entries).map(entry => ({
      name: entry.querySelector('.tenant-name')?.value || '',
      expiry: entry.querySelector('.tenant-expiry')?.value || '',
      rent: entry.querySelector('.tenant-rent')?.value || '',
      option: entry.querySelector('.tenant-option')?.value || '',
      noOption: entry.querySelector('.btn-no-option')?.classList.contains('active') || false
    }));
  },

  gatherPortfolioData() {
    const cards = document.querySelectorAll('#portfolioPropertiesContainer .property-card');
    return Array.from(cards).map(card => {
      const tenantList = card.querySelector('.pp-tenant-list');
      return {
        value: card.querySelector('.pp-value')?.value || '',
        income: card.querySelector('.pp-income')?.value || '',
        type: card.querySelector('.pp-type')?.value || 'industrial',
        typeDesc: card.querySelector('.pp-type-desc')?.value || '',
        tenants: tenantList ? this.gatherTenantsDataFromElement(tenantList) : []
      };
    });
  },

  gatherTenantsDataFromElement(listEl) {
    const entries = listEl.querySelectorAll('.tenant-entry');
    return Array.from(entries).map(entry => ({
      name: entry.querySelector('.tenant-name')?.value || '',
      expiry: entry.querySelector('.tenant-expiry')?.value || '',
      rent: entry.querySelector('.tenant-rent')?.value || '',
      option: entry.querySelector('.tenant-option')?.value || '',
      noOption: entry.querySelector('.btn-no-option')?.classList.contains('active') || false
    }));
  },

  /** Save to localStorage */
  saveData(showNotification = true) {
    try {
      const data = this.gatherFormData();
      localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(data));
      if (showNotification) this.showToast('💾 Auto-saved');
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  },

  /** Manual save with different toast */
  manualSave() {
    try {
      const data = this.gatherFormData();
      localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(data));
      this.showToast('✅ Saved successfully!');
    } catch (e) {
      this.showToast('❌ Save failed');
    }
  },

  /** Restore data from localStorage */
  restoreData() {
    try {
      const raw = localStorage.getItem(Config.STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      // Restore mode
      if (data.mode) {
        this.mode = data.mode;
        document.getElementById('modeSingle').classList.toggle('active', data.mode === 'single');
        document.getElementById('modePortfolio').classList.toggle('active', data.mode === 'portfolio');
        document.getElementById('singlePropertyInputs').classList.toggle('hidden', data.mode !== 'single');
        document.getElementById('portfolioInputs').classList.toggle('hidden', data.mode !== 'portfolio');
      }

      // Restore income method
      if (data.incomeMethod) {
        this.incomeMethod = data.incomeMethod;
        document.getElementById('incomeMethodNet').classList.toggle('active', data.incomeMethod === 'net');
        document.getElementById('incomeMethodGross').classList.toggle('active', data.incomeMethod === 'gross');
        document.getElementById('incomeNetWrapper').classList.toggle('hidden', data.incomeMethod !== 'net');
        document.getElementById('incomeGrossWrapper').classList.toggle('hidden', data.incomeMethod !== 'gross');
      }

      // Restore repayment types
      if (data.repaymentType) {
        this.repaymentType = data.repaymentType;
        document.getElementById('repayTypeIO').classList.toggle('active', data.repaymentType === 'io');
        document.getElementById('repayTypePI').classList.toggle('active', data.repaymentType === 'pi');
      }
      if (data.portfolioRepaymentType) {
        this.portfolioRepaymentType = data.portfolioRepaymentType;
        document.getElementById('pRepayTypeIO').classList.toggle('active', data.portfolioRepaymentType === 'io');
        document.getElementById('pRepayTypePI').classList.toggle('active', data.portfolioRepaymentType === 'pi');
      }

      // Restore single mode
      if (data.single) {
        const s = data.single;
        document.getElementById('loanAmount').value = s.loanAmount || '';
        document.getElementById('interestRate').value = s.interestRate || '7.50';
        document.getElementById('loanTerm').value = s.loanTerm || '5';
        document.getElementById('propertyValue').value = s.propertyValue || '';
        document.getElementById('propertyType').value = s.propertyType || 'industrial';
        if (document.getElementById('propertyTypeDesc')) {
          document.getElementById('propertyTypeDesc').value = s.propertyTypeDesc || '';
        }
        document.getElementById('rentalIncome').value = s.rentalIncome || '';

        if (document.getElementById('passingRent')) {
          document.getElementById('passingRent').value = s.passingRent || '';
        }
        if (document.getElementById('outgoings')) {
          document.getElementById('outgoings').value = s.outgoings || '';
        }
        this.updateCalculatedNetIncome();

        this.onPropertyTypeChange('single');

        if (s.tenants && s.tenants.length > 0) {
          this.restoreTenants('#tenantList', s.tenants);
        }
      }

      // Restore portfolio mode
      if (data.portfolio) {
        const p = data.portfolio;
        document.getElementById('pLoanAmount').value = p.loanAmount || '';
        document.getElementById('pInterestRate').value = p.interestRate || '7.50';
        document.getElementById('pLoanTerm').value = p.loanTerm || '5';

        if (p.properties && p.properties.length > 0) {
          document.getElementById('portfolioPropertiesContainer').innerHTML = '';
          this.portfolioPropCounter = 0;
          this._ppTenantCounters = {};

          p.properties.forEach((prop, idx) => {
            this.addPortfolioProperty();
            const card = document.querySelectorAll('#portfolioPropertiesContainer .property-card')[idx];
            if (!card) return;
            const valInput = card.querySelector('.pp-value');
            const incInput = card.querySelector('.pp-income');
            const typeSelect = card.querySelector('.pp-type');
            const typeDesc = card.querySelector('.pp-type-desc');

            if (valInput) valInput.value = prop.value || '';
            if (incInput) incInput.value = prop.income || '';
            if (typeSelect) typeSelect.value = prop.type || 'industrial';
            if (typeDesc) typeDesc.value = prop.typeDesc || '';

            this.onPropertyTypeChange(idx);

            const tenantList = card.querySelector('.pp-tenant-list');
            if (tenantList && prop.tenants && prop.tenants.length > 0) {
              this.restorePortfolioTenants(tenantList, prop.tenants, idx);
            }
          });
        }
      }

      this.showToast('📂 Data restored');
    } catch (e) {
      console.warn('Restore failed:', e);
    }
  },

  restoreTenants(selector, tenants) {
    const list = document.querySelector(selector);
    if (!list || !tenants.length) return;

    list.innerHTML = '';
    this.tenantCounter = 0;

    tenants.forEach((t, i) => {
      const id = this.tenantCounter++;
      const entry = document.createElement('div');
      entry.className = 'tenant-entry';
      entry.dataset.tenantId = id;
      entry.innerHTML = `
        ${i > 0 ? `<button class="tenant-remove-btn" onclick="App.removeTenant(${id})">×</button>` : ''}
        <div class="tenant-row">
          <div class="form-group">
            <label class="form-label">Tenant Name</label>
            <input type="text" class="tenant-name" placeholder="Tenant ${id + 1}" value="${this.escapeHtml(t.name)}">
          </div>
          <div class="form-group">
            <label class="form-label">Lease Expiry</label>
            <input type="date" class="tenant-expiry" value="${t.expiry || ''}">
            <div class="validation-hint tenant-expiry-hint"></div>
          </div>
        </div>
        <div class="form-group mt-12">
          <label class="form-label">Annual Rent ($)</label>
          <div class="input-wrapper">
            <span class="input-prefix">$</span>
            <input type="text" class="tenant-rent has-prefix currency-input" placeholder="60,000" inputmode="numeric" value="${this.escapeHtml(t.rent)}">
          </div>
        </div>
        <div class="lease-option-wrapper">
          <label class="form-label">Lease Option</label>
          <div class="lease-option-row">
            <input type="text" class="tenant-option" placeholder="e.g. 2x5yr option, 3+3+3" value="${this.escapeHtml(t.option)}" ${t.noOption ? 'disabled' : ''}>
            <button class="btn-no-option ${t.noOption ? 'active' : ''}" onclick="App.toggleNoOption(this)" title="No option">${t.noOption ? '✓ No Option' : 'No Option'}</button>
          </div>
        </div>
      `;
      list.appendChild(entry);
      entry.querySelectorAll('.currency-input').forEach(input => UIHelpers.setupCurrencyInput(input));
    });
  },

  restorePortfolioTenants(listEl, tenants, propIdx) {
    if (!listEl || !tenants.length) return;
    listEl.innerHTML = '';
    if (!this._ppTenantCounters[propIdx]) this._ppTenantCounters[propIdx] = 0;

    tenants.forEach((t, i) => {
      const tid = this._ppTenantCounters[propIdx]++;
      const entry = document.createElement('div');
      entry.className = 'tenant-entry';
      entry.dataset.tenantId = tid;
      entry.innerHTML = `
        ${i > 0 ? `<button class="tenant-remove-btn" onclick="this.closest('.tenant-entry').remove()">×</button>` : ''}
        <div class="tenant-row">
          <div class="form-group">
            <label class="form-label">Tenant</label>
            <input type="text" class="tenant-name" placeholder="Tenant ${tid + 1}" value="${this.escapeHtml(t.name)}">
          </div>
          <div class="form-group">
            <label class="form-label">Lease Expiry</label>
            <input type="date" class="tenant-expiry" value="${t.expiry || ''}">
            <div class="validation-hint tenant-expiry-hint"></div>
          </div>
        </div>
        <div class="form-group mt-12">
          <label class="form-label">Annual Rent ($)</label>
          <div class="input-wrapper">
            <span class="input-prefix">$</span>
            <input type="text" class="tenant-rent has-prefix currency-input" placeholder="30,000" inputmode="numeric" value="${this.escapeHtml(t.rent)}">
          </div>
        </div>
        <div class="lease-option-wrapper">
          <label class="form-label">Lease Option</label>
          <div class="lease-option-row">
            <input type="text" class="tenant-option" placeholder="e.g. 2x5yr option" value="${this.escapeHtml(t.option)}" ${t.noOption ? 'disabled' : ''}>
            <button class="btn-no-option ${t.noOption ? 'active' : ''}" onclick="App.toggleNoOption(this)" title="No option">${t.noOption ? '✓ No Option' : 'No Option'}</button>
          </div>
        </div>
      `;
      listEl.appendChild(entry);
      entry.querySelectorAll('.currency-input').forEach(input => UIHelpers.setupCurrencyInput(input));
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  /** Bind auto-save to all inputs (debounced) */
  bindAutoSave() {
    const handler = () => {
      clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = setTimeout(() => this.saveData(true), Config.AUTOSAVE_DELAY);
    };

    document.querySelector('.app-container').addEventListener('input', handler);
    document.querySelector('.app-container').addEventListener('change', handler);
  },

  /** Bind live validation on input changes */
  bindLiveValidation() {
    const validateHandler = () => {
      if (this.mode === 'single') {
        Validator.validateSingleInputs();
        this.updateCalculatedNetIncome();
        this.checkTenantIncomeConsistency();
      } else {
        Validator.validatePortfolioInputs();
      }
    };

    document.querySelector('.app-container').addEventListener('input', validateHandler);
    document.querySelector('.app-container').addEventListener('change', validateHandler);
  },

  // ══════════════════════════════════════════
  // PROPERTY TYPE DESCRIPTION
  // ══════════════════════════════════════════

  onPropertyTypeChange(context) {
    if (context === 'single') {
      const select = document.getElementById('propertyType');
      const descWrapper = document.getElementById('propertyTypeDescWrapper');
      const hint = document.getElementById('specialisedHint');
      const value = select.value;
      const needsDesc = Config.typesRequiringDescription.includes(value);
      descWrapper.classList.toggle('hidden', !needsDesc);
      hint.classList.toggle('hidden', value !== 'specialised');
    } else {
      const propCard = document.getElementById(`portfolioProp_${context}`);
      if (!propCard) return;
      const select = propCard.querySelector('.pp-type');
      const descWrapper = propCard.querySelector('.pp-type-desc-wrapper');
      if (select && descWrapper) {
        const needsDesc = Config.typesRequiringDescription.includes(select.value);
        descWrapper.classList.toggle('hidden', !needsDesc);
      }
    }
  },

  bindCurrencyInputs() {
    document.querySelectorAll('#singlePropertyInputs .currency-input').forEach(
      input => UIHelpers.setupCurrencyInput(input)
    );
    document.querySelectorAll('#portfolioInputs > .card .currency-input').forEach(
      input => UIHelpers.setupCurrencyInput(input)
    );
  },

  bindPropertyTypeHint() {},

  bindEnterKey() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        if (this.mode === 'single') this.calculate();
        else this.calculatePortfolio();
      }
    });
  },

  // ══════════════════════════════════════════
  // MODE TOGGLE
  // ══════════════════════════════════════════
  setMode(mode) {
    this.mode = mode;
    document.getElementById('modeSingle').classList.toggle('active', mode === 'single');
    document.getElementById('modePortfolio').classList.toggle('active', mode === 'portfolio');
    document.getElementById('singlePropertyInputs').classList.toggle('hidden', mode !== 'single');
    document.getElementById('portfolioInputs').classList.toggle('hidden', mode !== 'portfolio');
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');

    if (mode === 'single') {
      Validator.validateSingleInputs();
    } else {
      Validator.validatePortfolioInputs();
    }
  },

  // ══════════════════════════════════════════
  // REPAYMENT TYPE
  // ══════════════════════════════════════════
  setRepaymentType(type, isPortfolio = false) {
    if (isPortfolio) {
      this.portfolioRepaymentType = type;
      document.getElementById('pRepayTypeIO').classList.toggle('active', type === 'io');
      document.getElementById('pRepayTypePI').classList.toggle('active', type === 'pi');
      this.enforceLoanTermLimit('pLoanTerm', 'pLoanTermHint', type);
    } else {
      this.repaymentType = type;
      document.getElementById('repayTypeIO').classList.toggle('active', type === 'io');
      document.getElementById('repayTypePI').classList.toggle('active', type === 'pi');
      this.enforceLoanTermLimit('loanTerm', 'loanTermHint', type);
    }
  },

  /** Enforce max loan term and show warning */
  enforceLoanTermLimit(inputId, hintId, repayType) {
    const input = document.getElementById(inputId);
    const hint = document.getElementById(hintId);
    const maxTerm = repayType === 'io' ? Config.default.loanTermMax.io : Config.default.loanTermMax.pi;
    const current = parseInt(input.value) || 0;

    if (current > maxTerm) {
      input.value = maxTerm;
      Validator.showHint(hint, 'warning', `⚠ Adjusted to ${maxTerm} years (max for ${repayType === 'io' ? 'IO' : 'P&I'})`);
      input.classList.add('input-warning');
      setTimeout(() => {
        Validator.hideHint(hint);
        input.classList.remove('input-warning');
      }, 3000);
    }
  },

  // ══════════════════════════════════════════
  // INCOME INPUT METHOD
  // ══════════════════════════════════════════

  setIncomeMethod(method) {
    this.incomeMethod = method;
    document.getElementById('incomeMethodNet').classList.toggle('active', method === 'net');
    document.getElementById('incomeMethodGross').classList.toggle('active', method === 'gross');
    document.getElementById('incomeNetWrapper').classList.toggle('hidden', method !== 'net');
    document.getElementById('incomeGrossWrapper').classList.toggle('hidden', method !== 'gross');

    if (method === 'net') {
      const calcNet = document.getElementById('calculatedNetIncome');
      const netField = document.getElementById('rentalIncome');
      if (calcNet && calcNet.value && calcNet.value !== '—' && calcNet.value !== '') {
        netField.value = calcNet.value;
      }
    }

    this.updateCalculatedNetIncome();
    this.checkTenantIncomeConsistency();
  },

  /** Get the effective net income regardless of input method */
  getEffectiveNetIncome() {
    if (this.incomeMethod === 'gross') {
      const passingRent = UIHelpers.parseNumber(document.getElementById('passingRent')?.value);
      const outgoings = UIHelpers.parseNumber(document.getElementById('outgoings')?.value);
      return passingRent - outgoings;
    }
    return UIHelpers.parseNumber(document.getElementById('rentalIncome').value);
  },

  /** Auto-calculate net from Passing Rent - Outgoings */
  updateCalculatedNetIncome() {
    const passingRent = UIHelpers.parseNumber(document.getElementById('passingRent')?.value);
    const outgoings = UIHelpers.parseNumber(document.getElementById('outgoings')?.value);
    const netField = document.getElementById('calculatedNetIncome');
    const hint = document.getElementById('grossIncomeHint');
    if (!netField) return;

    if (passingRent > 0) {
      const net = passingRent - outgoings;
      netField.value = UIHelpers.formatNumber(net);
      if (net <= 0) {
        Validator.showHint(hint, 'danger', '⚠ Net income is negative or zero — outgoings exceed passing rent');
      } else {
        Validator.hideHint(hint);
      }
    } else {
      netField.value = '';
      Validator.hideHint(hint);
    }
  },

  /** Check tenant income total vs entered net rental income */
  checkTenantIncomeConsistency() {
    const tenants = this.getTenants();
    const totalTenantRent = tenants.reduce((sum, t) => sum + (t.annualRent || 0), 0);
    const netIncome = this.getEffectiveNetIncome();
    const hint = document.getElementById('tenantIncomeConsistencyHint');

    if (!hint) return;

    if (totalTenantRent > 0 && netIncome > 0) {
      const diff = Math.abs(totalTenantRent - netIncome);
      const pctDiff = (diff / netIncome) * 100;

      if (diff > 1000 && pctDiff > 5) {
        Validator.showHint(hint, 'warning',
          `⚠ Total tenant income (${UIHelpers.formatCurrency(totalTenantRent)}) differs from entered Net Rental Income (${UIHelpers.formatCurrency(netIncome)}). Please verify.`);
      } else {
        Validator.hideHint(hint);
      }
    } else {
      Validator.hideHint(hint);
    }
  },

  // ══════════════════════════════════════════
  // LEASE OPTION TOGGLE
  // ══════════════════════════════════════════
  toggleNoOption(btn) {
    const isActive = btn.classList.toggle('active');
    const optionInput = btn.parentElement.querySelector('.tenant-option');
    if (isActive) {
      optionInput.value = '';
      optionInput.disabled = true;
      btn.textContent = '✓ No Option';
    } else {
      optionInput.disabled = false;
      btn.textContent = 'No Option';
    }
  },

  // ══════════════════════════════════════════
  // IMPORT MODAL
  // ══════════════════════════════════════════
  showImportModal() {
    document.getElementById('importModal').classList.add('show');
  },
  hideImportModal() {
    document.getElementById('importModal').classList.remove('show');
  },

  // ══════════════════════════════════════════
  // TENANT MANAGEMENT (Single Mode)
  // ══════════════════════════════════════════
  addTenant() {
    const id = this.tenantCounter++;
    const entry = document.createElement('div');
    entry.className = 'tenant-entry';
    entry.dataset.tenantId = id;
    entry.innerHTML = `
      <button class="tenant-remove-btn" onclick="App.removeTenant(${id})">×</button>
      <div class="tenant-row">
        <div class="form-group">
          <label class="form-label">Tenant Name</label>
          <input type="text" class="tenant-name" placeholder="Tenant ${id + 1}">
        </div>
        <div class="form-group">
          <label class="form-label">Lease Expiry</label>
          <input type="date" class="tenant-expiry">
          <div class="validation-hint tenant-expiry-hint"></div>
        </div>
      </div>
      <div class="form-group mt-12">
        <label class="form-label">Annual Rent ($)</label>
        <div class="input-wrapper">
          <span class="input-prefix">$</span>
          <input type="text" class="tenant-rent has-prefix currency-input" placeholder="30,000" inputmode="numeric">
        </div>
      </div>
      <div class="lease-option-wrapper">
        <label class="form-label">Lease Option</label>
        <div class="lease-option-row">
          <input type="text" class="tenant-option" placeholder="e.g. 2x5yr option, 3+3+3">
          <button class="btn-no-option" onclick="App.toggleNoOption(this)" title="No option">No Option</button>
        </div>
      </div>
    `;
    document.getElementById('tenantList').appendChild(entry);
    entry.querySelectorAll('.currency-input').forEach(
      input => UIHelpers.setupCurrencyInput(input)
    );
  },

  removeTenant(id) {
    const entry = document.querySelector(`.tenant-entry[data-tenant-id="${id}"]`);
    if (entry) entry.remove();
  },

  getTenants() {
    const entries = document.querySelectorAll('#tenantList .tenant-entry');
    return Array.from(entries).map(entry => {
      const noOptionBtn = entry.querySelector('.btn-no-option');
      const isNoOption = noOptionBtn && noOptionBtn.classList.contains('active');
      return {
        name: entry.querySelector('.tenant-name')?.value || '',
        expiryDate: entry.querySelector('.tenant-expiry')?.value || '',
        annualRent: UIHelpers.parseNumber(entry.querySelector('.tenant-rent')?.value),
        leaseOption: isNoOption ? 'No Option' : (entry.querySelector('.tenant-option')?.value || '')
      };
    }).filter(t => t.expiryDate || t.annualRent);
  },

  // ── Portfolio Property Management ──
  addPortfolioProperty() {
    const idx = this.portfolioPropCounter++;
    const container = document.getElementById('portfolioPropertiesContainer');
    
    const card = document.createElement('div');
    card.className = 'property-card';
    card.id = `portfolioProp_${idx}`;
    card.innerHTML = `
      <div class="card-header-actions">
        <div class="card-header-left">
          <span class="property-card-number">${idx + 1}</span>
          <div>
            <div class="card-title">Property ${idx + 1}</div>
            <div class="card-subtitle">Security & income details</div>
          </div>
        </div>
        ${idx > 0 ? `<button class="btn btn-danger-sm" onclick="App.removePortfolioProperty(${idx})">Remove</button>` : ''}
      </div>
      
      <div class="form-section">
        <div class="row">
          <div class="form-group">
            <label class="form-label">Property Value</label>
            <div class="input-wrapper">
              <span class="input-prefix">$</span>
              <input type="text" class="pp-value has-prefix currency-input" placeholder="800,000" inputmode="numeric">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Net Rental (p.a.)</label>
            <div class="input-wrapper">
              <span class="input-prefix">$</span>
              <input type="text" class="pp-income has-prefix currency-input" placeholder="60,000" inputmode="numeric">
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Property Type</label>
          <select class="pp-type" onchange="App.onPropertyTypeChange(${idx})">
            <option value="industrial">Industrial</option>
            <option value="office">Office</option>
            <option value="retail">Retail</option>
            <option value="mixed">Mixed Use</option>
            <option value="residentialComplex">Residential Complex/Building</option>
            <option value="otherNonSpecialised">Other Non-Specialised Commercial</option>
            <option value="specialised">Specialised Commercial</option>
          </select>
        </div>

        <div class="pp-type-desc-wrapper property-type-desc-wrapper hidden">
          <label class="form-label">Please describe the property type</label>
          <input type="text" class="pp-type-desc" placeholder="e.g. childcare centre, service station, pub, hotel">
        </div>
      </div>
      
      <!-- Tenants for this property -->
      <div class="form-section">
        <div class="section-label">Lease Details</div>
        <div class="pp-tenant-list" data-prop-idx="${idx}">
          <div class="tenant-entry" data-tenant-id="0">
            <div class="tenant-row">
              <div class="form-group">
                <label class="form-label">Tenant</label>
                <input type="text" class="tenant-name" placeholder="Tenant 1">
              </div>
              <div class="form-group">
                <label class="form-label">Lease Expiry</label>
                <input type="date" class="tenant-expiry">
                <div class="validation-hint tenant-expiry-hint"></div>
              </div>
            </div>
            <div class="form-group mt-12">
              <label class="form-label">Annual Rent ($)</label>
              <div class="input-wrapper">
                <span class="input-prefix">$</span>
                <input type="text" class="tenant-rent has-prefix currency-input" placeholder="60,000" inputmode="numeric">
              </div>
            </div>
            <div class="lease-option-wrapper">
              <label class="form-label">Lease Option</label>
              <div class="lease-option-row">
                <input type="text" class="tenant-option" placeholder="e.g. 2x5yr option">
                <button class="btn-no-option" onclick="App.toggleNoOption(this)" title="No option">No Option</button>
              </div>
            </div>
          </div>
        </div>
        <button class="btn-add-tenant mt-12" onclick="App.addPortfolioTenant(${idx})">
          + Add Tenant
        </button>
        <button class="btn-import" onclick="App.showImportModal()">
          📥 Import Tenancy Schedule
        </button>
      </div>
    `;
    container.appendChild(card);

    card.querySelectorAll('.currency-input').forEach(
      input => UIHelpers.setupCurrencyInput(input)
    );
  },

  removePortfolioProperty(idx) {
    const el = document.getElementById(`portfolioProp_${idx}`);
    if (el) el.remove();
    this.renumberPortfolioProperties();
  },

  renumberPortfolioProperties() {
    const cards = document.querySelectorAll('#portfolioPropertiesContainer .property-card');
    cards.forEach((card, i) => {
      const num = card.querySelector('.property-card-number');
      if (num) num.textContent = i + 1;
      const title = card.querySelector('.card-title');
      if (title) title.textContent = `Property ${i + 1}`;
    });
  },

  _ppTenantCounters: {},

  addPortfolioTenant(propIdx) {
    if (!this._ppTenantCounters[propIdx]) this._ppTenantCounters[propIdx] = 1;
    const tid = this._ppTenantCounters[propIdx]++;
    const list = document.querySelector(`.pp-tenant-list[data-prop-idx="${propIdx}"]`);
    if (!list) return;

    const entry = document.createElement('div');
    entry.className = 'tenant-entry';
    entry.dataset.tenantId = tid;
    entry.innerHTML = `
      <button class="tenant-remove-btn" onclick="this.closest('.tenant-entry').remove()">×</button>
      <div class="tenant-row">
        <div class="form-group">
          <label class="form-label">Tenant</label>
          <input type="text" class="tenant-name" placeholder="Tenant ${tid + 1}">
        </div>
        <div class="form-group">
          <label class="form-label">Lease Expiry</label>
          <input type="date" class="tenant-expiry">
          <div class="validation-hint tenant-expiry-hint"></div>
        </div>
      </div>
      <div class="form-group mt-12">
        <label class="form-label">Annual Rent ($)</label>
        <div class="input-wrapper">
          <span class="input-prefix">$</span>
          <input type="text" class="tenant-rent has-prefix currency-input" placeholder="30,000" inputmode="numeric">
        </div>
      </div>
      <div class="lease-option-wrapper">
        <label class="form-label">Lease Option</label>
        <div class="lease-option-row">
          <input type="text" class="tenant-option" placeholder="e.g. 2x5yr option">
          <button class="btn-no-option" onclick="App.toggleNoOption(this)" title="No option">No Option</button>
        </div>
      </div>
    `;
    list.appendChild(entry);
    entry.querySelectorAll('.currency-input').forEach(
      input => UIHelpers.setupCurrencyInput(input)
    );
  },

  getPortfolioProperties() {
    const cards = document.querySelectorAll('#portfolioPropertiesContainer .property-card');
    return Array.from(cards).map((card, idx) => {
      const tenantEntries = card.querySelectorAll('.tenant-entry');
      const tenants = Array.from(tenantEntries).map(te => {
        const noOptionBtn = te.querySelector('.btn-no-option');
        const isNoOption = noOptionBtn && noOptionBtn.classList.contains('active');
        return {
          name: te.querySelector('.tenant-name')?.value || '',
          expiryDate: te.querySelector('.tenant-expiry')?.value || '',
          annualRent: UIHelpers.parseNumber(te.querySelector('.tenant-rent')?.value),
          leaseOption: isNoOption ? 'No Option' : (te.querySelector('.tenant-option')?.value || '')
        };
      }).filter(t => t.expiryDate || t.annualRent);

      const typeValue = card.querySelector('.pp-type')?.value || 'industrial';
      const typeDesc = card.querySelector('.pp-type-desc')?.value || '';

      return {
        index: idx,
        value: UIHelpers.parseNumber(card.querySelector('.pp-value')?.value),
        income: UIHelpers.parseNumber(card.querySelector('.pp-income')?.value),
        type: typeValue,
        typeDescription: typeDesc,
        tenants
      };
    });
  },

  // ══════════════════════════════════════════
  // SINGLE PROPERTY CALCULATION
  // ══════════════════════════════════════════
  calculate() {
    Validator.validateSingleInputs();
    this.checkTenantIncomeConsistency();

    const loan = UIHelpers.parseNumber(document.getElementById('loanAmount').value);
    const rate = parseFloat(document.getElementById('interestRate').value) || 7.5;
    let term = parseInt(document.getElementById('loanTerm').value) || 5;
    const value = UIHelpers.parseNumber(document.getElementById('propertyValue').value);
    const type = document.getElementById('propertyType').value;
    const typeDescription = document.getElementById('propertyTypeDesc')?.value || '';
    const income = this.getEffectiveNetIncome();
    const isIO = this.repaymentType === 'io';

    const maxTerm = isIO ? Config.default.loanTermMax.io : Config.default.loanTermMax.pi;
    if (term > maxTerm) {
      term = maxTerm;
      document.getElementById('loanTerm').value = maxTerm;
    }

    if (!loan || !value) {
      alert('Please enter loan amount and property value');
      return;
    }

    // Calculate metrics
    const lvr = Calculator.calculateLVR(loan, value);
    const icr = Calculator.calculateICR(income, loan, rate);
    const dscr = isIO ? null : Calculator.calculateDSCR(income, loan, rate, term);
    const coc = Calculator.calculateCashOnCash(income, loan, value, rate);
    const grossYield = Calculator.calculateYield(income, value);
    const breakeven = Calculator.calculateBreakevenRate(income, loan);
    const ioPayment = Calculator.calculateIOPayment(loan, rate);
    const piPayment = Calculator.calculatePIPayment(loan, rate, term);
    const monthlyPayment = isIO ? ioPayment : piPayment;

    // WALE
    const tenants = this.getTenants();
    const waleResult = Calculator.calculateWALE(tenants);
    const hasWALE = tenants.length > 0 && waleResult.wale > 0;

    // Loan Term vs WALE
    let loanTermVsWALE = null;
    if (hasWALE) {
      loanTermVsWALE = Assessor.assessLoanTermVsWALE(term, waleResult.wale);
    }

    // Assess
    const assessments = {
      lvr: Assessor.assessLVR(lvr, type),
      icr: Assessor.assessICR(icr)
    };
    if (!isIO) {
      assessments.dscr = Assessor.assessDSCR(dscr);
    }
    if (hasWALE) {
      assessments.wale = Assessor.assessWALE(waleResult.wale);
    }
    if (loanTermVsWALE) {
      assessments.loanTermWale = loanTermVsWALE;
    }
    const overall = Assessor.getOverallStatus(assessments);

    const incomeMethod = this.incomeMethod;
    const passingRent = incomeMethod === 'gross' ? UIHelpers.parseNumber(document.getElementById('passingRent')?.value) : 0;
    const outgoingsVal = incomeMethod === 'gross' ? UIHelpers.parseNumber(document.getElementById('outgoings')?.value) : 0;

    this.lastResults = {
      mode: 'single',
      inputs: { loan, rate, term, value, type, typeDescription, income, repaymentType: this.repaymentType, incomeMethod, passingRent, outgoings: outgoingsVal },
      metrics: { lvr, icr, dscr, coc, grossYield, breakeven, ioPayment, piPayment, monthlyPayment },
      waleResult, hasWALE, loanTermVsWALE, assessments, overall
    };

    this.renderSingleResults();
  },

  renderSingleResults() {
    const { inputs, metrics, waleResult, hasWALE, loanTermVsWALE, assessments, overall } = this.lastResults;
    const isIO = inputs.repaymentType === 'io';
    const lvrCap = Config.default.lvr[inputs.type] || 70;
    const typeLabel = Config.propertyTypeLabels[inputs.type] || inputs.type;
    const fullTypeLabel = inputs.typeDescription
      ? `${typeLabel} (${inputs.typeDescription})`
      : typeLabel;

    let html = '';

    html += this.buildPrintInputSummary();

    html += `
      <div class="status-card ${overall.status}">
        <div class="status-icon">${overall.icon}</div>
        <div class="status-text">${overall.text}</div>
        <div class="status-description">${overall.description}</div>
      </div>
    `;

    if (loanTermVsWALE) {
      html += `
        <div class="loan-wale-check ${loanTermVsWALE.status}">
          <span class="check-icon">${loanTermVsWALE.status === 'pass' ? '✅' : '❌'}</span>
          <div>
            <div>${loanTermVsWALE.message}</div>
            <div class="check-detail">${loanTermVsWALE.detail}</div>
          </div>
        </div>
      `;
    }

    html += '<div class="metrics-grid">';

    html += UIHelpers.buildMetricCard('lvr', 'LVR', metrics.lvr,
      metrics.lvr.toFixed(1) + '%', assessments.lvr, metrics.lvr);

    html += UIHelpers.buildMetricCard('icr', 'ICR', metrics.icr,
      metrics.icr.toFixed(2) + 'x', assessments.icr, (metrics.icr / 2.5) * 100);

    if (isIO) {
      html += UIHelpers.buildNAMetricCard('dscr', 'DSCR', 'N/A for Interest Only — use ICR');
    } else {
      html += UIHelpers.buildMetricCard('dscr', 'DSCR', metrics.dscr,
        metrics.dscr.toFixed(2) + 'x', assessments.dscr, (metrics.dscr / 2) * 100);
    }

    if (hasWALE) {
      html += UIHelpers.buildMetricCard('wale', 'WALE', waleResult.wale,
        waleResult.wale.toFixed(1) + ' yrs', assessments.wale,
        Math.min(100, (waleResult.wale / 10) * 100));
    }

    html += UIHelpers.buildMetricCard('coc', 'Cash on Cash', metrics.coc,
      metrics.coc.toFixed(1) + '%', null, Math.min(100, metrics.coc * 5));

    html += UIHelpers.buildMetricCard('yield', 'Gross Yield', metrics.grossYield,
      metrics.grossYield.toFixed(2) + '%', null, Math.min(100, metrics.grossYield * 10));

    html += UIHelpers.buildMetricCard('breakeven', 'Breakeven Rate', metrics.breakeven,
      metrics.breakeven.toFixed(2) + '%', null, Math.min(100, (metrics.breakeven / 15) * 100));

    html += '</div>';

    html += `
      <div class="repayment-card">
        <div class="repayment-title">💰 Monthly Repayment</div>
        <div class="repayment-grid">
          <div class="repayment-item ${isIO ? 'active-type' : ''}">
            <div class="repayment-type">Interest Only</div>
            <div class="repayment-amount">${UIHelpers.formatCurrency(metrics.ioPayment)}</div>
            <div class="repayment-period">per month</div>
          </div>
          <div class="repayment-item ${!isIO ? 'active-type' : ''}">
            <div class="repayment-type">Principal & Interest</div>
            <div class="repayment-amount">${UIHelpers.formatCurrency(metrics.piPayment)}</div>
            <div class="repayment-period">per month</div>
          </div>
        </div>
      </div>
    `;

    if (hasWALE) {
      html += this.renderWALESummary(waleResult, assessments.wale);
    }

    const notes = [
      {
        status: assessments.lvr.status,
        text: `LVR ${metrics.lvr.toFixed(1)}% — ${fullTypeLabel} capped at ${lvrCap}%`
      },
      {
        status: assessments.icr.status,
        text: `ICR ${metrics.icr.toFixed(2)}x — Most lenders require 1.50x, some accept 1.25x`
      }
    ];

    if (isIO) {
      notes.push({
        status: 'info',
        text: `DSCR not applicable for Interest Only — assessed on ICR only`
      });
    } else {
      notes.push({
        status: assessments.dscr.status,
        text: `DSCR ${metrics.dscr.toFixed(2)}x — Based on P&I repayments over ${inputs.term} years`
      });
    }

    if (hasWALE) {
      notes.push({
        status: assessments.wale.status,
        text: `WALE ${waleResult.wale.toFixed(1)} years — ${assessments.wale.message}`
      });
    }

    if (loanTermVsWALE) {
      notes.push({
        status: loanTermVsWALE.status,
        text: `Loan Term vs WALE — ${loanTermVsWALE.message} (${loanTermVsWALE.detail})`
      });
    }

    notes.push({
      status: metrics.breakeven > inputs.rate ? 'pass' : 'warn',
      text: `Breakeven rate ${metrics.breakeven.toFixed(2)}% — ${
        metrics.breakeven > inputs.rate ? 'Buffer above current rate' : 'Below current rate, limited headroom'
      }`
    });

    if (hasWALE) {
      waleResult.tenantDetails.forEach(t => {
        if (t.optionNote) {
          notes.push({
            status: 'info',
            text: `${t.name}: ${t.optionNote}`
          });
        }
      });
    }

    if (inputs.type === 'specialised') {
      notes.push({
        status: 'warn',
        text: `Specialised commercial property — LVR limited to 50%, limited lender appetite`
      });
    }

    html += `
      <div class="policy-card">
        <div class="policy-header">
          <span>💡</span>
          <span class="policy-title">Assessment Notes</span>
        </div>
        <ul class="policy-list">
          ${notes.map(n => `
            <li class="policy-item">
              <span class="policy-icon ${n.status}">${
                n.status === 'pass' ? '✓' : n.status === 'warn' ? '⚠' : n.status === 'info' ? 'ℹ' : '✗'
              }</span>
              <span>${n.text}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    html += `
      <div class="actions-row">
        <button class="btn btn-secondary" onclick="App.copyResults()">📋 Copy Results</button>
        <button class="btn btn-secondary" onclick="App.exportPDF()">📄 Export PDF</button>
        <button class="btn btn-secondary" onclick="App.reset()">🔄 Reset</button>
      </div>
    `;

    document.getElementById('resultsContainer').innerHTML = html;
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsContainer').classList.remove('hidden');
    document.getElementById('resultsContainer').classList.add('animate-in');
  },

  // ══════════════════════════════════════════
  // PORTFOLIO CALCULATION
  // ══════════════════════════════════════════
  calculatePortfolio() {
    Validator.validatePortfolioInputs();

    const loan = UIHelpers.parseNumber(document.getElementById('pLoanAmount').value);
    const rate = parseFloat(document.getElementById('pInterestRate').value) || 7.5;
    let term = parseInt(document.getElementById('pLoanTerm').value) || 5;
    const isIO = this.portfolioRepaymentType === 'io';

    const maxTerm = isIO ? Config.default.loanTermMax.io : Config.default.loanTermMax.pi;
    if (term > maxTerm) {
      term = maxTerm;
      document.getElementById('pLoanTerm').value = maxTerm;
    }

    if (!loan) {
      alert('Please enter total loan amount');
      return;
    }

    const properties = this.getPortfolioProperties();
    if (properties.length === 0) {
      alert('Please add at least one property');
      return;
    }

    let totalValue = 0;
    let totalIncome = 0;
    const propertyResults = [];
    let allTenants = [];

    properties.forEach((prop, idx) => {
      totalValue += prop.value;
      totalIncome += prop.income;

      const waleResult = Calculator.calculateWALE(prop.tenants);
      const hasWALE = prop.tenants.length > 0 && waleResult.wale > 0;

      allTenants = allTenants.concat(prop.tenants);

      propertyResults.push({
        ...prop,
        waleResult,
        hasWALE,
        typeLabel: Config.propertyTypeLabels[prop.type] || prop.type,
        fullTypeLabel: prop.typeDescription
          ? `${Config.propertyTypeLabels[prop.type] || prop.type} (${prop.typeDescription})`
          : (Config.propertyTypeLabels[prop.type] || prop.type),
        lvrCap: Config.default.lvr[prop.type] || 70
      });
    });

    const lvr = Calculator.calculateLVR(loan, totalValue);
    const icr = Calculator.calculateICR(totalIncome, loan, rate);
    const dscr = isIO ? null : Calculator.calculateDSCR(totalIncome, loan, rate, term);
    const coc = Calculator.calculateCashOnCash(totalIncome, loan, totalValue, rate);
    const grossYield = Calculator.calculateYield(totalIncome, totalValue);
    const breakeven = Calculator.calculateBreakevenRate(totalIncome, loan);
    const ioPayment = Calculator.calculateIOPayment(loan, rate);
    const piPayment = Calculator.calculatePIPayment(loan, rate, term);

    const combinedWALE = Calculator.calculateWALE(allTenants);
    const hasCombinedWALE = allTenants.length > 0 && combinedWALE.wale > 0;

    let loanTermVsWALE = null;
    if (hasCombinedWALE) {
      loanTermVsWALE = Assessor.assessLoanTermVsWALE(term, combinedWALE.wale);
    }

    const lowestCap = Math.min(...propertyResults.map(p => p.lvrCap));
    const portfolioAssessments = {
      lvr: Assessor.assessLVR(lvr, 'otherNonSpecialised'),
      icr: Assessor.assessICR(icr)
    };

    if (lvr <= lowestCap - 10) {
      portfolioAssessments.lvr = { status: 'pass', message: `Portfolio LVR within caps` };
    } else if (lvr <= lowestCap) {
      portfolioAssessments.lvr = { status: 'warn', message: `Portfolio LVR at limit (lowest cap ${lowestCap}%)` };
    } else {
      const highestCap = Math.max(...propertyResults.map(p => p.lvrCap));
      if (lvr > highestCap) {
        portfolioAssessments.lvr = { status: 'fail', message: `Exceeds all LVR caps` };
      } else {
        portfolioAssessments.lvr = { status: 'warn', message: `Exceeds some property type LVR caps` };
      }
    }

    if (!isIO && dscr !== null) {
      portfolioAssessments.dscr = Assessor.assessDSCR(dscr);
    }
    if (hasCombinedWALE) {
      portfolioAssessments.wale = Assessor.assessWALE(combinedWALE.wale);
    }
    if (loanTermVsWALE) {
      portfolioAssessments.loanTermWale = loanTermVsWALE;
    }

    const overall = Assessor.getOverallStatus(portfolioAssessments);

    propertyResults.forEach(prop => {
      prop.assessments = {};
      if (prop.value > 0) {
        prop.assessments.lvrNote = Assessor.assessLVR(lvr, prop.type);
      }
      if (prop.hasWALE) {
        prop.assessments.wale = Assessor.assessWALE(prop.waleResult.wale);
      }
    });

    this.lastResults = {
      mode: 'portfolio',
      inputs: { loan, rate, term, repaymentType: this.portfolioRepaymentType },
      metrics: { lvr, icr, dscr, coc, grossYield, breakeven, ioPayment, piPayment },
      totalValue, totalIncome,
      propertyResults,
      combinedWALE, hasCombinedWALE, loanTermVsWALE,
      portfolioAssessments, overall
    };

    this.renderPortfolioResults();
  },

  renderPortfolioResults() {
    const { inputs, metrics, totalValue, totalIncome, propertyResults, combinedWALE, hasCombinedWALE, loanTermVsWALE, portfolioAssessments, overall } = this.lastResults;
    const isIO = inputs.repaymentType === 'io';

    let html = '';

    html += this.buildPrintInputSummary();

    html += `
      <div class="status-card ${overall.status}">
        <div class="status-icon">${overall.icon}</div>
        <div class="status-text">${overall.text}</div>
        <div class="status-description">${overall.description} — ${propertyResults.length} properties in portfolio</div>
      </div>
    `;

    if (loanTermVsWALE) {
      html += `
        <div class="loan-wale-check ${loanTermVsWALE.status}">
          <span class="check-icon">${loanTermVsWALE.status === 'pass' ? '✅' : '❌'}</span>
          <div>
            <div>${loanTermVsWALE.message}</div>
            <div class="check-detail">${loanTermVsWALE.detail}</div>
          </div>
        </div>
      `;
    }

    html += '<div class="metrics-grid">';

    html += UIHelpers.buildMetricCard('pLvr', 'Portfolio LVR', metrics.lvr,
      metrics.lvr.toFixed(1) + '%', portfolioAssessments.lvr, metrics.lvr);

    html += UIHelpers.buildMetricCard('pIcr', 'Portfolio ICR', metrics.icr,
      metrics.icr.toFixed(2) + 'x', portfolioAssessments.icr, (metrics.icr / 2.5) * 100);

    if (isIO) {
      html += UIHelpers.buildNAMetricCard('pDscr', 'Portfolio DSCR', 'N/A for Interest Only');
    } else {
      html += UIHelpers.buildMetricCard('pDscr', 'Portfolio DSCR', metrics.dscr,
        metrics.dscr.toFixed(2) + 'x', portfolioAssessments.dscr, (metrics.dscr / 2) * 100);
    }

    if (hasCombinedWALE) {
      html += UIHelpers.buildMetricCard('pWale', 'Combined WALE', combinedWALE.wale,
        combinedWALE.wale.toFixed(1) + ' yrs', portfolioAssessments.wale,
        Math.min(100, (combinedWALE.wale / 10) * 100));
    }

    html += UIHelpers.buildMetricCard('pYield', 'Portfolio Yield', metrics.grossYield,
      metrics.grossYield.toFixed(2) + '%', null, Math.min(100, metrics.grossYield * 10));

    html += UIHelpers.buildMetricCard('pBreakeven', 'Breakeven Rate', metrics.breakeven,
      metrics.breakeven.toFixed(2) + '%', null, Math.min(100, (metrics.breakeven / 15) * 100));

    html += '</div>';

    html += `
      <div class="repayment-card">
        <div class="repayment-title">💰 Portfolio Monthly Repayment</div>
        <div class="repayment-grid">
          <div class="repayment-item ${isIO ? 'active-type' : ''}">
            <div class="repayment-type">Interest Only</div>
            <div class="repayment-amount">${UIHelpers.formatCurrency(metrics.ioPayment)}</div>
            <div class="repayment-period">per month</div>
          </div>
          <div class="repayment-item ${!isIO ? 'active-type' : ''}">
            <div class="repayment-type">Principal & Interest</div>
            <div class="repayment-amount">${UIHelpers.formatCurrency(metrics.piPayment)}</div>
            <div class="repayment-period">per month</div>
          </div>
        </div>
      </div>
    `;

    if (hasCombinedWALE) {
      html += this.renderWALESummary(combinedWALE, portfolioAssessments.wale, 'Portfolio WALE Analysis');
    }

    if (hasCombinedWALE && propertyResults.length > 1) {
      html += this.renderWALEContributionChart(propertyResults, combinedWALE);
    }

    html += `<div class="section-label" style="margin-top: 8px;">Individual Property Assessment</div>`;

    propertyResults.forEach((prop, idx) => {
      const propOverall = Assessor.getOverallStatus({
        ...(prop.assessments.lvrNote ? { lvr: prop.assessments.lvrNote } : {}),
        ...(prop.assessments.wale ? { wale: prop.assessments.wale } : {})
      });

      html += `
        <div class="portfolio-property-result" style="margin-top: 12px;">
          <div class="portfolio-property-header">
            <span class="property-card-number">${idx + 1}</span>
            <span class="portfolio-property-name">${prop.fullTypeLabel}</span>
            <span class="portfolio-property-tag ${propOverall.status}">${propOverall.icon} ${propOverall.text}</span>
          </div>
          <div class="portfolio-metrics-row">
            <div class="portfolio-metric-item">
              <div class="portfolio-metric-label">Value</div>
              <div class="portfolio-metric-val neutral">${UIHelpers.formatCurrency(prop.value)}</div>
            </div>
            <div class="portfolio-metric-item">
              <div class="portfolio-metric-label">Rental p.a.</div>
              <div class="portfolio-metric-val neutral">${UIHelpers.formatCurrency(prop.income)}</div>
            </div>
            <div class="portfolio-metric-item">
              <div class="portfolio-metric-label">LVR Cap</div>
              <div class="portfolio-metric-val ${prop.assessments.lvrNote ? prop.assessments.lvrNote.status : 'neutral'}">${prop.lvrCap}%</div>
            </div>
            <div class="portfolio-metric-item">
              <div class="portfolio-metric-label">Yield</div>
              <div class="portfolio-metric-val neutral">${prop.value > 0 ? ((prop.income / prop.value) * 100).toFixed(1) : '0.0'}%</div>
            </div>
            ${prop.hasWALE ? `
              <div class="portfolio-metric-item">
                <div class="portfolio-metric-label">WALE</div>
                <div class="portfolio-metric-val ${prop.assessments.wale ? prop.assessments.wale.status : 'neutral'}">${prop.waleResult.wale.toFixed(1)} yrs</div>
              </div>
            ` : ''}
          </div>
          ${prop.hasWALE && prop.waleResult.tenantDetails.length > 0 ? `
            <div class="wale-tenant-list" style="margin-top: 12px;">
              ${prop.waleResult.tenantDetails.map(t => {
                const hasOptionBoost = t.effectiveYears && t.effectiveYears > t.yearsRemaining;
                return `
                <div class="wale-tenant-row" style="flex-wrap:wrap;">
                  <span class="wale-tenant-name">${t.name}${t.leaseOption ? ` <span style="font-size:10px;color:var(--text-muted)">(${t.leaseOption})</span>` : ''}</span>
                  <span>
                    <span class="wale-tenant-expiry ${t.isExpired ? 'fail' : t.isExpiringSoon ? 'warn' : 'pass'}" style="color: var(--${t.isExpired ? 'danger' : t.isExpiringSoon ? 'warning' : 'success'})">
                      ${t.isExpired ? '⛔ EXPIRED' : t.yearsRemaining.toFixed(1) + ' yrs'}
                      ${t.isExpiringSoon ? ' ⚠️' : ''}
                    </span>
                    ${hasOptionBoost ? `<span style="font-size:10px;color:var(--info);margin-left:4px;">📎 ${t.effectiveYears.toFixed(1)} yrs w/ option</span>` : ''}
                  </span>
                  ${t.optionNote ? `<div style="width:100%;font-size:10px;color:var(--info);margin-top:2px;">ℹ️ ${t.optionNote}</div>` : ''}
                </div>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `
      <div class="policy-card" style="margin-top: 12px;">
        <div class="policy-header">
          <span>📊</span>
          <span class="policy-title">Portfolio Summary</span>
        </div>
        <ul class="policy-list">
          <li class="policy-item">
            <span class="policy-icon pass">🏢</span>
            <span>${propertyResults.length} properties — Total value ${UIHelpers.formatCurrency(totalValue)}, Total income ${UIHelpers.formatCurrency(totalIncome)} p.a.</span>
          </li>
          <li class="policy-item">
            <span class="policy-icon ${portfolioAssessments.lvr.status}">${portfolioAssessments.lvr.status === 'pass' ? '✓' : portfolioAssessments.lvr.status === 'warn' ? '⚠' : '✗'}</span>
            <span>Portfolio LVR ${metrics.lvr.toFixed(1)}% against ${UIHelpers.formatCurrency(inputs.loan)} loan</span>
          </li>
          ${loanTermVsWALE ? `
            <li class="policy-item">
              <span class="policy-icon ${loanTermVsWALE.status}">${loanTermVsWALE.status === 'pass' ? '✓' : '✗'}</span>
              <span>Loan Term vs WALE — ${loanTermVsWALE.message}</span>
            </li>
          ` : ''}
          ${propertyResults.some(p => p.type === 'specialised') ? `
            <li class="policy-item">
              <span class="policy-icon warn">⚠</span>
              <span>Portfolio includes specialised commercial property — LVR capped at 50% for those assets</span>
            </li>
          ` : ''}
          ${hasCombinedWALE ? combinedWALE.tenantDetails.filter(t => t.optionNote).map(t => `
            <li class="policy-item">
              <span class="policy-icon info">ℹ</span>
              <span>${t.name}: ${t.optionNote}</span>
            </li>
          `).join('') : ''}
        </ul>
      </div>
    `;

    html += `
      <div class="actions-row">
        <button class="btn btn-secondary" onclick="App.copyResults()">📋 Copy Results</button>
        <button class="btn btn-secondary" onclick="App.exportPDF()">📄 Export PDF</button>
        <button class="btn btn-secondary" onclick="App.reset()">🔄 Reset</button>
      </div>
    `;

    document.getElementById('resultsContainer').innerHTML = html;
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsContainer').classList.remove('hidden');
    document.getElementById('resultsContainer').classList.add('animate-in');
  },

  // ══════════════════════════════════════════
  // WALE CONTRIBUTION CHART (Portfolio)
  // ══════════════════════════════════════════

  renderWALEContributionChart(propertyResults, combinedWALE) {
    const totalRent = combinedWALE.totalRent;
    if (totalRent <= 0) return '';

    let rows = '';
    propertyResults.forEach((prop, idx) => {
      if (!prop.hasWALE || !prop.waleResult.totalRent) return;

      const propRent = prop.waleResult.totalRent;
      const incomeShare = (propRent / totalRent) * 100;
      const waleYrs = prop.waleResult.wale;
      const waleContrib = (propRent / totalRent) * waleYrs;

      let barClass = 'wale-bar-long';
      if (waleYrs < 3) barClass = 'wale-bar-short';
      else if (waleYrs < 5) barClass = 'wale-bar-medium';

      const maxWale = Math.max(...propertyResults.filter(p => p.hasWALE).map(p => p.waleResult.wale), 1);
      const barWidth = Math.max(10, (waleYrs / maxWale) * 100);

      rows += `
        <tr>
          <td style="font-weight:600;">Property ${idx + 1}</td>
          <td>${UIHelpers.formatCurrency(propRent)}</td>
          <td>${incomeShare.toFixed(1)}%</td>
          <td class="wale-contrib-bar-cell">
            <div class="wale-contrib-bar-bg">
              <div class="wale-contrib-bar-fill ${barClass}" style="width: ${barWidth}%">
                ${waleYrs.toFixed(1)}
              </div>
            </div>
          </td>
          <td style="font-weight:600;">${waleContrib.toFixed(2)}</td>
        </tr>
      `;
    });

    return `
      <div class="wale-contrib-chart">
        <div class="wale-contrib-header">
          <span>📊</span>
          <span class="wale-contrib-title">WALE Contribution Analysis</span>
        </div>
        <table class="wale-contrib-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Rental p.a.</th>
              <th>Income %</th>
              <th>Lease Remaining</th>
              <th>WALE Contribution</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div class="wale-contrib-footer">
          <span style="color:var(--text-secondary)">Total Rental: ${UIHelpers.formatCurrency(totalRent)} p.a.</span>
          <span style="color:var(--primary)">Combined WALE: ${combinedWALE.wale.toFixed(2)} yrs</span>
        </div>
        <div class="wale-contrib-legend">
          <span class="wale-contrib-legend-item"><span class="wale-legend-dot" style="background:#EF4444"></span> Short (&lt;3 yrs)</span>
          <span class="wale-contrib-legend-item"><span class="wale-legend-dot" style="background:#F59E0B"></span> Medium (3-5 yrs)</span>
          <span class="wale-contrib-legend-item"><span class="wale-legend-dot" style="background:#2ECC85"></span> Long (&gt;5 yrs)</span>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════
  // SHARED RENDER HELPERS
  // ══════════════════════════════════════════

  renderWALESummary(waleResult, assessment, title = 'WALE Analysis') {
    let html = `
      <div class="wale-summary">
        <div class="wale-header">
          <span>📅</span>
          <span class="wale-header-title">${title}</span>
        </div>
        <div class="wale-value-row">
          <span class="wale-metric-label">Weighted Average Lease Expiry</span>
          <span class="wale-metric-value ${assessment.status}">${waleResult.wale.toFixed(2)} years</span>
        </div>
        <div class="wale-value-row">
          <span class="wale-metric-label">Risk Level</span>
          <span class="wale-metric-value ${assessment.status}">
            ${assessment.status === 'pass' ? '✅ Low Risk' : assessment.status === 'warn' ? '⚠️ Medium Risk' : '❌ High Risk'}
          </span>
        </div>
    `;

    if (waleResult.tenantDetails.length > 0) {
      html += `<div class="wale-tenant-list">`;
      waleResult.tenantDetails.forEach(t => {
        const statusClass = t.isExpired ? 'danger' : t.isExpiringSoon ? 'warning' : 'pass';
        const hasOptionBoost = t.effectiveYears && t.effectiveYears > t.yearsRemaining;
        html += `
          <div class="wale-tenant-row" style="flex-wrap:wrap;">
            <span class="wale-tenant-name">${t.name}${t.leaseOption ? ` <span style="font-size:10px;color:var(--text-muted)">(${t.leaseOption})</span>` : ''}</span>
            <span>
              <span class="lease-expiry-tag ${statusClass}">
                ${t.isExpired ? '⛔ EXPIRED' :
                  t.isExpiringSoon ? `⚠️ ${t.yearsRemaining.toFixed(1)} yrs (expiring soon)` :
                  `✅ ${t.yearsRemaining.toFixed(1)} yrs`}
              </span>
              ${hasOptionBoost ? `<span class="lease-expiry-tag" style="background:var(--info-bg);color:var(--info);margin-left:4px;">📎 ${t.effectiveYears.toFixed(1)} yrs w/ option</span>` : ''}
            </span>
            ${t.optionNote ? `<div style="width:100%;font-size:10px;color:var(--info);margin-top:2px;padding-left:4px;">ℹ️ ${t.optionNote}</div>` : ''}
          </div>
        `;
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  // ══════════════════════════════════════════
  // PRINT INPUT SUMMARY
  // ══════════════════════════════════════════

  buildPrintInputSummary() {
    if (!this.lastResults) return '';
    const r = this.lastResults;

    if (r.mode === 'single') {
      const { inputs } = r;
      const typeLabel = Config.propertyTypeLabels[inputs.type] || inputs.type;
      const fullType = inputs.typeDescription ? `${typeLabel} (${inputs.typeDescription})` : typeLabel;
      return `
        <div class="print-input-summary">
          <h3>📋 Deal Summary</h3>
          <div class="print-input-grid">
            <div class="print-input-item"><strong>Loan Amount:</strong> ${UIHelpers.formatCurrency(inputs.loan)}</div>
            <div class="print-input-item"><strong>Property Value:</strong> ${UIHelpers.formatCurrency(inputs.value)}</div>
            <div class="print-input-item"><strong>Interest Rate:</strong> ${inputs.rate}%</div>
            <div class="print-input-item"><strong>Loan Term:</strong> ${inputs.term} years</div>
            <div class="print-input-item"><strong>Repayment:</strong> ${inputs.repaymentType === 'io' ? 'Interest Only' : 'P&I'}</div>
            <div class="print-input-item"><strong>Property Type:</strong> ${fullType}</div>
            <div class="print-input-item"><strong>Net Rental:</strong> ${UIHelpers.formatCurrency(inputs.income)} p.a.</div>
            ${inputs.incomeMethod === 'gross' ? `
            <div class="print-input-item"><strong>Passing Rent:</strong> ${UIHelpers.formatCurrency(inputs.passingRent || 0)} p.a.</div>
            <div class="print-input-item"><strong>Outgoings:</strong> ${UIHelpers.formatCurrency(inputs.outgoings || 0)} p.a.</div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      const { inputs, totalValue, totalIncome, propertyResults } = r;
      return `
        <div class="print-input-summary">
          <h3>📋 Portfolio Summary</h3>
          <div class="print-input-grid">
            <div class="print-input-item"><strong>Total Loan:</strong> ${UIHelpers.formatCurrency(inputs.loan)}</div>
            <div class="print-input-item"><strong>Total Value:</strong> ${UIHelpers.formatCurrency(totalValue)}</div>
            <div class="print-input-item"><strong>Total Rental:</strong> ${UIHelpers.formatCurrency(totalIncome)} p.a.</div>
            <div class="print-input-item"><strong>Properties:</strong> ${propertyResults.length}</div>
            <div class="print-input-item"><strong>Interest Rate:</strong> ${inputs.rate}%</div>
            <div class="print-input-item"><strong>Loan Term:</strong> ${inputs.term} years</div>
            <div class="print-input-item"><strong>Repayment:</strong> ${inputs.repaymentType === 'io' ? 'Interest Only' : 'P&I'}</div>
          </div>
        </div>
      `;
    }
  },

  // ══════════════════════════════════════════
  // PDF EXPORT
  // ══════════════════════════════════════════

  exportPDF() {
    if (!this.lastResults) {
      this.showToast('⚠️ Calculate first, then export');
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-AU', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('printDate').textContent = `Generated: ${dateStr}`;

    window.print();
  },

  // ══════════════════════════════════════════
  // COPY / RESET
  // ══════════════════════════════════════════

  copyResults() {
    if (!this.lastResults) return;

    let text = '';
    if (this.lastResults.mode === 'single') {
      text = this.buildSingleCopyText();
    } else {
      text = this.buildPortfolioCopyText();
    }

    navigator.clipboard.writeText(text).then(() => {
      this.showToast('✅ Copied to clipboard!');
    });
  },

  buildSingleCopyText() {
    const { inputs, metrics, waleResult, hasWALE, loanTermVsWALE, overall } = this.lastResults;
    const typeLabel = Config.propertyTypeLabels[inputs.type] || inputs.type;
    const fullTypeLabel = inputs.typeDescription
      ? `${typeLabel} (${inputs.typeDescription})`
      : typeLabel;
    const isIO = inputs.repaymentType === 'io';

    let text = `COMMERCIAL SERVICING ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 DEAL SUMMARY
Loan Amount: ${UIHelpers.formatCurrency(inputs.loan)}
Property Value: ${UIHelpers.formatCurrency(inputs.value)}
Property Type: ${fullTypeLabel}
Interest Rate: ${inputs.rate}%
Loan Term: ${inputs.term} years
Repayment Type: ${isIO ? 'Interest Only' : 'Principal & Interest'}
Net Rental Income: ${UIHelpers.formatCurrency(inputs.income)} p.a.${inputs.incomeMethod === 'gross' ? `
  (Passing Rent: ${UIHelpers.formatCurrency(inputs.passingRent)} — Outgoings: ${UIHelpers.formatCurrency(inputs.outgoings)})` : ''}

📊 KEY METRICS
LVR: ${metrics.lvr.toFixed(1)}%
ICR: ${metrics.icr.toFixed(2)}x
DSCR: ${isIO ? 'N/A (IO)' : metrics.dscr.toFixed(2) + 'x'}
Cash on Cash: ${metrics.coc.toFixed(1)}%
Gross Yield: ${metrics.grossYield.toFixed(2)}%
Breakeven Rate: ${metrics.breakeven.toFixed(2)}%`;

    if (hasWALE) {
      text += `\n\n📅 WALE: ${waleResult.wale.toFixed(2)} years`;
      waleResult.tenantDetails.forEach(t => {
        let line = `\n  • ${t.name}: ${t.isExpired ? 'EXPIRED' : t.yearsRemaining.toFixed(1) + ' years remaining'}${t.isExpiringSoon ? ' ⚠️' : ''}`;
        if (t.leaseOption) line += ` | Option: ${t.leaseOption}`;
        if (t.effectiveYears && t.effectiveYears > t.yearsRemaining) {
          line += ` | Effective: ${t.effectiveYears.toFixed(1)} yrs (w/ option)`;
        }
        if (t.optionNote) line += `\n    ℹ️ ${t.optionNote}`;
        text += line;
      });
    }

    if (loanTermVsWALE) {
      text += `\n\n🔍 LOAN TERM vs WALE`;
      text += `\n${loanTermVsWALE.status === 'pass' ? '✅' : '❌'} ${loanTermVsWALE.message}`;
      text += `\n${loanTermVsWALE.detail}`;
    }

    text += `\n
💰 REPAYMENTS
Interest Only: ${UIHelpers.formatCurrency(metrics.ioPayment)}/month
P&I: ${UIHelpers.formatCurrency(metrics.piPayment)}/month

${overall.icon} OVERALL: ${overall.text}
${overall.description}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by Oney & Co — Oney Serve V4.1
oneyco.com.au`;
    return text;
  },

  buildPortfolioCopyText() {
    const { inputs, metrics, totalValue, totalIncome, propertyResults, combinedWALE, hasCombinedWALE, loanTermVsWALE, overall } = this.lastResults;
    const isIO = inputs.repaymentType === 'io';

    let text = `PORTFOLIO SERVICING ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PORTFOLIO SUMMARY
Total Loan: ${UIHelpers.formatCurrency(inputs.loan)}
Total Property Value: ${UIHelpers.formatCurrency(totalValue)}
Total Rental Income: ${UIHelpers.formatCurrency(totalIncome)} p.a.
Properties: ${propertyResults.length}
Interest Rate: ${inputs.rate}%
Loan Term: ${inputs.term} years
Repayment Type: ${isIO ? 'Interest Only' : 'Principal & Interest'}

📊 PORTFOLIO METRICS
LVR: ${metrics.lvr.toFixed(1)}%
ICR: ${metrics.icr.toFixed(2)}x
DSCR: ${isIO ? 'N/A (IO)' : metrics.dscr.toFixed(2) + 'x'}
Gross Yield: ${metrics.grossYield.toFixed(2)}%
Breakeven Rate: ${metrics.breakeven.toFixed(2)}%`;

    if (hasCombinedWALE) {
      text += `\nCombined WALE: ${combinedWALE.wale.toFixed(2)} years`;
    }

    if (loanTermVsWALE) {
      text += `\n\n🔍 LOAN TERM vs WALE`;
      text += `\n${loanTermVsWALE.status === 'pass' ? '✅' : '❌'} ${loanTermVsWALE.message}`;
      text += `\n${loanTermVsWALE.detail}`;
    }

    text += '\n\n🏢 INDIVIDUAL PROPERTIES';
    propertyResults.forEach((p, i) => {
      text += `\n\n  Property ${i + 1}: ${p.fullTypeLabel}`;
      text += `\n  Value: ${UIHelpers.formatCurrency(p.value)} | Rental: ${UIHelpers.formatCurrency(p.income)} p.a.`;
      text += `\n  LVR Cap: ${p.lvrCap}% | Yield: ${p.value > 0 ? ((p.income / p.value) * 100).toFixed(1) : '0.0'}%`;
      if (p.hasWALE) {
        text += `\n  WALE: ${p.waleResult.wale.toFixed(1)} years`;
        p.waleResult.tenantDetails.forEach(t => {
          let line = `\n    • ${t.name}: ${t.isExpired ? 'EXPIRED' : t.yearsRemaining.toFixed(1) + 'yr'}`;
          if (t.leaseOption) line += ` | Option: ${t.leaseOption}`;
          if (t.effectiveYears && t.effectiveYears > t.yearsRemaining) {
            line += ` | Effective: ${t.effectiveYears.toFixed(1)} yrs (w/ option)`;
          }
          if (t.optionNote) line += `\n      ℹ️ ${t.optionNote}`;
          text += line;
        });
      }
    });

    text += `\n
💰 REPAYMENTS
IO: ${UIHelpers.formatCurrency(metrics.ioPayment)}/month
P&I: ${UIHelpers.formatCurrency(metrics.piPayment)}/month

${overall.icon} OVERALL: ${overall.text}
${overall.description}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by Oney & Co — Oney Serve V4.1
oneyco.com.au`;
    return text;
  },

  reset() {
    if (this.mode === 'single') {
      document.getElementById('loanAmount').value = '';
      document.getElementById('propertyValue').value = '';
      document.getElementById('rentalIncome').value = '';
      document.getElementById('interestRate').value = '7.50';
      document.getElementById('loanTerm').value = '5';
      document.getElementById('propertyType').selectedIndex = 0;
      if (document.getElementById('propertyTypeDesc')) {
        document.getElementById('propertyTypeDesc').value = '';
      }
      document.getElementById('propertyTypeDescWrapper').classList.add('hidden');
      document.getElementById('specialisedHint').classList.add('hidden');
      this.setRepaymentType('io');

      this.setIncomeMethod('net');
      if (document.getElementById('passingRent')) document.getElementById('passingRent').value = '';
      if (document.getElementById('outgoings')) document.getElementById('outgoings').value = '';
      if (document.getElementById('calculatedNetIncome')) document.getElementById('calculatedNetIncome').value = '';
      Validator.hideHint(document.getElementById('grossIncomeHint'));
      Validator.hideHint(document.getElementById('tenantIncomeConsistencyHint'));

      document.getElementById('tenantList').innerHTML = `
        <div class="tenant-entry" data-tenant-id="0">
          <div class="tenant-row">
            <div class="form-group">
              <label class="form-label">Tenant Name</label>
              <input type="text" class="tenant-name" placeholder="Tenant 1">
            </div>
            <div class="form-group">
              <label class="form-label">Lease Expiry</label>
              <input type="date" class="tenant-expiry">
              <div class="validation-hint tenant-expiry-hint"></div>
            </div>
          </div>
          <div class="form-group mt-12">
            <label class="form-label">Annual Rent ($)</label>
            <div class="input-wrapper">
              <span class="input-prefix">$</span>
              <input type="text" class="tenant-rent has-prefix currency-input" placeholder="60,000" inputmode="numeric">
            </div>
          </div>
          <div class="lease-option-wrapper">
            <label class="form-label">Lease Option</label>
            <div class="lease-option-row">
              <input type="text" class="tenant-option" placeholder="e.g. 2x5yr option, 3+3+3">
              <button class="btn-no-option" onclick="App.toggleNoOption(this)" title="No option">No Option</button>
            </div>
          </div>
        </div>
      `;
      document.querySelectorAll('#tenantList .currency-input').forEach(
        input => UIHelpers.setupCurrencyInput(input)
      );
      this.tenantCounter = 1;

      document.querySelectorAll('#singlePropertyInputs .validation-hint').forEach(h => {
        h.className = 'validation-hint';
        h.textContent = '';
      });
      document.querySelectorAll('#singlePropertyInputs .input-warning, #singlePropertyInputs .input-danger').forEach(el => {
        el.classList.remove('input-warning', 'input-danger');
      });
    } else {
      document.getElementById('pLoanAmount').value = '';
      document.getElementById('pInterestRate').value = '7.50';
      document.getElementById('pLoanTerm').value = '5';
      this.setRepaymentType('io', true);
      document.getElementById('portfolioPropertiesContainer').innerHTML = '';
      this.portfolioPropCounter = 0;
      this._ppTenantCounters = {};
      this.addPortfolioProperty();

      document.querySelectorAll('#portfolioInputs .validation-hint').forEach(h => {
        h.className = 'validation-hint';
        h.textContent = '';
      });
    }

    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('resultsContainer').innerHTML = '';
    document.getElementById('emptyState').classList.remove('hidden');
    this.lastResults = null;

    localStorage.removeItem(Config.STORAGE_KEY);
    this.showToast('🔄 Reset complete');
  },

  // ══════════════════════════════════════════
  // CLEAR ALL
  // ══════════════════════════════════════════
  clearAll() {
    if (!confirm('Clear all data? This cannot be undone.')) return;

    const originalMode = this.mode;

    this.mode = 'single';
    this.reset();

    this.mode = 'portfolio';
    this.reset();

    this.mode = 'single';
    document.getElementById('modeSingle').classList.add('active');
    document.getElementById('modePortfolio').classList.remove('active');
    document.getElementById('singlePropertyInputs').classList.remove('hidden');
    document.getElementById('portfolioInputs').classList.add('hidden');

    localStorage.removeItem(Config.STORAGE_KEY);

    this.showToast('🗑 All data cleared');
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
