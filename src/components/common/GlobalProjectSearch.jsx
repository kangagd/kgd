import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, FolderKanban } from "lucide-react";

/**
 * GlobalProjectSearch
 *
 * Reusable searchable dropdown for Projects.
 * - Text box search
 * - Pre-populated matching results shown in dropdown
 * - Mouse + keyboard selection (↑ ↓ Enter Esc)
 * - Scrollable results list
 *
 * Usage:
 *  <GlobalProjectSearch
 *    projects={projects}
 *    value={formData.project_id}               // string
 *    onChange={(item) => { ... }}              // item includes { id, name, subLabel, raw }
 *    placeholder="Search project..."
 *  />
 */
export default function GlobalProjectSearch({
  projects = [],
  value = "",
  onChange,
  placeholder = "Search projects…",
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
  showSelectedBadge = true,
}) {
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const wrapperRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedItem = useMemo(() => {
    const v = value ? String(value) : "";
    if (!v) return null;
    const all = buildProjectItems({ projects, getLabel, getSubLabel, getTokens });
    return all.find((x) => x.id === v) || null;
  }, [value, projects, getLabel, getSubLabel, getTokens]);

  // keep input synced with selected item when closed
  useEffect(() => {
    if (!open && selectedItem) setQuery(selectedItem.name);
    if (!open && !selectedItem && value === "") setQuery("");
  }, [open, selectedItem]);

  const items = useMemo(() => {
    const all = buildProjectItems({ projects, getLabel, getSubLabel, getTokens });
    const q = query.trim().toLowerCase();

    if (q.length < minChars) return all.slice(0, Math.min(all.length, maxResults));

    return all
      .map((it) => ({ it, score: scoreMatch(q, it.searchText) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name))
      .slice(0, maxResults)
      .map((x) => x.it);
  }, [projects, query, minChars, maxResults, getLabel, getSubLabel, getTokens]);

  useEffect(() => setActiveIndex(0), [items]);

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  // scroll active item into view
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[activeIndex];
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[activeIndex]) {
        handleSelect(items[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (item) => {
    onChange?.(item);
    setQuery(item.name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.(null);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <Loader2 className="w-4 h-4 text-[#9CA3AF] animate-spin" />
          ) : (
            <FolderKanban className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </div>

        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder={placeholder}
          className="pl-10 pr-10"
          autoComplete="off"
        />

        {(query || value) && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showSelectedBadge && selectedItem && !open && (
        <div className="mt-2">
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 gap-1"
          >
            <FolderKanban className="w-3 h-3" />
            {selectedItem.name}
          </Badge>
        </div>
      )}

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[300px] overflow-auto",
            dropdownClassName
          )}
        >
          {loading ? (
            <div className="p-4 text-center text-[#6B7280] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-[#6B7280]">{emptyText}</div>
          ) : (
            <div ref={listRef}>
              {items.map((item, idx) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 hover:bg-[#F9FAFB] transition-colors border-b border-[#F3F4F6] last:border-b-0",
                    idx === activeIndex && "bg-[#FAE008]/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-[#111827] truncate">
                        {item.name}
                      </div>
                      {item.subLabel && (
                        <div className="text-[12px] text-[#6B7280] truncate">
                          {item.subLabel}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Build project items with search tokens
function buildProjectItems({ projects, getLabel, getSubLabel, getTokens }) {
  return projects.map((p) => {
    const id = String(p.id);
    const name = getLabel ? getLabel(p) : (p.title || p.name || `#${p.project_number}`);
    const subLabel = getSubLabel ? getSubLabel(p) : buildDefaultSubLabel(p);
    const tokens = getTokens ? getTokens(p) : buildDefaultTokens(p);
    const searchText = [name, subLabel, ...tokens].filter(Boolean).join(" ").toLowerCase();

    return { id, name, subLabel, searchText, raw: p };
  });
}

function buildDefaultSubLabel(p) {
  const parts = [];
  if (p.project_number) parts.push(`#${p.project_number}`);
  if (p.customer_name) parts.push(p.customer_name);
  if (p.status) parts.push(p.status);
  return parts.join(" • ");
}

function buildDefaultTokens(p) {
  return [
    p.project_number ? `${p.project_number}` : "",
    p.customer_name || "",
    p.address_suburb || "",
    p.status || "",
  ].filter(Boolean);
}

function scoreMatch(query, text) {
  if (!query) return 1;
  const lowerText = text.toLowerCase();
  if (lowerText.includes(query)) {
    if (lowerText.startsWith(query)) return 100;
    const words = lowerText.split(/\s+/);
    if (words.some((w) => w.startsWith(query))) return 50;
    return 10;
  }
  return 0;
}