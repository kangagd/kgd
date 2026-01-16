# Safe Extension Strategy: Canonical Display Name Across All Surfaces

**Status:** ✅ Ready for Phase 2 rollout  
**Audit Date:** 2026-01-16  
**Scope:** Expand `User.display_name` canonical usage beyond Jobs to notifications, mentions, activity feeds, team views

---

## CURRENT STATE (Phase 1 - Jobs ✅ COMPLETE)

### Canonical Source Locked In
- **Technician Display:** `User.display_name` via `resolveTechnicianDisplayName()`
- **Scope:** Job modals, job cards, job lists, calendar views
- **Enforcement:** TechnicianAvatar component + utility function
- **Fallback Chain:** `display_name` → `full_name` → `email.split('@')[0]` → `"Unknown"`
- **Status:** Zero email-derived names in Job UI ✅

---

## PHASE 2 CANDIDATES: SAFE EXTENSION AREAS

### ✅ SAFE TO EXTEND IMMEDIATELY

#### 1. **Notifications System**
**File:** `components/notifications/NotificationBell.js`

**Current Pattern:**
- Line 107-118: Renders notification title/body only
- No user display names currently rendered
- No fallback patterns to conflict with

**Safe Extension:**
```javascript
// IF you add "triggered by" or "assigned by" user info:
{notification.triggered_by_user && (
  <span className="text-[13px] font-medium">
    {resolveTechnicianDisplayName(notification.triggered_by_user)}
  </span>
)}
```

**Risk Level:** 🟢 **MINIMAL** — Notification is template-based; no existing user name display to conflict with

**Implementation Plan:**
1. Add optional `triggered_by_user` / `created_by_user` fields to Notification schema
2. Import `resolveTechnicianDisplayName` in NotificationBell
3. Render with canonical resolver only if field exists
4. NO fallback to email; skip render if missing

---

#### 2. **Team/User List Views**
**File:** `pages/Team.js` (inferred from layout)

**Current Pattern:** Unknown (not in context, but likely shows user names)

**Safe Extension:**
- Use `User.display_name` exclusively
- Render `User.full_name` ONLY if `display_name` is empty (data integrity issue)
- Never derive from email

**Risk Level:** 🟢 **MINIMAL** — Team page is admin-only; controlled audience

**Implementation Plan:**
1. Audit `pages/Team.js` for name display
2. Replace any `full_name` or email-derived names with `resolveTechnicianDisplayName()`
3. Add guard: if both missing, show "No name set" not "?" 

---

#### 3. **Email/Message Author Attribution**
**File:** `components/inbox/UnifiedEmailComposer.js`, `components/inbox/EmailMessageView.js`

**Current Pattern:**
- Line 126 (Composer): `selectedMessage.from_name || selectedMessage.from_address`
- This is EXTERNAL (customer/contact), NOT internal team
- Safe to leave as-is (no conflict with internal display_name)

**Safe Extension:** DO NOT CHANGE
- From external contacts: show `from_name` as-is (customer data)
- Only apply canonical resolution to INTERNAL team members (assigned_to, replied_by, etc.)
- Use guard: if internal user, use `display_name`; if external contact, use email/from_name

**Risk Level:** 🟢 **MINIMAL** — Different data source (external vs. internal)

**Implementation Plan:**
1. In email UI, distinguish internal vs. external
2. For internal (team) users: use `resolveTechnicianDisplayName()`
3. For external (customer): show as-is from email metadata
4. Document this in comments to prevent future regressions

---

### 🟡 CONDITIONAL — ASSESS BEFORE EXTENDING

#### 4. **Activity Feeds / Change History**
**File:** `components/projects/ActivityTab.js`, `functions/updateProjectActivity.js`

**Current Pattern:** Unknown (likely stores user email or full_name in log)

**Safe Extension:**
- If storing user ID → fetch User at display time (safe, lazy)
- If storing full_name → audit whether it's cached correctly
- NEVER store email.split('@')[0] in activity log

**Risk Level:** 🟡 **MEDIUM** — Data consistency depends on migration strategy

**Implementation Plan:**
1. Audit activity log schema: what fields are stored?
2. If user email stored → great, resolve at display time
3. If full_name stored → verify it matches User.full_name (data freshness)
4. Add migration: backfill display_name into historical logs (optional, low priority)

---

#### 5. **Mentions / @-tagging System**
**File:** `components/projects/ProjectChat.js`, `components/jobs/JobChat.js`

**Current Pattern:** Unknown (search/suggest users)

**Safe Extension:**
- When suggesting @mentions: show `display_name` in dropdown
- Store email in mention (email is stable, name can change)
- At render time: resolve email → User → display_name

**Risk Level:** 🟡 **MEDIUM** — Requires mention resolution at render time

**Implementation Plan:**
1. Find where @mentions are suggested (query component)
2. Filter users by `display_name` and `email` for search
3. Show dropdown with `display_name` + email fallback
4. Store mention as email (stable reference)
5. At display: wrap in `resolveTechnicianDisplayName()`

---

#### 6. **Assignment / Bulk Actions**
**File:** `pages/Jobs.js`, `pages/Projects.js`

**Current Pattern:**
- Technician multi-select for job assignment
- Likely queries Users and renders names

**Safe Extension:**
- Already partially in place: `getTechnicians()` function (likely returns full User objects)
- Ensure UI uses `resolveTechnicianDisplayName()` for display
- Verify bulk mutation payload stores `email` (not `display_name`) — email is the identity key

**Risk Level:** 🟢 **MINIMAL** — Only display-side change

**Implementation Plan:**
1. Audit multi-select component in Job/Project forms
2. Ensure technician dropdown shows `display_name` via resolver
3. Verify mutation sends `email` array (identity), not names
4. No schema changes needed

---

### 🔴 DO NOT EXTEND YET (REQUIRES REFACTOR)

#### 7. **Invoice / Financial Records**
**File:** `components/invoices/*`

**Current Pattern:** Likely stores names in invoice (for printed records)

**Risk Level:** 🔴 **HIGH** — Financial documents require immutable historical names

**Why Not Now:**
- Invoices are locked historical records
- Changing technician's display_name should NOT retroactively change past invoices
- Requires new fields: `technician_name_at_time_of_invoice`

**Implementation Plan (Future Phase 3):**
1. Add new Invoice schema fields:
   - `technician_name_snapshot` (immutable)
   - `technician_name_at_invoice_date` (display-only)
2. At invoice generation: capture `display_name` snapshot
3. At render: always show snapshot (never resolve live)
4. Migration: backfill snapshots from historical data

---

#### 8. **Quote Documents (PandaDoc Integration)**
**File:** `components/quotes/`, `functions/sendPandaDocQuote.js`

**Current Pattern:** PandaDoc templates likely embed names

**Risk Level:** 🔴 **HIGH** — External document with embedded data

**Why Not Now:**
- PandaDoc = external service with document history
- Changing source name should NOT retroactively change sent documents
- Requires document version management

**Implementation Plan (Future Phase 3):**
1. Audit current PandaDoc payload
2. Add name-snapshot mechanism (like invoices)
3. Store both current `display_name` and `name_at_send_time`
4. Verify PandaDoc API supports name updates

---

## SAFE EXTENSION CHECKLIST

### ✅ Before extending to any new surface:

- [ ] **Data Ownership:** Who owns the name data? (User vs. Entity-specific)
- [ ] **Historicity:** Should name change retroactively update past records? 
  - YES → Safe to extend (use resolver at display time)
  - NO → Requires snapshot/immutable storage
- [ ] **External Dependencies:** Does it integrate with external systems?
  - NO → Safe to extend
  - YES → Assess version/history management
- [ ] **Performance:** Will resolver be called per-row (N+1)?
  - Scale < 100 items/view → Safe
  - Scale > 1000 items/view → Batch-load User objects first
- [ ] **Fallback Behavior:** What happens if User record missing?
  - Current strategy: Return "Unknown" ✅
  - Ensure no silent defaults (e.g., never "No Name")

---

## IMPLEMENTATION GUARDRAILS

### Rule 1: Never Store Computed Names
```javascript
// ❌ BAD: Store derived name
{ technician_display_name: resolveTechnicianDisplayName(user) }

// ✅ GOOD: Store identity; resolve at render
{ technician_email: user.email }
// At display: resolveTechnicianDisplayName(users.find(u => u.email === technician_email))
```

### Rule 2: Batch Load User Objects for N+1 Avoidance
```javascript
// ❌ BAD: Call resolver for each row
items.map(item => ({
  ...item,
  techName: resolveTechnicianDisplayName(needsFetchPerItem)
}))

// ✅ GOOD: Fetch all users first, then resolve
const usersByEmail = new Map(users.map(u => [u.email, u]));
items.map(item => ({
  ...item,
  techName: resolveTechnicianDisplayName(usersByEmail.get(item.technician_email))
}))
```

### Rule 3: Distinguish Internal vs. External
```javascript
// ❌ BAD: Same resolver for team + external contacts
from_name: resolveTechnicianDisplayName(senderFromEmail)

// ✅ GOOD: Separate paths
from_name: isTeamMember(email) 
  ? resolveTechnicianDisplayName(teamUser)
  : externalEmailData.from_name
```

### Rule 4: Skip Render on Missing Data
```javascript
// ❌ BAD: Render "?" or placeholder
{displayName || "Unknown User"}

// ✅ GOOD: Skip render if missing
{displayName && <span>{displayName}</span>}
```

---

## ROLLOUT PHASES

### Phase 1: Jobs ✅ COMPLETE
- **Scope:** Job modals, lists, calendar
- **Status:** Zero violations, all tests passing
- **Acceptance:** All 6 tests pass

### Phase 2: Safe Extensions 🟢 READY
- **Scope:** Notifications, Team, Email attribution, Assignments
- **Timeline:** 1-2 sprints
- **Effort:** Low (display-only changes)
- **Risk:** Minimal (no schema changes)

**Candidates:**
- Notification "triggered by" or "assigned by" user
- Team member list names
- Email internal attribution (vs. external from_name)
- Job/Project assignment multi-select names

### Phase 3: Refactored Extensions 🔴 FUTURE
- **Scope:** Invoices, Quotes, PandaDoc
- **Timeline:** 2-3 sprints after Phase 2
- **Effort:** Medium (snapshot/version management)
- **Risk:** Medium (financial data immutability)

**Requires:**
- Invoice schema updates
- Historical snapshot backfill
- PandaDoc integration review

---

## TESTING STRATEGY FOR PHASE 2

### Smoke Tests (Per Surface)
```javascript
// 1. User with display_name set
  - Show correct name everywhere
  - No email-derived fallback
  
// 2. User with only full_name
  - Show full_name as fallback (data issue indicator)
  
// 3. User missing both
  - Skip render (no "?" or "Unknown")
```

### Regression Tests
```javascript
// 1. Bulk rename display_name
  - All affected surfaces update (no stale cache)
  
// 2. Switch technicians on job
  - Name updates immediately
  
// 3. Delete user record
  - Graceful fallback, no crash
```

### Performance Tests
```javascript
// 1. Batch size < 100
  - < 100ms render time
  
// 2. Batch size > 1000
  - Verify no N+1 queries
  - Pre-load User objects
```

---

## SUMMARY

**✅ Safe to extend immediately:**
- Notifications (if user field added)
- Team/User list views
- Email internal attribution (vs. external)
- Assignment selectors (already mostly compliant)

**🟡 Assess before extending:**
- Activity feeds (depends on current schema)
- Mentions system (requires render-time resolution)

**🔴 Defer to Phase 3:**
- Invoices (requires snapshot/immutability)
- Quotes & PandaDoc (requires document versioning)

**Key Success Factor:** Always resolve at display time; never store computed display names.