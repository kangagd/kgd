import { useState, useEffect } from 'react';

/**
 * Debounce hook - delays updating the debounced value until after the specified delay
 * Useful for search inputs to avoid triggering expensive filtering on every keystroke
 * @param {*} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 250ms)
 * @returns {*} The debounced value
 */
export function useDebounce(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}