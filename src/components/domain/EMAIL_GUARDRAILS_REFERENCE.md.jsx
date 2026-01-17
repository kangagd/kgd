# Email Pipeline Comprehensive Guardrails

## Overview
Complete guardrail layer for: attachments, Wix threading, merge fields, signatures, sent visibility, auto-linking, and inline CIDs.

## Quick Start

**Feature Flags** → `components/domain/emailFeatureFlags.js`
- `EMAIL_DECODE_V2`, `EMAIL_THREADING_V2`, `EMAIL_COMPOSER_V2`, `EMAIL_INLINE_CID_V2`, `EMAIL_SENT_SYNC_V2`, `EMAIL_DEBUG`

**Attachment Decoding** → `functions/shared/emailDecodeGuardrails.js`
- `decodeBase64UrlToBytes()`, `expectAttachmentsFromParts()`, `createAttachmentExtractionError()`

**Wix Classifier** → `functions/shared/emailWixClassifier.js`
- `isWixEnquiry()`, `determineThreadIdentity()`

**Merge Fields** → `functions/shared/emailMergeRenderer.js`
- `renderMergeFields()`, `findUnresolvedTokens()`, `buildEmailMergeContext()`

**Sent Visibility** → `components/inbox/emailSentGuardrails.js`
- `onEmailSent()`, `ensureProjectLink()`

**CID Images** → `components/utils/emailInlineCidGuardrails.js`
- `resolveCidImages()`, `normalizeCid()`, `hasPendingInlineImages()`

**Smoke Tests** → `functions/emailSmokeTests.js`
- Validates: attachments, CID, Wix, merge, signatures, threading

**Repair** → `functions/repairMissingEmailAttachments.js`
- Idempotent backfill for extraction errors

---

## Integration Points

### 1. gmailSyncThreadMessages
- Use `decodeBase64UrlToBytes` for all Gmail decoding
- Track `attachment_extraction_error` if expected > extracted
- Use `determineThreadIdentity` with `EMAIL_THREADING_V2` gate

### 2. UnifiedEmailComposer.handleSend
- Call `renderMergeFields(subject, body, context)` before send
- Check `findUnresolvedTokens(body)` and warn user
- Ensure signature via `buildSignatureHtml` (idempotent marker)
- Call `ensureProjectLink(payload, projectId)` to link project
- After success: `await onEmailSent({ baseThreadId, messageId, projectId, ... })`

### 3. EmailMessageItem
- Use `resolveCidImages(bodyHtml, attachments)` to resolve cid:
- Check `hasPendingInlineImages(bodyHtml)` and show retry
- 6-second timeout for inline image spinner

---

## Regressions Mitigated By Flags

| Issue | Flag | Mitigation |
|-------|------|-----------|
| Decode failure | `EMAIL_DECODE_V2` | OFF = fallback to atob |
| Wix merge | `EMAIL_THREADING_V2` | OFF = allow merge |
| Merge tokens stay raw | `EMAIL_COMPOSER_V2` | OFF = skip render |
| CID not loading | `EMAIL_INLINE_CID_V2` | OFF = skip resolve |
| Sent not visible | `EMAIL_SENT_SYNC_V2` | OFF = async only |