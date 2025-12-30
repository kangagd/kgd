/**
 * Handle Enter key to navigate to the next field in a form.
 * Add onKeyDownCapture={handleEnterToNextField} to your form element.
 * Add data-nav="true" to each field that should be part of navigation.
 * 
 * @param {KeyboardEvent} e - The keyboard event
 */
export function handleEnterToNextField(e) {
  // Only handle Enter key
  if (e.key !== "Enter") return;
  
  // Allow Shift+Enter (e.g., for line breaks)
  if (e.shiftKey) return;
  
  // Don't navigate in textareas (allow Enter for line breaks)
  if (e.target.tagName === "TEXTAREA") return;
  
  // Don't handle during IME composition
  if (e.isComposing) return;
  
  // Find the closest form
  const form = e.target.closest("form");
  if (!form) return;
  
  // Collect all navigable fields in DOM order
  const navigableFields = Array.from(
    form.querySelectorAll('[data-nav="true"]:not([disabled]):not([aria-disabled="true"])')
  );
  
  if (navigableFields.length === 0) return;
  
  // Find current element index
  const currentIndex = navigableFields.indexOf(e.target);
  if (currentIndex === -1) return;
  
  // Prevent default Enter behavior and stop propagation
  e.preventDefault();
  e.stopPropagation();
  
  // Try to focus next element
  const nextElement = navigableFields[currentIndex + 1];
  
  if (nextElement) {
    // Focus next field
    nextElement.focus();
  } else {
    // No next element - we're at the last field
    // Check if form has an explicit submit button
    const submitButton = form.querySelector('button[type="submit"]');
    
    if (submitButton && form.requestSubmit) {
      form.requestSubmit();
    } else {
      // Dispatch custom event for forms to handle save
      window.dispatchEvent(
        new CustomEvent("FORM_NAV_SAVE_REQUEST", {
          detail: { form, target: e.target }
        })
      );
    }
  }
}