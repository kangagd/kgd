import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

/**
 * Safe numeric input with validation and duplicate detection
 */
export default function SafeNumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  required = false,
  placeholder = "Enter number",
  helperText = "",
  className = "",
  onValidate = null, // Optional async validation function
  validateOnBlur = true
}) {
  const [localValue, setLocalValue] = useState(value || "");
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  const handleValidation = async (val) => {
    if (!val) {
      setError("");
      setIsValid(false);
      return true;
    }

    const numVal = parseFloat(val);
    
    // Basic validation
    if (isNaN(numVal)) {
      setError("Please enter a valid number");
      setIsValid(false);
      return false;
    }
    
    if (numVal < min) {
      setError(`Minimum value is ${min}`);
      setIsValid(false);
      return false;
    }
    
    if (numVal > max) {
      setError(`Maximum value is ${max}`);
      setIsValid(false);
      return false;
    }

    // Custom async validation (e.g., duplicate check)
    if (onValidate) {
      setIsValidating(true);
      try {
        const validationResult = await onValidate(numVal);
        if (!validationResult.valid) {
          setError(validationResult.error || "Validation failed");
          setIsValid(false);
          setIsValidating(false);
          return false;
        }
      } catch (error) {
        setError("Validation failed");
        setIsValid(false);
        setIsValidating(false);
        return false;
      }
      setIsValidating(false);
    }

    setError("");
    setIsValid(true);
    return true;
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    setError("");
    setIsValid(false);
  };

  const handleBlur = async () => {
    if (validateOnBlur) {
      const valid = await handleValidation(localValue);
      if (valid && onChange) {
        onChange(localValue ? parseFloat(localValue) : null);
      }
    } else {
      if (onChange) {
        onChange(localValue ? parseFloat(localValue) : null);
      }
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <Input
          type="number"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          min={min}
          max={max}
          step={step}
          required={required}
          placeholder={placeholder}
          className={`pr-10 ${error ? 'border-red-500 focus:border-red-500' : isValid ? 'border-green-500' : ''}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isValidating && <Loader2 className="w-4 h-4 text-[#6B7280] animate-spin" />}
          {!isValidating && error && <AlertTriangle className="w-4 h-4 text-red-500" />}
          {!isValidating && !error && isValid && <CheckCircle className="w-4 h-4 text-green-500" />}
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-1 text-[12px] text-red-600">
          <AlertTriangle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
      {!error && helperText && (
        <div className="text-[12px] text-[#6B7280]">{helperText}</div>
      )}
    </div>
  );
}