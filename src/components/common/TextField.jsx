import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function TextField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  helperText,
  error,
  type = 'text',
  multiline = false,
  rows = 4,
  disabled = false,
  required = false,
  className = '',
  ...props
}) {
  const Component = multiline ? Textarea : Input;

  return (
    <div className={`text-field-container ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563]">
            {label}
            {required && <span className="text-[#DC2626] ml-0.5">*</span>}
          </label>
          {helperText && !error && (
            <span className="text-[12px] md:text-[13px] text-[#6B7280]">
              {helperText}
            </span>
          )}
        </div>
      )}
      
      <Component
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={multiline ? rows : undefined}
        className={`${error ? 'input-error' : ''}`}
        {...props}
      />
      
      {error && (
        <span className="error-message">{error}</span>
      )}
    </div>
  );
}