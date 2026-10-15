# Four-domain comparison preview

This iteration supersedes the inner-ring colour policy in the earlier dual-ring preview note. It changes presentation and primary grouping only, not financial rules, document mappings, evidence marks or overall ratings.

Both rings now use the same order and fresh identifiers:

1. Management risk (`risk_management`): ato_debt, missed_ato_plan, sg_unevidenced, dishonours_recent, supplier_arrears.
2. Transaction risk (`risk_transaction`): working_capital_vague, contract_growth.
3. Servicing risk / capability (`risk_servicing`): mca_present, high_dti, stale_preapproval, turnaround_claim, short_wale.
4. Security risk (`risk_security`): high_lvr_second_mortgage, valuation_sensitive, zoning_environmental_missing, related_party_security.

Each existing trigger has one primary domain; real issues can span domains. Short WALE belongs primarily to Servicing because its existing question tests repayment if the external tenant leaves. Original reasons and evidence requests are unchanged. These mappings do not constitute complete management/credit-history, transaction, servicing or security assessment. GSA needs, ranking, guarantees and lender acceptability are not automatically assessed.

The inner ring uses purple when selected triggers are shown, with textual Critical / Important / Helpful counts. These are review priorities, not risk ratings. Grey means no selected trigger shown in the current tier, not safety. Area-level omitted counts disclose selected triggers hidden by Simple without exposing gated reasons. Manual review considerations are shown separately from narrower mapped coverage. Unconfirmed suggestions remain separate. Outer colours retain their existing manual-confirmation, basis and stale-state requirements. Fresh IDs prevent reuse of old-area judgements; manual entries remain session-only and start unassessed on reload.

CF-001 has one Critical valuation trigger and two Important purpose/contract triggers. It therefore shows purple in Transaction and Security, grey elsewhere. Its original conditional sample Green overall rating is unchanged and does not infer four assessed Green domains. Receipt, supporting evidence or mitigation does not remove selected inner triggers.

Tests include exact 16-trigger coverage, CF-001 colours/counts, new IDs, manual staleness/reset, tiers, keyboard, copy and print-source semantics. Actual device rendering and native print pagination remain unverified.
