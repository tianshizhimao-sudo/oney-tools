/* Published product snapshots: no automatic eligibility decisions or bank-wide quotes. */
(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = value => String(value ?? 'Not stated').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  const percent = value => value == null || value === '' || !Number.isFinite(Number(value)) ? 'Not stated' : `${+(Number(value) * 100).toFixed(4)}%`;
  const link = (url, title) => { try { const u = new URL(url); return u.protocol === 'https:' ? `<a href="${escape(u.href)}" target="_blank" rel="noopener noreferrer">${escape(title)}</a>` : ''; } catch { return ''; } };
  function term(value) {
    const m = /^P(?:(\d+)Y)?(?:(\d+)M)?$/.exec(value || '');
    if (!m || (!m[1] && !m[2])) return value || 'Not stated';
    const months = Number(m[1] || 0) * 12 + Number(m[2] || 0);
    return months % 12 ? `${months} months` : `${months / 12} year${months === 12 ? '' : 's'}`;
  }
  function productEntries(data) {
    return Object.entries(data.banks || {}).flatMap(([bank, b]) => Object.entries(b.products || {}).filter(([,p]) => p.rawProduct).map(([key, p]) => ({bank, key, ...p})));
  }
  function tierText(t) {
    const format = v => v == null ? 'not stated' : t.unitOfMeasure === 'PERCENT' ? percent(v) : t.unitOfMeasure === 'DOLLAR' ? `AUD ${Number(v).toLocaleString('en-AU')}` : String(v);
    return `${t.name || label(t.unitOfMeasure)}: ${format(t.minimumValue)} to ${format(t.maximumValue)}${t.rateApplicationMethod ? ' (' + label(t.rateApplicationMethod) + ')' : ''}${t.additionalInfo ? '. ' + t.additionalInfo : ''}`;
  }
  function rowWarnings(r) {
    const out=[];
    if (r.lendingRateType === 'DISCOUNT') out.push('Discount component, not a payable interest rate.');
    if (/base rate|index rate|margin/i.test(r.additionalInfo || '')) out.push('Reference/base rate or margin condition: not a personalised all-in quote.');
    if (!(r.tiers || []).some(t => /LVR|loan.to.value/i.test(t.name || ''))) out.push('No per-rate LVR tier stated; check product limits and lender confirmation.');
    if (r.lendingRateType === 'FIXED' && !r.additionalValue) out.push('Fixed term not stated; confirm with lender.');
    return out;
  }
  function records(items) {
    if (!items?.length) return '<p>Not stated in this response; do not assume none.</p>';
    // Preserve all supplied conditions including nested discounts and fee formulas.
    const render = obj => {
      if (obj == null) return 'Not stated';
      if (Array.isArray(obj)) return '<ul>'+obj.map(x=>'<li>'+render(x)+'</li>').join('')+'</ul>';
      if (typeof obj !== 'object') return escape(obj);
      return '<dl>'+Object.entries(obj).map(([k,v])=>`<dt>${escape(label(k))}</dt><dd>${/Uri$|Url$/.test(k) && typeof v === 'string' ? link(v,'Official source') || escape(v) : render(v)}</dd>`).join('')+'</dl>';
    };
    return render(items);
  }
  function renderProduct(p, data) {
    const d=p.rawProduct, rows=d.lendingRates || [];
    return `<h3>${escape(p.bank)} — ${escape(d.name)}</h3>
      <p>Retrieved: ${escape(p.fetchedAt || data.fetchedAt)} · Product record updated: ${escape(d.lastUpdated || 'Not stated')}.</p>
      <p><strong>Rate effective date: not separately stated in this snapshot.</strong> Product availability dates (${escape(d.effectiveFrom || 'not stated')} to ${escape(d.effectiveTo || 'not stated')}) are not a rate-change date. ${link(p.sourceUrl,'Official product response')}</p>
      <p>${escape(d.description || '')}</p>
      ${JSON.stringify(d).includes('30 June 2025') ? '<p><strong>Pending confirmation: this source still mentions a fee waiver ending 30 June 2025. Do not treat that waiver as current.</strong></p>' : ''}
      <details><summary>Eligibility and product limits — read before comparing</summary>${records(d.eligibility)}${records(d.constraints)}</details>
      <details><summary>Fees, discounts and other product terms</summary>${records(d.fees)}${records(d.features)}${records(d.additionalInformation ? [d.additionalInformation] : [])}</details>
      <p>Comparison rates are lender-supplied and may use different assumptions. Check the lender’s comparison-rate warning; fees and your loan amount or term can change the comparison. These are source records, not an approval or a quote for your circumstances.</p>
      <p>${rows.length} published rate records. ${rows.length ? 'Each row retains its own conditions.' : '<strong>No numeric rate published here. Obtain a lender quote; do not infer a rate.</strong>'}</p>
      <div class="source-table-scroll"><table><thead><tr><th>Rate / comparison</th><th>Type / term</th><th>Purpose / repayments</th><th>Conditions and sources</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-source-row="${i}"><td>${escape(percent(r.rate))} p.a.<br>Comparison: ${escape(percent(r.comparisonRate))}</td><td>${escape(label(r.lendingRateType))}${r.additionalValue ? '<br>'+escape(term(r.additionalValue)) : ''}</td><td>${escape(label(r.loanPurpose))}<br>${escape(label(r.repaymentType))}<br>${escape(label(r.interestPaymentDue))}</td><td>${rowWarnings(r).map(w=>'<strong>'+escape(w)+'</strong><br>').join('')}${escape(r.additionalInfo || '')}<ul>${(r.tiers || []).map(t=>'<li>'+escape(tierText(t))+' '+link(t.additionalInfoUri,'Tier source')+'</li>').join('')}</ul>${link(r.additionalInfoUri,'Rate source')}<details><summary>Full rate terms</summary>${records([r])}</details></td></tr>`).join('')}</tbody></table></div>`;
  }
  function mount(container, data) {
    if (!container) return;
    const items=productEntries(data);
    container.innerHTML=`<h2>Published lender products</h2><p>Official source snapshot — ${items.length} products. Choose a named product and review every applicable condition. No rates are inferred from the RBA change.</p><label for="sourceProduct">Product</label> <select id="sourceProduct">${items.map((p,i)=>`<option value="${i}">${escape(p.bank)} — ${escape(p.rawProduct.name)}</option>`).join('')}</select><div id="sourceProductDetail"></div>`;
    const select=container.querySelector('select'),detail=container.querySelector('#sourceProductDetail');
    const update=()=>{detail.innerHTML=items[Number(select.value)] ? renderProduct(items[Number(select.value)],data) : '<p>No verified product response available.</p>';};
    select.addEventListener('change',update);update();
  }
  const api={term,percent,tierText,rowWarnings,productEntries,renderProduct,mount};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.OneyRateSources=api;
})(typeof window === 'undefined' ? globalThis : window);
