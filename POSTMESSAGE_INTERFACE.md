# Credit Paper Pro v3.1 - postMessage Interface

## Overview
Credit Paper Pro v3.1 supports iframe-to-parent communication via `postMessage` for Pro Suite integration.

## Integration Points

### 1. Auto-Send on Preview Update
When the live preview updates (any input change), results are automatically sent to parent:

```javascript
window.parent.postMessage({
  type: 'ONEY_CREDIT_PAPER_RESULT',
  data: {
    txnType: 'acquisition',
    txnSubType: 'refinance-cashout',
    txnLabel: 'Refinance (With Cash Out)',
    targetLender: 'major',
    entities: [{ name: 'John Smith', role: 'borrower', entityType: 'individual' }],
    facilityGroups: [{
      lender: 'CBA',
      facilities: [{ purpose: 'Acquisition', amount: 5000000, term: '5', rate: '6.5', type: 'term' }]
    }],
    totalFacilities: 5000000,
    securities: [{ address: '123 Main St', type: 'retail', value: 7000000, tenure: 'freehold', ownerType: 'borrower' }],
    totalSecurityValue: 7000000,
    lvr: 71.4,
    riskFactors: ['concentration-risk'],
    dealBreakers: [],
    overallSurplus: '150000',
    overallICR: '1.8',
    overallDSCR: '1.5',
    businessBackground: 'Established retail portfolio...',
    presenterName: 'Broker Name',
    presenterCompany: 'Oney & Co',
    timestamp: '2026-02-25T06:20:00.000Z'
  }
}, '*');
```

### 2. On-Demand Request
Pro Suite can request current results at any time:

```javascript
iframe.contentWindow.postMessage({ type: 'ONEY_CREDIT_PAPER_REQUEST' }, '*');
// Credit Paper responds with ONEY_CREDIT_PAPER_RESULT
```

## Result Data Structure

| Field | Type | Description |
|-------|------|-------------|
| `txnType` | string | Transaction type (acquisition, refinance, etc.) |
| `txnLabel` | string | Human-readable transaction label |
| `targetLender` | string | Target lender tier (major, second, non-bank, private) |
| `entities` | array | Borrower/guarantor entities |
| `facilityGroups` | array | Grouped facilities by lender |
| `totalFacilities` | number | Sum of all facility amounts |
| `securities` | array | Security properties |
| `totalSecurityValue` | number | Sum of all security values |
| `lvr` | number\|null | Loan-to-value ratio (%) |
| `riskFactors` | array | Identified risk factor keys |
| `dealBreakers` | array | Deal breaker descriptions |
| `overallSurplus` | string | Servicing surplus |
| `overallICR` | string | Interest cover ratio |
| `overallDSCR` | string | Debt service coverage ratio |
| `timestamp` | string | ISO 8601 timestamp |

## Key Changes in v3.1

1. **Version marker**: Added `<!-- v3.1 -->` to HTML header
2. **Auto-send**: Automatically sends results when `updatePreview()` runs
3. **Event listener**: Responds to `ONEY_CREDIT_PAPER_REQUEST` from parent
4. **No breaking changes**: All existing Credit Paper Pro v3 functionality preserved
