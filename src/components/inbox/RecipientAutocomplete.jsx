import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * RecipientAutocomplete - Chip input with customer email suggestions
 */
export default function RecipientAutocomplete({
  chips = [],
  onChipsChange,
  customers = [],
  placeholder = "Add recipients...",
  label = "To",
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Filter suggestions as user types
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }

    const query = input.toLowerCase();
    const filtered = customers.filter(
      (c) =>
        (c.email?.toLowerCase().includes(query) ||
          c.name?.toLowerCase().includes(query)) &&
        !chips.includes(c.email) // Don't suggest already-added
    );
    setSuggestions(filtered.slice(0, 5)); // Limit to 5
  }, [input, customers, chips]);

  // Close suggestions on blur/click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addChip = (email) => {
    if (email && !chips.includes(email)) {
      onChipsChange([...chips, email]);
      setInput("");
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const removeChip = (email) => {
    onChipsChange(chips.filter((e) => e !== email));
  };

  const handleKeyDown = (e) => {
    if ([",", ";", "Enter"].includes(e.key)) {
      e.preventDefault();
      const email = input.trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        addChip(email);
      }
    }
  };

  const handleBlur = () => {
    const email = input.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addChip(email);
    }
  };

  return (
    <div ref={containerRef} className="space-y-1.5">
      {label && (
        <label className="text-[13px] font-semibold text-[#4B5563] block">
          {label}
        </label>
      )}

      {/* Chips + Input Container */}
      <div className="relative flex flex-wrap gap-1 p-2 bg-white border border-[#E5E7EB] rounded-lg min-h-[40px]">
        {chips.map((email) => (
          <Badge key={email} variant="secondary" className="flex items-center gap-1">
            {email}
            <button
              onClick={() => removeChip(email)}
              className="ml-1 hover:text-red-600"
              aria-label={`Remove ${email}`}
            >
              ×
            </button>
          </Badge>
        ))}

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={() => input && setShowSuggestions(true)}
          placeholder={placeholder}
          className="flex-1 outline-none text-[14px] min-w-[100px] bg-transparent"
          autoComplete="off"
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-2 right-2 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto">
            {suggestions.map((customer) => (
              <button
                key={customer.id}
                onClick={() => addChip(customer.email)}
                className="w-full text-left px-3 py-2.5 hover:bg-[#FAE008]/10 transition-colors text-[13px] border-b border-[#E5E7EB] last:border-b-0"
              >
                <div className="font-medium text-[#111827]">{customer.name}</div>
                <div className="text-[11px] text-[#6B7280]">{customer.email}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}