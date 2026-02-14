/**
 * ============================================
 * Oney Serve V4.1 — Utility Modules
 * Configuration, UI Helpers, and Validation
 * ============================================
 */

// ============================================
// CONFIGURATION MODULE
// ============================================
const Config = {
  default: {
    name: 'Generic Commercial',
    lvr: {
      industrial: 65,
      office: 65,
      retail: 65,
      mixed: 60,
      residentialComplex: 70,
      otherNonSpecialised: 70,
      specialised: 50
    },
    icr: { minimum: 1.25, standard: 1.50, conservative: 2.00 },
    dscr: { minimum: 1.20, standard: 1.25 },
    wale: { low: 5, medium: 3 },
    leaseExpiryWarningMonths: 24,
    loanTermMax: { io: 5, pi: 30 }
  },

  propertyTypeLabels: {
    industrial: 'Industrial',
    office: 'Office',
    retail: 'Retail',
    mixed: 'Mixed Use',
    residentialComplex: 'Residential Complex/Building',
    otherNonSpecialised: 'Other Non-Specialised Commercial',
    specialised: 'Specialised Commercial'
  },

  typesRequiringDescription: ['otherNonSpecialised', 'specialised'],

  STORAGE_KEY: 'oney-serve-v4-data',
  AUTOSAVE_DELAY: 1000 // 1 second debounce
};

// ============================================
// UI HELPERS MODULE
// ============================================
const UIHelpers = {
  parseNumber(str) {
    return parseFloat((str || '').replace(/,/g, '')) || 0;
  },

  formatNumber(num) {
    return Math.round(num).toLocaleString();
  },

  formatCurrency(amount) {
    return '$' + this.formatNumber(amount);
  },

  setupCurrencyInput(input) {
    input.addEventListener('keyup', (e) => {
      let value = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
      if (value) e.target.value = parseInt(value).toLocaleString();
    });
  },

  buildMetricCard(id, name, value, format, assessment, barWidth) {
    const statusClass = assessment ? assessment.status : 'neutral';
    const statusIcon = assessment
      ? (assessment.status === 'pass' ? '✓' : assessment.status === 'warn' ? '!' : '✗')
      : '📊';
    const statusBadgeClass = assessment ? assessment.status : 'info';
    const threshold = assessment ? assessment.message : '';

    return `
      <div class="metric-card ${statusClass}" id="${id}Card">
        <div class="metric-header">
          <span class="metric-name">${name}</span>
          <span class="metric-status ${statusBadgeClass}">${statusIcon}</span>
        </div>
        <div class="metric-value">${format}</div>
        <div class="metric-threshold">${threshold}</div>
        <div class="metric-bar">
          <div class="metric-bar-fill" style="width: ${Math.min(100, barWidth || 0)}%"></div>
        </div>
      </div>
    `;
  },

  buildNAMetricCard(id, name, message) {
    return `
      <div class="metric-card na" id="${id}Card">
        <div class="metric-header">
          <span class="metric-name">${name}</span>
          <span class="metric-status na">—</span>
        </div>
        <div class="metric-value">N/A</div>
        <div class="metric-threshold">${message}</div>
        <div class="metric-bar">
          <div class="metric-bar-fill" style="width: 0%"></div>
        </div>
      </div>
    `;
  }
};

// ============================================
// INPUT VALIDATION MODULE
// ============================================
const Validator = {
  /**
   * Validate and show inline hints for input quality
   * Returns array of warning messages
   */
  validateSingleInputs() {
    const warnings = [];

    // Loan Amount
    const loanVal = UIHelpers.parseNumber(document.getElementById('loanAmount').value);
    const loanHint = document.getElementById('loanAmountHint');
    const loanInput = document.getElementById('loanAmount');
    if (loanVal < 0) {
      this.showHint(loanHint, 'danger', '⚠ Loan amount cannot be negative');
      loanInput.classList.add('input-danger');
      warnings.push('Negative loan amount');
    } else if (loanVal > 500000000) {
      this.showHint(loanHint, 'warning', '⚠ Loan amount exceeds $500M — please verify');
      loanInput.classList.add('input-warning');
      warnings.push('Unusually large loan amount');
    } else {
      this.hideHint(loanHint);
      loanInput.classList.remove('input-warning', 'input-danger');
    }

    // Interest Rate
    const rate = parseFloat(document.getElementById('interestRate').value);
    const rateHint = document.getElementById('interestRateHint');
    const rateInput = document.getElementById('interestRate');
    if (rate < 1) {
      this.showHint(rateHint, 'warning', '⚠ Rate below 1% — unusually low for commercial');
      rateInput.classList.add('input-warning');
    } else if (rate > 15) {
      this.showHint(rateHint, 'warning', '⚠ Rate above 15% — please verify');
      rateInput.classList.add('input-warning');
    } else {
      this.hideHint(rateHint);
      rateInput.classList.remove('input-warning', 'input-danger');
    }

    // Loan Term — enforce limits based on repayment type
    const term = parseInt(document.getElementById('loanTerm').value);
    const termHint = document.getElementById('loanTermHint');
    const termInput = document.getElementById('loanTerm');
    const isIO = App.repaymentType === 'io';
    const maxTerm = isIO ? Config.default.loanTermMax.io : Config.default.loanTermMax.pi;
    if (term > maxTerm) {
      this.showHint(termHint, 'danger', `⚠ Max ${maxTerm} years for ${isIO ? 'Interest Only' : 'P&I'}`);
      termInput.classList.add('input-danger');
      warnings.push(`Loan term exceeds ${maxTerm}yr limit`);
    } else if (term <= 0) {
      this.showHint(termHint, 'danger', '⚠ Loan term must be positive');
      termInput.classList.add('input-danger');
    } else {
      this.hideHint(termHint);
      termInput.classList.remove('input-warning', 'input-danger');
    }

    // Property Value
    const propVal = UIHelpers.parseNumber(document.getElementById('propertyValue').value);
    const propHint = document.getElementById('propertyValueHint');
    const propInput = document.getElementById('propertyValue');
    if (propVal < 0) {
      this.showHint(propHint, 'danger', '⚠ Property value cannot be negative');
      propInput.classList.add('input-danger');
    } else if (propVal > 500000000) {
      this.showHint(propHint, 'warning', '⚠ Property value exceeds $500M — please verify');
      propInput.classList.add('input-warning');
    } else {
      this.hideHint(propHint);
      propInput.classList.remove('input-warning', 'input-danger');
    }

    // Rental Income
    const rental = UIHelpers.parseNumber(document.getElementById('rentalIncome').value);
    const rentalHint = document.getElementById('rentalIncomeHint');
    const rentalInput = document.getElementById('rentalIncome');
    if (rental < 0) {
      this.showHint(rentalHint, 'danger', '⚠ Rental income cannot be negative');
      rentalInput.classList.add('input-danger');
    } else if (propVal > 0 && rental > propVal) {
      this.showHint(rentalHint, 'warning', '⚠ Rental income exceeds property value — unusual');
      rentalInput.classList.add('input-warning');
    } else {
      this.hideHint(rentalHint);
      rentalInput.classList.remove('input-warning', 'input-danger');
    }

    // LVR quick check
    if (loanVal > 0 && propVal > 0) {
      const quickLVR = (loanVal / propVal) * 100;
      if (quickLVR > 100) {
        this.showHint(propHint, 'danger', `⚠ LVR ${quickLVR.toFixed(0)}% — loan exceeds property value`);
        propInput.classList.add('input-danger');
      }
    }

    // Lease expiry date validation
    this.validateLeaseExpiries('#tenantList');

    return warnings;
  },

  validatePortfolioInputs() {
    const warnings = [];

    // Portfolio loan amount
    const loanVal = UIHelpers.parseNumber(document.getElementById('pLoanAmount').value);
    const loanHint = document.getElementById('pLoanAmountHint');
    const loanInput = document.getElementById('pLoanAmount');
    if (loanVal < 0) {
      this.showHint(loanHint, 'danger', '⚠ Loan amount cannot be negative');
      loanInput.classList.add('input-danger');
    } else {
      this.hideHint(loanHint);
      loanInput.classList.remove('input-warning', 'input-danger');
    }

    // Portfolio interest rate
    const rate = parseFloat(document.getElementById('pInterestRate').value);
    const rateHint = document.getElementById('pInterestRateHint');
    const rateInput = document.getElementById('pInterestRate');
    if (rate < 1 || rate > 15) {
      this.showHint(rateHint, 'warning', `⚠ Rate ${rate < 1 ? 'below 1%' : 'above 15%'} — please verify`);
      rateInput.classList.add('input-warning');
    } else {
      this.hideHint(rateHint);
      rateInput.classList.remove('input-warning', 'input-danger');
    }

    // Portfolio loan term
    const term = parseInt(document.getElementById('pLoanTerm').value);
    const termHint = document.getElementById('pLoanTermHint');
    const termInput = document.getElementById('pLoanTerm');
    const isIO = App.portfolioRepaymentType === 'io';
    const maxTerm = isIO ? Config.default.loanTermMax.io : Config.default.loanTermMax.pi;
    if (term > maxTerm) {
      this.showHint(termHint, 'danger', `⚠ Max ${maxTerm} years for ${isIO ? 'Interest Only' : 'P&I'}`);
      termInput.classList.add('input-danger');
    } else {
      this.hideHint(termHint);
      termInput.classList.remove('input-warning', 'input-danger');
    }

    // Validate each property's lease expiries
    document.querySelectorAll('#portfolioPropertiesContainer .pp-tenant-list').forEach(list => {
      this.validateLeaseExpiries(list);
    });

    return warnings;
  },

  /**
   * Check lease expiry dates — uses inline hints only (no alert popups).
   * Uses data-state attribute to avoid redundant DOM updates on every input event.
   */
  validateLeaseExpiries(container) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    el.querySelectorAll('.tenant-entry').forEach(entry => {
      const expiryInput = entry.querySelector('.tenant-expiry');
      let hint = entry.querySelector('.tenant-expiry-hint');
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'validation-hint tenant-expiry-hint';
        expiryInput.parentNode.appendChild(hint);
      }

      if (expiryInput.value) {
        const expiryDate = new Date(expiryInput.value);
        if (expiryDate < now) {
          // Only update DOM if state changed (avoid flicker on every keystroke)
          if (hint.dataset.warnState !== 'expired') {
            this.showHint(hint, 'danger', '⛔ Lease already expired');
            hint.dataset.warnState = 'expired';
            expiryInput.classList.add('input-danger');
            entry.classList.add('expiring-soon');
          }
        } else {
          if (hint.dataset.warnState) {
            delete hint.dataset.warnState;
            this.hideHint(hint);
            expiryInput.classList.remove('input-danger');
            entry.classList.remove('expiring-soon');
          }
        }
      } else {
        if (hint.dataset.warnState) {
          delete hint.dataset.warnState;
          this.hideHint(hint);
          expiryInput.classList.remove('input-danger');
          entry.classList.remove('expiring-soon');
        }
      }
    });
  },

  showHint(el, type, message) {
    if (!el) return;
    el.className = `validation-hint show ${type}`;
    el.textContent = message;
  },

  hideHint(el) {
    if (!el) return;
    el.className = 'validation-hint';
    el.textContent = '';
  }
};

// Export for use in other modules (when using ES modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Config, UIHelpers, Validator };
}
