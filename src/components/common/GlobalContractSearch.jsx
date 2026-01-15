import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X } from "lucide-react";

/**
 * GlobalContractSearch
 *
 * - Does NOT clear selection on every keystroke.
 * - Selection clears only when:
 *   - user hits the X button, OR
 *   - parent changes `value` to empty, OR
 *   - user selects a different item.
 *
 * Optional:
 * - onQueryChange(queryString) lets parent react to typing without clearing selection
 */
export default function GlobalContractSearch({
  contracts = [],
  value = "",
  onChange,
  onQueryChange,
  placeholder = "Search contracts…",
  disabled = false,
  loading = false,
  minChars = 0,
  maxResults = 50,
  className = "",
  dropdownClassName = "",
  getLabel,
  getSubLabel,
  getTokens,
  emptyText = "No contracts found",
}) {
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const wrapperRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Build all items once per prop change
  const allItems = useMemo(() => {
    return buildItems({ contracts, getLabel, getSubLabel, getTokens });
  }, [contracts, getLabel, getSubLabel, getTokens]);

  // Find selected item from `value`
  const selectedItem = useMemo(() => {
    const v = value ? String(value) : "";
    if (!v) return null;
    return allItems.find((x) => x.id === v) || null;
  }, [value, allItems]);

  // When dropdown closes, snap query to selected label (or empty)
  useEffect(() => {
    if (!open) {
      if (selectedItem) setQuery(selectedItem.name);
      else if (!value) setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedItem?.id, value]);

  // If parent clears the value externally, clear the query too (when not open)
  useEffect(() => {
    if (!open && !value && query) setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Filter items based on query
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (q.length < minChars) {
      return allItems.slice(0, Math.min(allItems.length, maxResults));
    }

    return allItems
      .map((it) => ({ it, score: scoreMatch(q, it.searchText) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name))
      .slice(0, maxResults)
      .map((x) => x.it);
  }, [allItems, query, minChars, maxResults]);

  // Reset activeIndex when opening or query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // Ensure active item is visible when navigating
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    const row = el?.querySelector?.(`[data-idx="${activeIndex}"]`);
    if (!el || !row) return;

    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;

    if (rowTop < viewTop) el.scrollTop = rowTop;
    else if (rowBottom > viewBottom) el.scrollTop = rowBottom - el.clientHeight;
  }, [activeIndex, open]);

  const commitSelection = (item) => {
    setQuery(item.name);
    setOpen(false);
    onChange?.(item);
    requestAnimationFrame(() => inputRef.current?.blur?.());
  };

  const clearSelection = () => {
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    onChange?.(null);
    requestAnimationFrame(() => inputRef.current?.focus?.());
  };

  const onKeyDown = (e) => {
    if (disabled) return;

    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }

    if (!open) return;

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) commitSelection(item);
      return;
    }
  };

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          ref={inputRef}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className={cn("pl-9 pr-10")}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            onQueryChange?.(v);
            // ✅ DO NOT clear selection here
          }}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="global-contract-search-dropdown"
          role="combobox"
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          </div>
        )}

        {!loading && !disabled && (query || value) && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100"
            aria-label="Clear"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>

      {open && (
        <div
          id="global-contract-search-dropdown"
          className={cn(
            "absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg",
            dropdownClassName
          )}
        >
          <div ref={listRef} className="max-h-64 overflow-auto py-1" role="listbox" tabIndex={-1}>
            {items.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">{emptyText}</div>
            ) : (
              items.map((item, idx) => {
                const active = idx === activeIndex;
                const isSelected = value && String(value) === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                    onClick={() => commitSelection(item)}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-slate-50",
                      active && "bg-slate-100"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                        {item.statusBadge && (
                          <Badge variant="secondary" className="shrink-0">
                            {item.statusBadge}
                          </Badge>
                        )}
                      </div>
                      {item.subLabel ? (
                        <div className="text-xs text-slate-500 truncate mt-0.5">{item.subLabel}</div>
                      ) : null}
                    </div>

                    {isSelected ? (
                      <Badge className="bg-green-100 text-green-700 shrink-0">Selected</Badge>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Use ↑ ↓ to navigate, Enter to select, Esc to close</span>
            <span>
              {items.length} result{items.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function buildItems({ contracts, getLabel, getSubLabel, getTokens }) {
  const labeler = getLabel || ((c) => c?.name || "");
  const subLabeler =
    getSubLabel ||
    ((c) => {
      const bits = [];
      if (c?.contract_type) bits.push(c.contract_type);
      if (c?.organisation_name) bits.push(c.organisation_name);
      if (c?.start_date) bits.push(`Start: ${c.start_date}`);
      if (c?.end_date) bits.push(`End: ${c.end_date}`);
      return bits.filter(Boolean).join(" • ");
    });

  const tokener =
    getTokens ||
    ((c) => {
      const tokens = [];
      // Include searchable fields
      if (c?.name) tokens.push(c.name);
      if (c?.contract_type) tokens.push(c.contract_type);
      if (c?.status) tokens.push(c.status);
      if (c?.organisation_id) tokens.push(c.organisation_id);
      if (c?.organisation_name) tokens.push(c.organisation_name);
      if (c?.start_date) tokens.push(String(c.start_date));
      if (c?.end_date) tokens.push(String(c.end_date));
      return tokens;
    });

  const out = [];

  (contracts || []).forEach((c) => {
    const name = labeler(c) || "";
    const subLabel = subLabeler(c) || "";
    const tokens = tokener(c);
    out.push({
      id: c?.id != null ? String(c.id) : "",
      name,
      subLabel,
      statusBadge: c?.status || null,
      raw: c,
      searchText: [name, subLabel, ...(tokens || [])].join(" ").toLowerCase(),
    });
  });

  return out
    .filter((x) => x.id && x.name)
    .filter((x, idx, arr) => arr.findIndex((y) => y.id === x.id) === idx);
}

function scoreMatch(q, hay) {
  if (!q) return 1;
  if (!hay) return 0;

  if (hay.startsWith(q)) return 100;

  const words = hay.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(q)) return 80;
  }

  if (hay.includes(q)) return 60;

  let qi = 0;
  for (let i = 0; i < hay.length && qi < q.length; i++) {
    if (hay[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 30;

  return 0;
}