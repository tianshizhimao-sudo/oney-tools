/**
 * ============================================
 * Oney Serve V4.1 — Calculation Engine
 * Pure calculation functions (no DOM dependencies)
 * ============================================
 */

// ============================================
// CALCULATION ENGINE MODULE
// ============================================
const Calculator = {
  calculateLVR(loan, value) {
    if (!value || value === 0) return 0;
    return (loan / value) * 100;
  },

  calculateICR(income, loan, rate) {
    const annualInterest = loan * (rate / 100);
    if (!annualInterest || annualInterest === 0) return 0;
    return income / annualInterest;
  },

  calculateDSCR(income, loan, rate, term) {
    const annualPI = this.calculatePIPayment(loan, rate, term) * 12;
    if (!annualPI || annualPI === 0) return 0;
    return income / annualPI;
  },

  calculateCashOnCash(income, loan, value, rate) {
    const equity = value - loan;
    if (!equity || equity <= 0) return 0;
    const annualInterest = loan * (rate / 100);
    const cashflow = income - annualInterest;
    return (cashflow / equity) * 100;
  },

  calculateYield(income, value) {
    if (!value || value === 0) return 0;
    return (income / value) * 100;
  },

  calculateBreakevenRate(income, loan) {
    if (!loan || loan === 0) return 0;
    return (income / loan) * 100;
  },

  calculateIOPayment(loan, rate) {
    return (loan * (rate / 100)) / 12;
  },

  calculatePIPayment(loan, rate, term) {
    const monthlyRate = (rate / 100) / 12;
    const payments = term * 12;
    if (monthlyRate === 0) return loan / payments;
    return loan * (monthlyRate * Math.pow(1 + monthlyRate, payments)) /
           (Math.pow(1 + monthlyRate, payments) - 1);
  },

  /**
   * Parse option text to extract total option years
   * Handles formats: "2x5yr", "3+3+3", "5yr option", "10", etc.
   */
  parseOptionYears(text) {
    if (!text || text === 'No Option') return 0;
    const cleaned = text.toLowerCase().replace(/\s+/g, '');

    // Pattern: NxNyr (e.g., 2x5yr, 3x3year)
    let match = cleaned.match(/(\d+)x(\d+)y/);
    if (match) return parseInt(match[1]) * parseInt(match[2]);

    // Pattern: N+N+N (e.g., 3+3+3, 5+5)
    if (/^\d+(\+\d+)+$/.test(cleaned)) {
      return cleaned.split('+').reduce((sum, n) => sum + parseInt(n), 0);
    }

    // Pattern: Nyr or Nyear (e.g., 5yr, 10year)
    match = cleaned.match(/(\d+)y/);
    if (match) return parseInt(match[1]);

    // Pattern: just a number
    match = cleaned.match(/^(\d+)$/);
    if (match) return parseInt(match[1]);

    return 0;
  },

  /**
   * WALE calculation with Option consideration logic
   * - Lease < 2 years: considers Option in WALE (effectiveYears = remaining + option)
   * - Lease 2-5 years: option as reference only, not in WALE
   * - Lease > 5 years: option not mentioned
   */
  calculateWALE(tenants) {
    const now = new Date();
    let totalRent = 0;
    let weightedYears = 0;
    const details = [];

    tenants.forEach(t => {
      if (!t.expiryDate || !t.annualRent) return;
      const expiry = new Date(t.expiryDate);
      const yearsRemaining = Math.max(0, (expiry - now) / (365.25 * 24 * 60 * 60 * 1000));
      const monthsRemaining = Math.max(0, yearsRemaining * 12);

      // Option consideration logic
      let effectiveYears = yearsRemaining;
      let optionNote = '';
      const optionYears = this.parseOptionYears(t.leaseOption);

      if (optionYears > 0 && t.leaseOption !== 'No Option' && yearsRemaining > 0) {
        if (yearsRemaining < 2) {
          // Lease < 2 years: consider option in WALE
          effectiveYears = yearsRemaining + optionYears;
          optionNote = 'Lease expiring within 2 years — Option considered in WALE assessment';
        } else if (yearsRemaining <= 5) {
          // Lease 2-5 years: option as reference only
          optionNote = `Option: ${t.leaseOption} (reference only, not included in WALE)`;
        }
        // Lease > 5 years: no mention of option
      }

      totalRent += t.annualRent;
      weightedYears += effectiveYears * t.annualRent;

      details.push({
        name: t.name || 'Unnamed',
        expiryDate: t.expiryDate,
        annualRent: t.annualRent,
        leaseOption: t.leaseOption || '',
        yearsRemaining,
        effectiveYears,
        optionNote,
        monthsRemaining,
        isExpired: yearsRemaining <= 0,
        isExpiringSoon: monthsRemaining > 0 && monthsRemaining <= Config.default.leaseExpiryWarningMonths
      });
    });

    const wale = totalRent > 0 ? weightedYears / totalRent : 0;
    return { wale, tenantDetails: details, totalRent };
  }
};

// ============================================
// ASSESSMENT MODULE
// ============================================
const Assessor = {
  assessLVR(lvr, propertyType, policy = Config.default) {
    const cap = policy.lvr[propertyType] || 70;
    if (lvr <= cap - 10) {
      return { status: 'pass', message: `Well within ${cap}% LVR cap` };
    } else if (lvr <= cap) {
      return { status: 'warn', message: `At upper limit (${cap}% cap)` };
    } else {
      return { status: 'fail', message: `Exceeds ${cap}% LVR cap` };
    }
  },

  assessICR(icr, policy = Config.default) {
    if (icr >= policy.icr.standard) {
      return { status: 'pass', message: `Meets standard ${policy.icr.standard}x threshold` };
    } else if (icr >= policy.icr.minimum) {
      return { status: 'warn', message: `Above minimum (${policy.icr.minimum}x) but below standard` };
    } else {
      return { status: 'fail', message: `Below minimum ${policy.icr.minimum}x ICR` };
    }
  },

  assessDSCR(dscr, policy = Config.default) {
    if (dscr >= policy.dscr.standard) {
      return { status: 'pass', message: `Meets ${policy.dscr.standard}x DSCR standard` };
    } else if (dscr >= policy.dscr.minimum) {
      return { status: 'warn', message: `Above minimum but needs review` };
    } else {
      return { status: 'fail', message: `Below minimum ${policy.dscr.minimum}x DSCR` };
    }
  },

  assessWALE(wale) {
    if (wale >= Config.default.wale.low) {
      return { status: 'pass', message: `Low risk — WALE > ${Config.default.wale.low} years` };
    } else if (wale >= Config.default.wale.medium) {
      return { status: 'warn', message: `Medium risk — WALE ${Config.default.wale.medium}-${Config.default.wale.low} years` };
    } else {
      return { status: 'fail', message: `High risk — WALE < ${Config.default.wale.medium} years` };
    }
  },

  /**
   * Assess Loan Term vs WALE
   * Compare loan term (years) against WALE (years)
   */
  assessLoanTermVsWALE(loanTerm, wale) {
    if (loanTerm <= wale) {
      return {
        status: 'pass',
        message: 'Loan term within WALE coverage.',
        detail: `Loan Term ${loanTerm} yrs ≤ WALE ${wale.toFixed(1)} yrs`
      };
    } else {
      return {
        status: 'fail',
        message: 'Loan term exceeds WALE. Lease expiry risk during loan period.',
        detail: `Loan Term ${loanTerm} yrs > WALE ${wale.toFixed(1)} yrs`
      };
    }
  },

  getOverallStatus(assessments) {
    const statuses = Object.values(assessments).filter(a => a && a.status).map(a => a.status);
    
    if (statuses.includes('fail')) {
      const failCount = statuses.filter(s => s === 'fail').length;
      return {
        status: 'fail',
        icon: '✗',
        text: 'Does Not Meet Criteria',
        description: `${failCount} metric${failCount > 1 ? 's' : ''} outside acceptable thresholds`
      };
    } else if (statuses.includes('warn')) {
      return {
        status: 'warn',
        icon: '⚠',
        text: 'Review Required',
        description: 'Some metrics at threshold limits — lender discretion may apply'
      };
    } else {
      return {
        status: 'pass',
        icon: '✓',
        text: 'Meets Criteria',
        description: 'All key metrics within acceptable thresholds'
      };
    }
  }
};

// Export for use in other modules (when using ES modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Calculator, Assessor };
}
