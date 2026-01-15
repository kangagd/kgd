import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X } from "lucide-react";

/**
 * GlobalCustomerOrgSearch
 *
 * Drop-in reusable searchable dropdown for Customers and/or Organisations.
 * - Text box search (debounced)
 * - Pre-populated matching results shown in dropdown
 * - Mouse + keyboard selection (↑ ↓ Enter Esc)
 * - Scrollable results list
 *
 * Usage:
 *  <GlobalCustomerOrgSearch
 *    mode="customers" // "orgs" | "both"
 *    customers={customers} // array
 *    orgs={orgs} // array (optional)
 *    value={selectedId} // string
 *    onChange={(item) => { ... }} // item includes { id, name, type, raw }
 *    placeholder="Search customer..."
 *  />
 *
 * Notes:
 * - IDs are normalized to strings.
 * - Provide getLabel/getSubLabel to customize display if needed.
 */
export default function GlobalCustomerOrgSearch({
  mode = "customers", // "customers" | "orgs" | "both"
  customers = [],
  orgs = [],
  value = "",
  onChange,
  placeholder = "Search…",
  disabled = false,
  loading = false,
  minChars = 0,
  maxResults = 50,
  className = "",
  dropdownClassName = "",
  getLabel,
  getSubLabel,
  getTokens,
  emptyText = "No matches",
  showTypeBadge = true,
}) {
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const wrapperRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Normalized selected value display
  const selectedItem = useMemo(() => {
    const v = value ? String(value) : "";
    if (!v) return null;

    const all = buildItems({ mode, customers, orgs, getLabel, getSubLabel, getTokens });
    return all.find((x) => x.id === v) || null;
  }, [value, mode, customers, orgs, getLabel, getSubLabel, getTokens]);

  // Keep input showing selected label when not actively typing
  useEffect(() => {
    if (!open && selectedItem) {
      setQuery(selectedItem.name);
    }
    if (!open && !selectedItem && query && value === "") {
      // if cleared externally
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedItem?.id]);

  // Build + filter items
  const items = useMemo(() => {
    const all = buildItems({ mode, customers, orgs, getLabel, getSubLabel, getTokens });

    const q = query.trim().toLowerCase();
    if (q.length < minChars) {
      return all.slice(0, Math.min(all.length, maxResults));
    }

    const scored = all
      .map((it) => ({
        it,
        score: scoreMatch(q, it.searchText),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name))
      .slice(0, maxResults)
      .map((x) => x.it);

    return scored;
  }, [mode, customers, orgs, query, minChars, maxResults, getLabel, getSubLabel, getTokens]);

  // Reset activeIndex when items change/open
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // Ensure active item is visible when navigating with keyboard
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
  };

  const clearSelection = () => {
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    onChange?.(null);
    // keep focus
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

            // If user manually edits away from selected value, we consider it "no longer selected"
            if (value) onChange?.(null);
          }}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="global-search-dropdown"
          role="combobox"
        />

        {(loading || disabled) && (
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
          id="global-search-dropdown"
          className={cn(
            "absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg",
            dropdownClassName
          )}
        >
          <div
            ref={listRef}
            className="max-h-64 overflow-auto py-1"
            role="listbox"
            tabIndex={-1}
          >
            {items.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">{emptyText}</div>
            ) : (
              items.map((item, idx) => {
                const active = idx === activeIndex;
                const isSelected = value && String(value) === item.id;
                return (
                  <button
                    key={`${item.type}:${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      // prevents blur before click
                      e.preventDefault();
                    }}
                    onClick={() => commitSelection(item)}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-slate-50",
                      active && "bg-slate-100"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {item.name}
                        </div>
                        {showTypeBadge && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "shrink-0",
                              item.type === "customer"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            )}
                          >
                            {item.type === "customer" ? "Customer" : "Organisation"}
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
            <span>
              Use ↑ ↓ to navigate, Enter to select, Esc to close
            </span>
            <span>{items.length} result{items.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Build normalized items with a consistent interface */
function buildItems({ mode, customers, orgs, getLabel, getSubLabel, getTokens }) {
  const labeler = getLabel || ((x) => x?.name || "");
  const subLabeler =
    getSubLabel ||
    ((x) => {
      // sensible default
      const bits = [];
      if (x?.email) bits.push(x.email);
      if (x?.phone) bits.push(x.phone);
      if (x?.address_full) bits.push(x.address_full);
      if (x?.address) bits.push(x.address);
      return bits.filter(Boolean).join(" • ");
    });

  const tokener =
    getTokens ||
    ((x) => {
      const tokens = [];
      Object.entries(x || {}).forEach(([k, v]) => {
        if (v == null) return;
        if (typeof v === "string" || typeof v === "number") tokens.push(String(v));
      });
      return tokens;
    });

  const out = [];

  if (mode === "customers" || mode === "both") {
    (customers || []).forEach((c) => {
      const name = labeler(c) || "";
      const subLabel = subLabeler(c) || "";
      const tokens = tokener(c);
      out.push({
        type: "customer",
        id: c?.id != null ? String(c.id) : "",
        name,
        subLabel,
        raw: c,
        searchText: [name, subLabel, ...(tokens || [])].join(" ").toLowerCase(),
      });
    });
  }

  if (mode === "orgs" || mode === "both") {
    (orgs || []).forEach((o) => {
      const name = labeler(o) || "";
      const subLabel = subLabeler(o) || "";
      const tokens = tokener(o);
      out.push({
        type: "org",
        id: o?.id != null ? String(o.id) : "",
        name,
        subLabel,
        raw: o,
        searchText: [name, subLabel, ...(tokens || [])].join(" ").toLowerCase(),
      });
    });
  }

  // remove empties + dedupe by type:id
  return out
    .filter((x) => x.id && x.name)
    .filter((x, idx, arr) => arr.findIndex((y) => y.type === x.type && y.id === x.id) === idx);
}

/** Scoring for fuzzy-ish matching */
function scoreMatch(q, hay) {
  if (!q) return 1;
  if (!hay) return 0;

  // exact prefix wins
  if (hay.startsWith(q)) return 100;

  // word boundary matches
  const words = hay.split(/\s+/);
  for (const w of words) {
    if (w.startsWith(q)) return 80;
  }

  // substring
  if (hay.includes(q)) return 60;

  // loose sequential char match
  let qi = 0;
  for (let i = 0; i < hay.length && qi < q.length; i++) {
    if (hay[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 30;

  return 0;
}