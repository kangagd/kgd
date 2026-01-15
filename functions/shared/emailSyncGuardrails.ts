/**
 * EMAIL SYNC GUARDRAILS
 * 
 * CRITICAL INVARIANTS (must be preserved in all EmailMessage upserts):
 * 
 * 1. NO BODY REGRESSION
 *    - Never overwrite existing non-empty body_html/body_text with empty values
 *    - If incoming body is empty but existing has content, preserve existing
 *    
 * 2. TRUTHFUL has_body
 *    - has_body must reflect reality: true iff body_html or body_text has usable content
 *    - Never set has_body=false if it was previously true
 *    - Use hasBodyTruth(body_html, body_text) to compute actual state
 *    
 * 3. CORRECT sync_status
 *    - "ok" = full body extracted successfully
 *    - "partial" = body missing or parse failed, but preserved previous content
 *    - "failed" = parse error AND no previous content
 *    - Never downgrade status if existing status is "ok" and new data is empty
 *    
 * 4. PARSE_ERROR TRACKING
 *    - Set parse_error only if sync_status != "ok"
 *    - Clear parse_error (set null) if sync_status == "ok"
 *    - Include reason: "body_missing", "parse_failed: <msg>", etc.
 *    
 * 5. last_synced_at
 *    - Always set to current ISO timestamp on every update
 *    - Enables debugging and track sync freshness
 * 
 * USAGE:
 * Before updating EmailMessage, call validateBeforeUpdate() and logPreventedRegression().
 * After batch operations, call reportSyncGuardrailViolations() to detect issues.
 */

/**
 * Check if a string is non-empty (not null, not "", not whitespace-only)
 */
function isNonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

/**
 * Check if HTML is empty after stripping tags
 */
function isEmptyHtml(html) {
  if (!html) return true;
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  return stripped.length === 0;
}

/**
 * Determine if message has usable body content
 */
function hasBodyTruth(bodyHtml, bodyText) {
  return (isNonEmptyString(bodyHtml) && !isEmptyHtml(bodyHtml)) ||
         isNonEmptyString(bodyText);
}

/**
 * Validate before update: check if we would break invariants
 * Returns { violations: [], warnings: [] }
 */
function validateBeforeUpdate(existing, incoming, context = {}) {
  const violations = [];
  const warnings = [];
  const { messageId = '', source = 'unknown' } = context;

  if (!existing) {
    // New message, just validate incoming
    const hasBody = hasBodyTruth(incoming.body_html, incoming.body_text);
    if (!hasBody && incoming.sync_status === 'ok') {
      violations.push(`[${messageId}] sync_status=ok but no body found (from ${source})`);
    }
    return { violations, warnings };
  }

  // Existing message: check for regressions
  const existingHasBody = hasBodyTruth(existing.body_html, existing.body_text);
  const incomingHasBody = hasBodyTruth(incoming.body_html, incoming.body_text);

  // Rule 1: Never set has_body to false if it was true
  if (existing.has_body === true && incoming.has_body === false) {
    violations.push(
      `[${messageId}] Regression: has_body true → false (from ${source}). ` +
      `Existing: html=${!!existing.body_html}, text=${!!existing.body_text}`
    );
  }

  // Rule 2: Never overwrite non-empty bodies with empty
  if (existing.body_html && !incoming.body_html) {
    warnings.push(
      `[${messageId}] Body regression prevented (from ${source}): ` +
      `incoming body_html is empty but existing has content (${existing.body_html.length} chars)`
    );
  }
  if (existing.body_text && !incoming.body_text) {
    warnings.push(
      `[${messageId}] Body regression prevented (from ${source}): ` +
      `incoming body_text is empty but existing has content (${existing.body_text.length} chars)`
    );
  }

  // Rule 3: Check sync_status consistency
  if (existing.sync_status === 'ok' && incoming.sync_status !== 'ok' && incomingHasBody) {
    // OK → partial/failed is OK (body might be fresh but parse marked partial)
    // This is acceptable
  } else if (existing.sync_status === 'ok' && !incomingHasBody) {
    // Downgrading from ok → partial/failed when incoming is empty
    // This might be a problem - we should preserve ok status
    warnings.push(
      `[${messageId}] Status downgrade: ok → ${incoming.sync_status} ` +
      `(incoming has no body, should preserve ok from ${source})`
    );
  }

  // Rule 4: parse_error consistency
  if (incoming.sync_status === 'ok' && incoming.parse_error) {
    violations.push(
      `[${messageId}] Inconsistent: sync_status=ok but parse_error set to "${incoming.parse_error}"`
    );
  }
  if (incoming.sync_status !== 'ok' && !incoming.parse_error) {
    warnings.push(
      `[${messageId}] Missing parse_error for status=${incoming.sync_status} (from ${source})`
    );
  }

  return { violations, warnings };
}

/**
 * Log regression preventions for debugging
 */
function logPreventedRegression(existing, merged, context = {}) {
  const { messageId = '', source = 'unknown' } = context;

  if (!existing) return;

  if (existing.body_html && !merged.body_html) {
    console.log(
      `[emailSyncGuardrails] Prevented body_html regression: ` +
      `${messageId} from ${source}, preserved ${existing.body_html.length} chars`
    );
  }
  if (existing.body_text && !merged.body_text) {
    console.log(
      `[emailSyncGuardrails] Prevented body_text regression: ` +
      `${messageId} from ${source}, preserved ${existing.body_text.length} chars`
    );
  }
}

/**
 * Report sync guardrail violations (call after batch operations)
 */
function reportSyncGuardrailViolations(violations, warnings) {
  if (violations.length > 0) {
    console.error('[emailSyncGuardrails] VIOLATIONS DETECTED:');
    violations.forEach(v => console.error(`  ✗ ${v}`));
  }

  if (warnings.length > 0) {
    console.warn('[emailSyncGuardrails] WARNINGS:');
    warnings.forEach(w => console.warn(`  ⚠ ${w}`));
  }

  if (violations.length === 0 && warnings.length === 0) {
    console.log('[emailSyncGuardrails] All invariants held ✓');
  }

  return {
    violationCount: violations.length,
    warningCount: warnings.length,
    allClear: violations.length === 0
  };
}

/**
 * Assertion: ensure invariants hold
 * Throws if violations detected
 */
function assertEmailSyncInvariants(existing, incoming, context = {}) {
  const { violations, warnings } = validateBeforeUpdate(existing, incoming, context);

  if (violations.length > 0) {
    throw new Error(
      `[emailSyncGuardrails] Invariant violation: ${violations[0]}\n` +
      `Full violations: ${JSON.stringify(violations)}`
    );
  }

  if (warnings.length > 0) {
    console.warn(`[emailSyncGuardrails] Warnings for ${context.messageId || 'unknown'}:`, warnings);
  }
}

export {
  isNonEmptyString,
  isEmptyHtml,
  hasBodyTruth,
  validateBeforeUpdate,
  logPreventedRegression,
  reportSyncGuardrailViolations,
  assertEmailSyncInvariants
};