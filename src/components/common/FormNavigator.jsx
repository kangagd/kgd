import React, { useEffect, useRef } from "react";
import { FORM_NAV_SAVE_REQUEST, handleEnterToNextField } from "./formNav";

/**
 * FormNavigator - Wrapper component for forms with Enter-to-navigate behavior
 * 
 * Usage:
 * <FormNavigator onSave={handleSubmit}>
 *   <Input data-nav="true" ... />
 *   <Select data-nav="true" ... />
 *   <Button type="button" onClick={handleSubmit}>Save</Button>
 * </FormNavigator>
 * 
 * Features:
 * - Enter moves to next field with data-nav="true"
 * - Enter on last field triggers onSave
 * - Shift+Enter does nothing special
 * - Textareas keep normal Enter behavior (new line)
 */
export default function FormNavigator({ onSave, children, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    
    const handler = () => onSave?.();
    el.addEventListener(FORM_NAV_SAVE_REQUEST, handler);
    
    return () => el.removeEventListener(FORM_NAV_SAVE_REQUEST, handler);
  }, [onSave]);

  return (
    <div
      ref={ref}
      data-form-root="true"
      className={className}
      onKeyDownCapture={handleEnterToNextField}
    >
      {children}
    </div>
  );
}