import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Briefcase, 
  UserCircle, 
  FolderKanban, 
  Building2, 
  DollarSign,
  Loader2,
  X
} from "lucide-react";

// Custom debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function GlobalSearchDropdown() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Search when debounced term changes
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setResults(null);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const response = await base44.functions.invoke('globalSearch', {
          searchTerm: debouncedSearch,
          filters: {}
        });
        setResults(response.data);
      } catch (error) {
        console.error("Search error:", error);
        setResults(null);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedSearch]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleNavigate = (url) => {
    navigate(url);
    setIsOpen(false);
    setSearchTerm("");
    setResults(null);
  };

  const totalResults = results ? 
    (results.jobs?.length || 0) + 
    (results.customers?.length || 0) + 
    (results.projects?.length || 0) + 
    (results.organisations?.length || 0) +
    (results.priceListItems?.length || 0) : 0;

  return (
    <div ref={dropdownRef} className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
        <Input
          ref={inputRef}
          placeholder="Search jobs, projects, customers..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-9 pr-8 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm("");
              setResults(null);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B7280] hover:text-[#111827]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && searchTerm.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
            </div>
          ) : totalResults === 0 ? (
            <div className="py-8 text-center">
              <Search className="w-8 h-8 mx-auto text-[#E5E7EB] mb-2" />
              <p className="text-sm text-[#6B7280]">No results found</p>
            </div>
          ) : (
            <div className="py-2">
              {/* Jobs */}
              {results?.jobs?.length > 0 && (
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280] uppercase mb-2">
                    <Briefcase className="w-3.5 h-3.5" />
                    Jobs ({results.jobs.length})
                  </div>
                  {results.jobs.slice(0, 5).map(job => (
                    <button
                      key={job.id}
                      onClick={() => handleNavigate(`${createPageUrl("Jobs")}?jobId=${job.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#111827]">#{job.job_number}</span>
                        <Badge variant={job.status === 'Completed' ? 'success' : job.status === 'Scheduled' ? 'primary' : 'default'} className="text-[10px] px-1.5 py-0">
                          {job.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#6B7280] truncate">{job.customer_name} • {job.address_full || job.address}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Projects */}
              {results?.projects?.length > 0 && (
                <div className="px-3 py-2 border-t border-[#E5E7EB]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280] uppercase mb-2">
                    <FolderKanban className="w-3.5 h-3.5" />
                    Projects ({results.projects.length})
                  </div>
                  {results.projects.slice(0, 5).map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleNavigate(`${createPageUrl("Projects")}?projectId=${project.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#111827] truncate">{project.title}</span>
                        <Badge className="text-[10px] px-1.5 py-0">{project.status}</Badge>
                      </div>
                      <p className="text-xs text-[#6B7280] truncate">{project.customer_name}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Customers */}
              {results?.customers?.length > 0 && (
                <div className="px-3 py-2 border-t border-[#E5E7EB]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280] uppercase mb-2">
                    <UserCircle className="w-3.5 h-3.5" />
                    Customers ({results.customers.length})
                  </div>
                  {results.customers.slice(0, 5).map(customer => (
                    <button
                      key={customer.id}
                      onClick={() => handleNavigate(`${createPageUrl("Customers")}?customerId=${customer.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <span className="font-semibold text-sm text-[#111827]">{customer.name}</span>
                      <p className="text-xs text-[#6B7280] truncate">{customer.email || customer.phone}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Organisations */}
              {results?.organisations?.length > 0 && (
                <div className="px-3 py-2 border-t border-[#E5E7EB]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280] uppercase mb-2">
                    <Building2 className="w-3.5 h-3.5" />
                    Organisations ({results.organisations.length})
                  </div>
                  {results.organisations.slice(0, 3).map(org => (
                    <button
                      key={org.id}
                      onClick={() => handleNavigate(`${createPageUrl("Organisations")}?organisationId=${org.id}`)}
                      className="w-full text-left px-3 py-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <span className="font-semibold text-sm text-[#111827]">{org.name}</span>
                      <p className="text-xs text-[#6B7280]">{org.organisation_type}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Price List Items */}
              {results?.priceListItems?.length > 0 && (
                <div className="px-3 py-2 border-t border-[#E5E7EB]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280] uppercase mb-2">
                    <DollarSign className="w-3.5 h-3.5" />
                    Price List ({results.priceListItems.length})
                  </div>
                  {results.priceListItems.slice(0, 3).map(item => (
                    <div
                      key={item.id}
                      className="px-3 py-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-[#111827]">{item.item}</span>
                        <span className="text-sm font-semibold text-[#111827]">${item.price?.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-[#6B7280]">{item.category}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}