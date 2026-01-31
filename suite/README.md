# Oney Tool Suite

> Complete Credit Assessment Platform - All tools in one place with shared data flow

## 🎯 Vision

Oney Tool Suite is the **premium tier** of Oney & Co's digital product line. It integrates all individual tools into a unified workflow where data flows seamlessly between modules.

## 📦 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ONEY TOOL SUITE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐                                              │
│  │ SHARED STATE  │◄───────────────────────────────────────┐     │
│  │               │                                        │     │
│  │ • Borrower    │    ┌─────────┐  ┌─────────┐  ┌───────┐ │     │
│  │ • Loan        │───►│ Module  │─►│ Module  │─►│  ...  │─┘     │
│  │ • Security    │    │   1     │  │   2     │  │       │       │
│  │ • Income      │    └─────────┘  └─────────┘  └───────┘       │
│  └───────────────┘                                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   ASSESSMENT WORKFLOW                    │   │
│  │                                                          │   │
│  │  1. Financial Health Check                               │   │
│  │     └─► Determines: proceed / refinance / wait           │   │
│  │                                                          │   │
│  │  2. Borrower Profile                                     │   │
│  │     └─► Determines: credit pathway                       │   │
│  │                                                          │   │
│  │  3. Loan Purpose Analysis                                │   │
│  │     └─► Determines: product type / risk level            │   │
│  │                                                          │   │
│  │  4. Security Assessment                                  │   │
│  │     └─► Determines: LVR / security risk / valuation      │   │
│  │                                                          │   │
│  │  5. Servicing Analysis                                   │   │
│  │     └─► Determines: serviceability / stress test         │   │
│  │                                                          │   │
│  │  6. Other Credit Risks                                   │   │
│  │     └─► Determines: mitigants / conditions               │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               CREDIT SUMMARY GENERATOR                   │   │
│  │                                                          │   │
│  │  • Aggregates all module outputs                         │   │
│  │  • Generates formatted credit paper                      │   │
│  │  • Export to PDF / Word / JSON                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Shared State System

The Suite uses a centralized state management system:

```javascript
const SuiteState = {
  shared: {
    // Borrower info
    borrowerName: "",
    borrowerType: "",
    industry: "",
    abn: "",
    
    // Loan request
    loanAmount: 0,
    loanPurpose: "",
    loanTerm: 0,
    interestRate: 0,
    
    // Security
    propertyAddress: "",
    propertyType: "",
    propertyValue: 0,
    existingDebt: 0,
    
    // Income
    grossIncome: 0,
    incomeType: "",
    monthlyExpenses: 0,
    monthlyDebtPayments: 0
  },
  
  modules: {
    'financial-health': {},
    'borrower-profile': {},
    'loan-purpose': {},
    'security': {},
    'servicing': {},
    'other-risks': {},
    'summary': {}
  },
  
  completed: [],
  version: "1.0.0"
};
```

## 📊 Module Details

### 1. Financial Health Check
**Purpose:** Determine if the borrower's current situation warrants proceeding, refinancing, or a longer-term plan.

**Inputs from Shared:**
- Gross income
- Monthly expenses
- Existing debt

**Module-specific inputs:**
- Credit score
- Emergency fund
- Savings rate

**Outputs:**
- Health score
- Recommendation (proceed/refinance/wait 6-24 months)

### 2. Borrower Profile
**Purpose:** Analyze borrower characteristics and determine appropriate credit pathways.

**Inputs from Shared:**
- Borrower name/type
- Industry
- ABN

**Module-specific inputs:**
- Years in business
- Business structure
- Annual turnover

**Outputs:**
- Credit pathway recommendation
- Pathway justification

### 3. Loan Purpose
**Purpose:** Understand the loan purpose and its implications.

**Inputs from Shared:**
- Loan amount
- Primary purpose

**Module-specific inputs:**
- Detailed purpose description
- Business vs personal use
- Purpose risk level

**Outputs:**
- Recommended product type
- Purpose-based pathway

### 4. Security Assessment
**Purpose:** Evaluate the security property.

**Inputs from Shared:**
- Property address/type
- Property value
- Loan amount

**Module-specific inputs:**
- Zoning
- Land size
- Building age
- Tenancy status

**Outputs:**
- LVR calculation
- Security risk rating
- Valuation method

### 5. Servicing Analysis
**Purpose:** Calculate debt serviceability.

**Inputs from Shared:**
- Gross income
- Monthly expenses
- Loan amount
- Interest rate

**Module-specific inputs:**
- MLL adjusted income
- Add-backs
- Rental income/shading
- Rate buffer

**Outputs:**
- Stressed monthly repayment
- Servicing result (comfortable/marginal/requires mitigants/fail)

### 6. Other Risks
**Purpose:** Identify and document additional credit risks.

**Module-specific inputs:**
- Character risk
- Industry risk
- Concentration risk
- Market risk
- Credit history (defaults, bankruptcy)
- Mitigants
- Conditions

**Outputs:**
- Risk profile
- Required mitigants/conditions

## 💰 Pricing Strategy

| Product | Price | Includes |
|---------|-------|----------|
| Individual Tools | $29-$99 | Single tool access |
| Tool Bundles | $149-$249 | 3-5 related tools |
| **Oney Tool Suite** | **$499** | All tools + shared data + workflow |

**Suite Benefits:**
- ✅ All current tools included
- ✅ All future tools included (updates)
- ✅ Shared data flow (enter once, use everywhere)
- ✅ Credit summary generator
- ✅ Export to PDF/Word
- ✅ Save/load assessments
- ✅ Priority support

## 🔧 Technical Implementation

### Current Stack
- **Frontend:** Pure HTML/CSS/JavaScript (no dependencies)
- **Storage:** LocalStorage for persistence
- **Export:** Native browser APIs (print, download)

### Future Enhancements
- [ ] Cloud sync (optional account)
- [ ] Team collaboration
- [ ] API integrations (credit bureaus, valuation)
- [ ] White-label option for brokerages
- [ ] Mobile app (PWA)

## 📁 File Structure

```
suite/
├── index.html          # Main Suite application
├── README.md           # This file
├── landing.html        # Marketing landing page
└── modules/            # Future: separate module files
    ├── financial-health.js
    ├── borrower-profile.js
    ├── loan-purpose.js
    ├── security.js
    ├── servicing.js
    └── other-risks.js
```

## 🚀 Roadmap

### Phase 1 (Current)
- [x] Core Suite framework
- [x] Shared state management
- [x] All 6 assessment modules
- [x] Credit summary generator
- [x] Export functionality

### Phase 2
- [ ] Individual tool integration (import existing tools)
- [ ] Enhanced calculations
- [ ] More export formats
- [ ] Print-optimized styling

### Phase 3
- [ ] PWA support (offline)
- [ ] Cloud sync
- [ ] Team features
- [ ] API integrations

## 📝 Development Notes

### Adding a New Module

1. Add module container in HTML:
```html
<div class="module-container" id="module-new-module">
  <!-- Module content -->
</div>
```

2. Add navigation item:
```html
<div class="nav-item" data-module="new-module">
  <span class="nav-item-number">N</span>
  Module Name
</div>
```

3. Add module state:
```javascript
SuiteState.modules['new-module'] = {};
```

4. Add shared data display elements as needed

### Updating Shared Inputs

When adding new shared inputs:
1. Add input element with `class="shared-input"` and `data-key="keyName"`
2. Add display elements with `data-display="keyName"` in relevant modules
3. Update the summary generator to include new fields

---

*Oney Tool Suite - Empowering Better Credit Decisions*
