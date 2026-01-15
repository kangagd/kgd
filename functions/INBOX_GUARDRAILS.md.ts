# INBOX SYNC GUARDRAILS

## Critical Invariants

All changes to `EmailMessage` records must preserve these invariants:

### 1. **NO BODY REGRESSION**
- ❌ Never overwrite existing non-empty `body_html`/`body_text` with empty values
- ✅ If incoming body is empty but existing has content, preserve existing
- ✅ Use `coalesceBody(existing, incoming)` helper in all upserts

**Why:** Users see "no content" errors when sync overwrites populated bodies.

### 2. **TRUTHFUL has_body**
- ❌ Never set `has_body=false` if it was previously `true`
- ✅ Compute actual state: `has_body = hasBodyTruth(body_html, body_text)`
- ✅ A message "has body" iff body_html OR body_text contains usable text

**Why:** UI relies on has_body as source of truth for displaying message content.

### 3. **CORRECT sync_status**
- `"ok"` = full body extracted, no issues
- `"partial"` = body missing OR parse failed, but existing content preserved
- `"failed"` = parse error AND no previous content AND no current body

**Rule:** Never downgrade status from "ok" to "partial"/"failed" if incoming body is empty.

### 4. **PARSE_ERROR TRACKING**
- ❌ Never set `sync_status != "ok"` without setting `parse_error` to a reason
- ✅ Always clear `parse_error = null` when `sync_status = "ok"`
- ✅ Use concrete reasons: `"body_missing"`, `"parse_failed: <msg>"`, `"body_missing_in_latest_fetch; preserving_previous_body"`

### 5. **last_synced_at CURRENCY**
- ✅ Always set `last_synced_at = new Date().toISOString()` on every update
- Enables tracking sync freshness and debugging stale data

---

## Protected Functions

The following functions implement these guardrails and must not be changed without review:

1. **`gmailSyncThreadMessages`** – Syncs messages from Gmail API
2. **`importSentMessage`** – Imports user-sent messages
3. **`emailSyncGuardrails.js`** – Validation helpers & assertion functions

---

## Implementation Pattern

```javascript
// 1. Find existing message
const existing = await findExistingMessage(gmailMessageId);

// 2. Parse incoming body
const incomingResult = extractBodyFromPayload(gmailMsg.payload);

// 3. Coalesce (preserve non-empty existing)
const mergedBody = coalesceBody(existing, incomingResult);
const finalHasBody = hasBodyTruth(mergedBody.body_html, mergedBody.body_text);

// 4. Determine sync_status (never downgrade from "ok" when incoming empty)
let syncStatus = finalHasBody ? 'ok' : 'partial';
if (existing?.sync_status === 'ok' && !incomingResult.body_html && !incomingResult.body_text) {
  syncStatus = 'ok'; // Preserve ok status if incoming is empty
}

// 5. Save with metadata
await upsertMessage({
  ...message,
  body_html: mergedBody.body_html,
  body_text: mergedBody.body_text,
  has_body: finalHasBody,
  sync_status: syncStatus,
  parse_error: syncStatus === 'ok' ? null : parseReason,
  last_synced_at: new Date().toISOString()
});
```

---

## Guardrail Review Checklist

Before modifying inbox sync logic:

- [ ] Does this touch body_html, body_text, or has_body?
- [ ] Are you calling coalesceBody() or similar preservation?
- [ ] Are you setting sync_status AND parse_error together?
- [ ] Are you setting last_synced_at?
- [ ] Have you tested resync idempotence (same thread twice)?
- [ ] Do you preserve existing content if incoming is empty?

**If unsure, consult this file before proceeding.**