#!/usr/bin/env node
/**
 * CDR Open Banking API - Bank Rate Fetcher
 * 
 * Fetches home loan rates from 7 Australian banks via their public CDR APIs.
 * No dependencies required — uses built-in Node.js fetch.
 * 
 * Usage: node scripts/fetch-rates.js
 * Output: data/rates.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Bank Configuration ──
// Product IDs verified via research: ~/clawd/oney-co/research/rate-tracker-auto-research.md

const BANKS = {
  CBA: {
    displayName: 'Commonwealth Bank',
    baseUrl: 'https://api.commbank.com.au/public/cds-au/v1',
    products: {
      'Digi Home Loan (OO)': 'c1d7e8ef741e45e5b013fa7d05574e80',
      'Digi Home Loan (Inv)': 'b071254b466a420ea2ae755d9fc02141',
      'Simple Home Loan (Inv)': '96b471de2e5e48328201abb352d0ed98',
    }
  },
  Westpac: {
    displayName: 'Westpac',
    baseUrl: 'https://digital-api.westpac.com.au/cds-au/v1',
    products: {
      'Flexi First (OO)': 'HLVariableFlexiOwnerOccupied',
      'Flexi First (Inv)': 'HLVariableFlexiInvestment',
      'Rocket Loan (OO)': 'HLVariableOffsetOwnerOccupied',
      'Fixed Rate': 'HLFixed',
      // Commercial products
      'Secured Business Loan': 'SecuredBusinessLoan',
      'Business Overdraft': 'BusinessOverdraft',
      'Unsecured Business Overdraft': 'UnsecuredBusinessOverdraft',
      'Unsecured Business Loan': 'UnsecuredBusinessLoan',
      'Bank Bill Business Loan': 'BankBillBusinessLoan',
    }
  },
  NAB: {
    displayName: 'National Australia Bank',
    baseUrl: 'https://openbank.api.nab.com.au/cds-au/v1',
    products: {
      'Base Variable': 'e34c524c-6323-468f-8e20-36130e256fd5',
      'Tailored': '65bcb7bd-e50c-4b65-b7d7-9d5abc089a5a',
    }
  },
  ANZ: {
    displayName: 'ANZ',
    baseUrl: 'https://api.anz/cds-au/v1',
    products: {
      'Standard Variable': 'f71660e7-51a9-4029-b4d0-39d09489d7bc',
      'Simplicity PLUS': '544ad5cb-7e52-4a30-b1d7-a080abafbfac',
      'Fixed Rate': '3a86f9e4-1b41-4222-9091-5934d1fc9178',
    }
  },
  Macquarie: {
    displayName: 'Macquarie Bank',
    baseUrl: 'https://api.macquariebank.io/cds-au/v1',
    products: {
      'Basic Home Loan': 'LN001MBLBAS001',
      'Offset Home Loan': 'LN001MBLSTD001',
    }
  },
  ING: {
    displayName: 'ING',
    baseUrl: 'https://id.ob.ing.com.au/cds-au/v1',
    products: {
      'Mortgage Simplifier': 'f53a58f1-a964-4d9f-aa9d-23fec9148451',
      'Orange Advantage': '9b408eec-e2ff-4c65-a19f-d72fbaa181f9',
      'Fixed Rate': '4bacdad3-d6f4-4c99-a50b-690a46bd9a23',
    }
  },
  Bendigo: {
    displayName: 'Bendigo Bank',
    baseUrl: 'https://api.cdr.bendigobank.com.au/cds-au/v1',
    products: {
      'Easy Home Loan': '2e082120-40d6-4587-8ca9-eaafd8201877',
      'Flex Home Loan': '7a5853d0-6ef4-4c90-9e22-1c091c0de69d',
      'Express Home Loan': '01fec5c4-a888-4330-a8cc-4a0a0ac931b5',
    }
  },
};

// ── Configuration ──
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;
const DELAY_BETWEEN_BANKS_MS = 500;

// ── Fetch with retry + timeout ──
async function fetchWithRetry(url, headers, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      const isLast = attempt === retries;
      const errMsg = err.name === 'AbortError' ? 'Request timeout' : err.message;
      
      if (isLast) {
        throw new Error(`Failed after ${retries} attempts: ${errMsg}`);
      }

      console.warn(`  ⚠️  Attempt ${attempt}/${retries} failed: ${errMsg}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Extract lending rates from CDR product response ──
function extractLendingRates(productData) {
  const rates = productData.lendingRates || [];
  
  return rates.map(r => {
    // Extract LVR tier info
    const lvrTier = (r.tiers || []).find(t => 
      t.name && t.name.toUpperCase().includes('LVR')
    );

    // Parse fixed period (e.g., "P1Y" -> 1, "P2Y" -> 2, "P3Y" -> 3)
    let fixedYears = null;
    if (r.additionalValue) {
      const match = r.additionalValue.match(/P(\d+)Y/);
      if (match) fixedYears = parseInt(match[1]);
    }

    return {
      lendingRateType: r.lendingRateType || null,        // VARIABLE, FIXED, etc.
      rate: r.rate ? parseFloat(r.rate) : null,           // Decimal (e.g., 0.0539)
      ratePercent: r.rate ? +(parseFloat(r.rate) * 100).toFixed(4) : null, // Percentage (e.g., 5.39)
      comparisonRate: r.comparisonRate ? parseFloat(r.comparisonRate) : null,
      comparisonRatePercent: r.comparisonRate ? +(parseFloat(r.comparisonRate) * 100).toFixed(4) : null,
      repaymentType: r.repaymentType || null,             // PRINCIPAL_AND_INTEREST, INTEREST_ONLY
      loanPurpose: r.loanPurpose || null,                 // OWNER_OCCUPIED, INVESTMENT
      fixedYears: fixedYears,
      lvrMin: lvrTier ? lvrTier.minimumValue : null,
      lvrMax: lvrTier ? lvrTier.maximumValue : null,
      additionalInfo: r.additionalInfo || null,
      additionalInfoUri: r.additionalInfoUri || null,
    };
  });
}

// ── Fetch a single product's rates ──
async function fetchProductRates(baseUrl, productId) {
  const url = `${baseUrl}/banking/products/${encodeURIComponent(productId)}`;
  const headers = {
    'x-v': '4',
    'Accept': 'application/json',
  };

  const json = await fetchWithRetry(url, headers);
  const product = json.data;

  return {
    productId: product.productId,
    name: product.name || productId,
    description: product.description || null,
    lastUpdated: product.lastUpdated || null,
    rates: extractLendingRates(product),
  };
}

// ── Summarize rates for quick lookup ──
function summarizeRates(rates) {
  const summary = {
    variable: { oo: {}, inv: {} },
    fixed: { oo: {}, inv: {} },
  };

  for (const r of rates) {
    if (!r.rate) continue;

    const isVariable = r.lendingRateType === 'VARIABLE';
    const isFixed = r.lendingRateType === 'FIXED';
    const isPnI = r.repaymentType === 'PRINCIPAL_AND_INTEREST';
    const isIO = r.repaymentType === 'INTEREST_ONLY';
    const isOO = r.loanPurpose === 'OWNER_OCCUPIED';
    const isInv = r.loanPurpose === 'INVESTMENT';

    const purposeKey = isInv ? 'inv' : 'oo';
    const lvrKey = r.lvrMax ? `lvr${r.lvrMax}` : 'default';

    if (isVariable) {
      const key = isPnI ? 'pi' : isIO ? 'io' : 'default';
      if (!summary.variable[purposeKey][lvrKey]) {
        summary.variable[purposeKey][lvrKey] = {};
      }
      summary.variable[purposeKey][lvrKey][key] = r.ratePercent;
    }

    if (isFixed && r.fixedYears) {
      const fixedKey = `${r.fixedYears}yr`;
      const key = isPnI ? 'pi' : isIO ? 'io' : 'default';
      if (!summary.fixed[purposeKey][fixedKey]) {
        summary.fixed[purposeKey][fixedKey] = {};
      }
      if (!summary.fixed[purposeKey][fixedKey][lvrKey]) {
        summary.fixed[purposeKey][fixedKey][lvrKey] = {};
      }
      summary.fixed[purposeKey][fixedKey][lvrKey][key] = r.ratePercent;
    }
  }

  return summary;
}

// ── Main ──
async function main() {
  console.log('🏦 CDR Open Banking Rate Fetcher');
  console.log('================================\n');

  const result = {
    fetchedAt: new Date().toISOString(),
    fetchedAtAEST: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
    banks: {},
    errors: [],
    stats: {
      totalBanks: Object.keys(BANKS).length,
      successBanks: 0,
      failedBanks: 0,
      totalProducts: 0,
      successProducts: 0,
      failedProducts: 0,
    },
  };

  for (const [bankKey, bankConfig] of Object.entries(BANKS)) {
    console.log(`📡 Fetching ${bankKey} (${bankConfig.displayName})...`);
    
    const bankResult = {
      displayName: bankConfig.displayName,
      products: {},
      fetchedAt: new Date().toISOString(),
      success: true,
    };

    let bankHasError = false;

    for (const [productName, productId] of Object.entries(bankConfig.products)) {
      result.stats.totalProducts++;

      try {
        console.log(`   → ${productName} (${productId})`);
        const productData = await fetchProductRates(bankConfig.baseUrl, productId);
        
        bankResult.products[productName] = {
          ...productData,
          summary: summarizeRates(productData.rates),
        };

        const rateCount = productData.rates.length;
        console.log(`   ✅ ${productData.name}: ${rateCount} rate entries`);
        result.stats.successProducts++;

      } catch (err) {
        console.error(`   ❌ ${productName}: ${err.message}`);
        bankResult.products[productName] = {
          error: err.message,
          productId: productId,
        };
        result.errors.push({
          bank: bankKey,
          product: productName,
          productId: productId,
          error: err.message,
        });
        bankHasError = true;
        result.stats.failedProducts++;
      }
    }

    if (bankHasError && Object.values(bankResult.products).every(p => p.error)) {
      bankResult.success = false;
      result.stats.failedBanks++;
    } else {
      result.stats.successBanks++;
    }

    result.banks[bankKey] = bankResult;
    console.log('');

    // Brief delay between banks to be polite
    await sleep(DELAY_BETWEEN_BANKS_MS);
  }

  // ── Write output ──
  // Resolve output relative to the script's parent directory (oney-tools/)
  const projectRoot = path.resolve(__dirname, '..');
  const outputDir = path.join(projectRoot, 'data');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'rates.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  // ── Summary ──
  console.log('================================');
  console.log('📊 Summary');
  console.log(`   Banks: ${result.stats.successBanks}/${result.stats.totalBanks} successful`);
  console.log(`   Products: ${result.stats.successProducts}/${result.stats.totalProducts} successful`);
  
  if (result.errors.length > 0) {
    console.log(`\n⚠️  ${result.errors.length} error(s):`);
    for (const err of result.errors) {
      console.log(`   - ${err.bank} / ${err.product}: ${err.error}`);
    }
  }

  console.log(`\n✅ Rates saved to ${outputPath}`);
  console.log(`   Fetched at: ${result.fetchedAtAEST} AEST`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
