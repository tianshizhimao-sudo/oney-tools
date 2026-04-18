# Oney Security v1.8.1 - postMessage Interface

## Overview
Oney Security v1.8 now supports iframe-to-parent communication via `postMessage`. This allows Pro Suite to read assessment results in real-time.

## Integration Points

### 1. Auto-Send on Assessment Complete
When user completes an assessment in Oney Security (all modules evaluated), results are automatically sent to parent:

```javascript
// Automatically sent when S.calc() completes
window.parent.postMessage({
  type: 'ONEY_SECURITY_RESULT',
  data: {
    riskScore: 65,
    verdict: 'MODERATE',
    color: 'amber',
    lvr: 0.72,
    lenderRecommendations: [
      { lender: '🏦 Big 4 Banks', status: '✅ Likely to approve', note: 'Within comfort zone' },
      { lender: '🏛️ Regional Banks', status: '✅ Likely to approve', note: 'Within comfort zone' },
      // ... more lenders
    ],
    propertyAddress: 'Level 5, 123 Pitt St, Sydney NSW 2000',
    assessmentDate: '2025-02-25T06:20:00.000Z',
    moduleScores: [
      { name: 'Zoning & Compliance', key: 'zoning', score: 75, color: 'green' },
      { name: 'Valuation & LVR', key: 'valuation', score: 60, color: 'amber' },
      // ... more modules
    ]
  }
}, '*');
```

### 2. On-Demand Request (Optional)
Pro Suite can request current results at any time:

```javascript
// From Pro Suite parent window:
document.querySelector('iframe').contentWindow.postMessage({
  type: 'ONEY_SECURITY_REQUEST'
}, '*');

// Oney Security responds with current lastScores
```

## Listening in Pro Suite

```javascript
window.addEventListener('message', function(event) {
  if (event.data?.type === 'ONEY_SECURITY_RESULT') {
    const result = event.data.data;
    console.log('Risk Score:', result.riskScore);
    console.log('LVR:', result.lvr);
    console.log('Lender Recommendations:', result.lenderRecommendations);
    // Update Pro Suite UI with results
  }
});
```

## Result Data Structure

```typescript
{
  type: 'ONEY_SECURITY_RESULT',
  data: {
    riskScore: number,              // 0-100 overall score
    verdict: string,                // 'GREEN', 'MODERATE', 'HIGH_RISK'
    color: string,                  // 'green', 'amber', 'red'
    lvr: number | null,             // Loan-to-Value ratio (0.0-1.0)
    lenderRecommendations: Array,   // Array of lender assessment objects
    propertyAddress: string,        // Property address from form
    assessmentDate: string,         // ISO 8601 timestamp
    moduleScores: Array             // Individual module scores
  }
}
```

## Key Changes in v1.8.1

1. **Version marker**: Added `<!-- v1.8.1 — Added postMessage interface for Pro Suite integration -->` to HTML header
2. **Auto-send**: Automatically sends results when `S.calc()` completes
3. **Event listener**: Added `window.addEventListener('message', ...)` for incoming parent requests
4. **No breaking changes**: All existing Oney Security v1.8 functionality preserved

## Testing

1. Embed the index.html in an iframe:
```html
<iframe src="/oney-security/index.html" id="security-frame"></iframe>
```

2. Listen for messages:
```javascript
window.addEventListener('message', (e) => {
  if (e.data?.type === 'ONEY_SECURITY_RESULT') {
    console.log('Received assessment:', e.data.data);
  }
});
```

3. Complete assessment in iframe - Pro Suite automatically receives results

## Notes

- Origin validation checks `event.source !== window.parent` for security
- Results include lender recommendations extracted from evaluation matrix
- All data is automatically captured from the assessment state (S.lastScores)
- Try-catch blocks prevent errors from breaking the assessment UI
