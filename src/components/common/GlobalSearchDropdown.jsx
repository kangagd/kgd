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
  X,
  FileText,
  Wrench,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

// Modal Views
import EntityModal from "@/components/common/EntityModal";
import JobModalView from "@/components/jobs/JobModalView";
import ProjectModalView from "@/components/projects/ProjectModalView";
import CustomerModalView from "@/components/customers/CustomerModalView";
import OrganisationModalView from "@/components/organisations/OrganisationModalView";
// Assuming these exist or using simple cards for now if modal views don't exist
import QuoteCard from "@/components/quotes/QuoteCard";
import ContractDetails from "@/components/contracts/ContractDetails";
// For Parts/PriceList
import PriceListItemForm from "@/components/pricelist/PriceListItemForm"; // Or just view

// Custom debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function GlobalSearchDropdown({ autoFocus = false, onCloseMobile }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [activeChip, setActiveChip] = useState("All");
  const [selectedEntity, setSelectedEntity] = useState(null);
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

  // Focus on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Close on click outside (only for desktop dropdown)
  useEffect(() => {
    if (onCloseMobile) return; // Don't auto close on mobile modal

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCloseMobile]);

  const handleOpenEntity = (entity, type) => {
    setSelectedEntity({ ...entity, entityType: type });
    if (onCloseMobile) {
      // Keep mobile search open or close? 
      // Usually close search to show modal.
      // But here we show modal on top?
      // If we close search, we lose state.
      // Let's just open the entity modal.
    }
  };

  const handleCloseEntity = () => {
    setSelectedEntity(null);
  };

  const handleFullPage = (entity, type) => {
    handleCloseEntity();
    if (onCloseMobile) onCloseMobile();
    setIsOpen(false);

    switch(type) {
      case 'job': navigate(`${createPageUrl("Jobs")}?jobId=${entity.id}`); break;
      case 'project': navigate(`${createPageUrl("Projects")}?projectId=${entity.id}`); break;
      case 'customer': navigate(`${createPageUrl("Customers")}?customerId=${entity.id}`); break;
      case 'organisation': navigate(`${createPageUrl("Organisations")}?organisationId=${entity.id}`); break;
      case 'contract': navigate(`${createPageUrl("Contracts")}?contractId=${entity.id}`); break;
      // Others might not have full pages yet
      default: break;
    }
  };

  // Process Results into Groups
  const processedResults = React.useMemo(() => {
    if (!results) return null;

    const stations = [
      ...(results.organisations || []).map(o => ({...o, _type: 'organisation'})),
      ...(results.contracts || []).map(c => ({...c, _type: 'contract'})),
      ...(results.customers || []).filter(c => c.is_station).map(c => ({...c, _type: 'customer_station'}))
    ];

    const customers = (results.customers || []).filter(c => !c.is_station);
    const parts = [
      ...(results.priceListItems || []).map(p => ({...p, _type: 'pricelist'})),
      ...(results.parts || []).map(p => ({...p, _type: 'part'}))
    ];

    return {
      jobs: results.jobs || [],
      projects: results.projects || [],
      customers,
      stations,
      quotes: results.quotes || [],
      parts
    };
  }, [results]);

  const chips = [
    { label: "All", key: "All" },
    { label: "Projects", key: "projects" },
    { label: "Jobs", key: "jobs" },
    { label: "Customers", key: "customers" },
    { label: "Stations", key: "stations" },
    { label: "Quotes", key: "quotes" },
    { label: "Parts", key: "parts" }
  ];

  const hasResults = processedResults && Object.values(processedResults).some(arr => arr.length > 0);

  const renderResultItem = (item, type, icon, label, subLabel) => (
    <button
      key={item.id}
      onClick={() => handleOpenEntity(item, type)}
      className="w-full text-left px-3 py-2 hover:bg-[#F3F4F6] rounded-lg transition-colors flex items-start gap-3 group"
    >
      <div className="mt-0.5 text-[#9CA3AF] group-hover:text-[#111827] transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[#111827] truncate">{label}</span>
          {item.status && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
              {item.status}
            </Badge>
          )}
        </div>
        <p className="text-xs text-[#6B7280] truncate">{subLabel}</p>
      </div>
    </button>
  );

  return (
    <>
      <div ref={dropdownRef} className={cn("relative flex-1", onCloseMobile ? "w-full" : "max-w-md")}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            ref={inputRef}
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!onCloseMobile) setIsOpen(true);
            }}
            onFocus={() => {
              if (!onCloseMobile) setIsOpen(true);
            }}
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

        {/* Results Area */}
        {(isOpen || onCloseMobile) && searchTerm.length >= 2 && (
          <div className={cn(
            "bg-white z-50 overflow-hidden flex flex-col",
            onCloseMobile ? "mt-4 flex-1" : "absolute top-full left-0 right-0 mt-1 border border-[#E5E7EB] rounded-lg shadow-lg max-h-[70vh]"
          )}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
              </div>
            ) : !hasResults ? (
              <div className="py-8 text-center">
                <Search className="w-8 h-8 mx-auto text-[#E5E7EB] mb-2" />
                <p className="text-sm text-[#6B7280]">No results found</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Chips */}
                <div className="p-2 border-b border-[#E5E7EB] flex gap-2 overflow-x-auto scrollbar-hide">
                  {chips.map(chip => {
                    const count = chip.key === 'All' ? 0 : processedResults[chip.key]?.length || 0;
                    if (chip.key !== 'All' && count === 0) return null;
                    
                    return (
                      <button
                        key={chip.key}
                        onClick={() => setActiveChip(chip.key)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                          activeChip === chip.key 
                            ? "bg-[#111827] text-white" 
                            : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
                        )}
                      >
                        {chip.label}
                        {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="overflow-y-auto flex-1 p-2 space-y-4">
                  {/* Projects */}
                  {(activeChip === 'All' || activeChip === 'projects') && processedResults.projects.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-xs font-semibold text-[#6B7280] uppercase">Projects</div>
                      {processedResults.projects.slice(0, activeChip === 'All' ? 3 : undefined).map(project => 
                        renderResultItem(
                          project, 
                          'project', 
                          <FolderKanban className="w-4 h-4" />, 
                          project.title, 
                          project.customer_name
                        )
                      )}
                    </div>
                  )}

                  {/* Jobs */}
                  {(activeChip === 'All' || activeChip === 'jobs') && processedResults.jobs.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-xs font-semibold text-[#6B7280] uppercase">Jobs</div>
                      {processedResults.jobs.slice(0, activeChip === 'All' ? 3 : undefined).map(job => 
                        renderResultItem(
                          job, 
                          'job', 
                          <Briefcase className="w-4 h-4" />, 
                          `#${job.job_number} ${job.job_type || 'Job'}`, 
                          job.customer_name + (job.address ? ` • ${job.address}` : '')
                        )
                      )}
                    </div>
                  )}

                  {/* Customers */}
                  {(activeChip === 'All' || activeChip === 'customers') && processedResults.customers.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-xs font-semibold text-[#6B7280] uppercase">Customers</div>
                      {processedResults.customers.slice(0, activeChip === 'All' ? 3 : undefined).map(customer => 
                        renderResultItem(
                          customer, 
                          'customer', 
                          <UserCircle className="w-4 h-4" />, 
                          customer.name, 
                          customer.email || customer.phone
                        )
                      )}
                    </div>
                  )}

                  {/* Stations */}
                  {(activeChip === 'All' || activeChip === 'stations') && processedResults.stations.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-xs font-semibold text-[#6B7280] uppercase">Stations</div>
                      {processedResults.stations.slice(0, activeChip === 'All' ? 3 : undefined).map(station => {
                        const isOrg = station._type === 'organisation';
                        const isContract = station._type === 'contract';
                        return renderResultItem(
                          station, 
                          station._type, 
                          isContract ? <FileText className="w-4 h-4" /> : isOrg ? <Building2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />, 
                          station.name, 
                          isContract ? 'Contract' : (station.organisation_type || 'Station')
                        );
                      })}
                    </div>
                  )}

                  {/* Quotes */}
                  {(activeChip === 'All' || activeChip === 'quotes') && processedResults.quotes.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-xs font-semibold text-[#6B7280] uppercase">Quotes</div>
                      {processedResults.quotes.slice(0, activeChip === 'All' ? 3 : undefined).map(quote => 
                        renderResultItem(
                          quote, 
                          'quote', 
                          <FileText className="w-4 h-4" />, 
                          quote.name, 
                          quote.customer_name
                        )
                      )}
                    </div>
                  )}

                  {/* Parts */}
                  {(activeChip === 'All' || activeChip === 'parts') && processedResults.parts.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-xs font-semibold text-[#6B7280] uppercase">Parts</div>
                      {processedResults.parts.slice(0, activeChip === 'All' ? 3 : undefined).map(part => {
                        const isPriceList = part._type === 'pricelist';
                        return renderResultItem(
                          part, 
                          part._type, 
                          <Wrench className="w-4 h-4" />, 
                          isPriceList ? part.item : `Order: ${part.order_reference || 'N/A'}`, 
                          isPriceList ? `$${part.price}` : part.supplier_name
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Previews */}
      {selectedEntity && (
        <EntityModal
          open={!!selectedEntity}
          onClose={handleCloseEntity}
          title={selectedEntity.title || selectedEntity.name || `Job #${selectedEntity.job_number}` || "Details"}
          onOpenFullPage={() => handleFullPage(selectedEntity, selectedEntity.entityType)}
        >
          {selectedEntity.entityType === 'job' && <JobModalView job={selectedEntity} />}
          {selectedEntity.entityType === 'project' && <ProjectModalView project={selectedEntity} />}
          {(selectedEntity.entityType === 'customer' || selectedEntity.entityType === 'customer_station') && <CustomerModalView customer={selectedEntity} />}
          {selectedEntity.entityType === 'organisation' && <OrganisationModalView organisation={selectedEntity} />}
          
          {selectedEntity.entityType === 'quote' && (
            <div className="p-4">
               {/* Simple view for Quote if view doesn't exist, or reuse QuoteCard */}
               <QuoteCard quote={selectedEntity} />
            </div>
          )}
          
          {selectedEntity.entityType === 'contract' && (
            <div className="max-h-[70vh] overflow-y-auto">
              <ContractDetails contract={selectedEntity} isModal />
            </div>
          )}

          {(selectedEntity.entityType === 'pricelist' || selectedEntity.entityType === 'part') && (
             <div className="p-4">
                {/* Simple detail view for part */}
                <div className="grid gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Item</h3>
                    <p>{selectedEntity.item || selectedEntity.product_name || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Description</h3>
                    <p>{selectedEntity.description || selectedEntity.notes || 'N/A'}</p>
                  </div>
                  {selectedEntity.price && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Price</h3>
                      <p>${selectedEntity.price}</p>
                    </div>
                  )}
                </div>
             </div>
          )}
        </EntityModal>
      )}
    </>
  );
}