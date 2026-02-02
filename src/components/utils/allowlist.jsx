export const ALLOWLIST = {
  INBOX_V2_EMAILS: new Set([
    "admin@kangaroogd.com.au",
    "customersupport@kangaroogd.com.au",
    "avshalom770@gmail.com.au"
  ]),
  PARTS_LOGISTICS_V2_PILOT_EMAILS: new Set([
    "admin@kangaroogd.com.au"
  ]),
};

export function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

// Pull email from common possible keys
export function getUserEmail(user) {
  return (
    user?.email ||
    user?.primary_email ||
    user?.login ||
    user?.profile?.email ||
    ""
  );
}

export function isInboxV2Allowed(user) {
  const email = normEmail(getUserEmail(user));
  return ALLOWLIST.INBOX_V2_EMAILS.has(email);
}