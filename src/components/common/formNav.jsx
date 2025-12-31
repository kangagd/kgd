/**
 * Global Form Navigation Utilities
 * Handles Enter-to-navigate-next-field behavior across all forms
 */

export const FORM_NAV_SAVE_REQUEST = "FORM_NAV_SAVE_REQUEST";

/**
 * Dispatches a custom event requesting the form to save
 */
export function requestFormSave(formEl) {
  if (!formEl) return;
  formEl.dispatchEvent(new CustomEvent(FORM_NAV_SAVE_REQUEST, { bubbles: true }));
}

/**
 * Gets all navigable fields within a form
 * Only includes visible, enabled, non-readonly elements with data-nav attribute
 */
export function getNavigableFields(formEl) {
  if (!formEl) return [];
  
  const selectors = [
    '[data-nav="true"]',
    'input[data-nav]',
    'select[data-nav]',
    'textarea[data-nav]',
    'button[data-nav]',
    '[role="combobox"][data-nav="true"]'
  ];
  
  const all = Array.from(formEl.querySelectorAll(selectors.join(",")));

  // Filter: visible + enabled + not readonly
  return all.filter(el => {
    const isDisabled = el.disabled || el.getAttribute("aria-disabled") === "true";
    const isHidden = el.offsetParent === null;
    const isReadonly = el.readOnly === true;
    return !isDisabled && !isHidden && !isReadonly;
  });
}

/**
 * Focuses the next navigable field after the current element
 * Returns { isLast: true } if current field is the last navigable field
 */
export function focusNextField(formEl, currentEl) {
  const fields = getNavigableFields(formEl);
  const idx = fields.indexOf(currentEl);
  
  if (idx === -1) return { isLast: false };
  
  const next = fields[idx + 1];
  if (!next) return { isLast: true };
  
  next.focus?.();
  // If input-like, select text for faster workflow
  if (typeof next.select === "function") next.select();
  
  return { isLast: false };
}

/**
 * Keydown handler for Enter navigation
 * Moves to next field on Enter, or triggers save if on last field
 */
export function handleEnterToNextField(e) {
  // Only handle Enter (no modifiers)
  if (e.key !== "Enter") return;
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

  const target = e.target;
  if (!target) return;

  // Allow normal Enter in textarea
  if (target.tagName?.toLowerCase() === "textarea") return;

  // Only handle if the target is navigable OR inside a navigable wrapper
  const navEl = target.closest?.('[data-nav="true"]') || (target?.dataset?.nav ? target : null);
  if (!navEl) return;

  const formEl = target.closest("form") || target.closest('[data-form-root="true"]');
  if (!formEl) return;

  // Prevent browser submit
  e.preventDefault();
  e.stopPropagation();

  // Move next or save if last
  const { isLast } = focusNextField(formEl, navEl);
  if (isLast) {
    requestFormSave(formEl);
  }
}