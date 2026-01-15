import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, FileText } from "lucide-react";

/**
 * GlobalContractSearch (schema-aware)
 *
 * Contract schema fields:
 * - name (required)
 * - organisation_id (required)
 * - contract_type
 * - start_date, end_date
 * - sla_response_time_hours
 * - service_coverage
 * - billing_model
 * - status (Active | On-Hold | Expired)
 * - notes
 *
 * Props:
 * - contracts: array of contract entities
 * - organisations: optional array of org entities so we can show org name and search it
 * - value: selected contract_id
 * - onChange: (item|null) => void
 *
 * Returned item:
 * {
 *   type: "contract",
 *   id: string,
 *   name: string,
 *   subLabel: string,
 *   status: string,
 *   raw: contract,
 *   searchText: string
 * }
 */
export default function GlobalContractSearch({
  contracts = [],
  organisations = [],

  value = "",
  onChange,

  placeholder = "Search contracts…",
  disabled = false,
  loading = false,
  minChars = 0,
  maxResults = 50,

  className = "",
  dropdownClassName = "",

  emptyText = "No matches",
}) {
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const wrapperRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const orgNameById = useMemo(() => {
    const map = new Map();
    (organisations || []).forEach((o) => {
      if (o?.id != null) map.set(String(o.id), o?.name || o?.organisation_name || "");
    });
    return map;
  }, [organisations]);

  const selectedItem = useMemo(() => {
    const v = value ? String(value) : "";
    if (!v) return null;
    const all = buildContractItems({ contracts, orgNameById });
    return all.find((x) => x.id === v) || null;
  }, [value, contracts, orgNameById]);

  // Keep input showing selected label when closed
  useEffect(() => {
    if (!open && selectedItem) setQuery(selectedItem.name);
    if (!open && !selectedItem && value === "" && query) setQuery("");
  }, [open, selectedItem?.id]);

  const items = useMemo(() => {
    const all = buildContractItems({ contracts, orgNameById });
    const q = query.trim().toLowerCase();

    if (q.length < minChars) {
      return all.slice(0, Math.min(all.length, maxResults));
    }

    return all
      .map((it) => ({ it, score: scoreMatch(q, it.searchText) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name))
      .slice(0, maxResults)
      .map((x) => x.it);
  }, [contracts, orgNameById, query, minChars, maxResults]);

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

  // Keep active row visible when navigating
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
        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          ref={inputRef}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-9 pr-10"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            if (value) onChange?.(null); // typing clears selection
          }}
          onKeyDown={onKeyDown}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="global-contract-dropdown"
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
          id="global-contract-dropdown"
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
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitSelection(item)}
                    className={cn(
                      "w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-slate-50",
                      active && "bg-slate-100"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>

                        <Badge
                          variant="secondary"
                          className={cn(
                            "shrink-0",
                            item.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : item.status === "On-Hold"
                              ? "bg-amber-100 text-amber-800"
                              : item.status === "Expired"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {item.status || "Contract"}
                        </Badge>
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

function buildContractItems({ contracts, orgNameById }) {
  return (contracts || [])
    .filter((c) => !c?.deleted_at) // safe, even if field doesn't exist
    .map((c) => {
      const id = c?.id != null ? String(c.id) : "";
      const name = String(c?.name || "").trim();

      const orgId = c?.organisation_id != null ? String(c.organisation_id) : "";
      const orgName = (orgId && orgNameById?.get?.(orgId)) || "";

      const status = c?.status || "Active";
      const type = c?.contract_type || "";
      const billing = c?.billing_model || "";
      const sla = c?.sla_response_time_hours != null ? `${c.sla_response_time_hours}h SLA` : "";
      const start = c?.start_date || "";
      const end = c?.end_date || "";
      const range = start || end ? `${start || "?"} → ${end || "?"}` : "";

      const subBits = [orgName, type, billing, range, sla].filter(Boolean);
      const subLabel = subBits.join(" • ");

      // Search fields (schema-based, no noise)
      const searchFields = [
        name,
        orgName,
        orgId,
        status,
        type,
        billing,
        c?.service_coverage || "",
        c?.notes || "",
        start,
        end,
        c?.sla_response_time_hours != null ? String(c.sla_response_time_hours) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return {
        type: "contract",
        id,
        name,
        status,
        subLabel,
        raw: c,
        searchText: searchFields,
      };
    })
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

  // loose sequential char match
  let qi = 0;
  for (let i = 0; i < hay.length && qi < q.length; i++) {
    if (hay[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 30;

  return 0;
}