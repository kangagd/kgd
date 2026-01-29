import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { devLog } from "@/components/utils/devLog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function InboxFilterBar({ 
  searchTerm, 
  onSearchChange, 
  activeFilters, 
  onFilterChange,
  userEmail,
  allowedChips = null
}) {
  const allFilters = [
    { id: 'assigned-to-me', label: 'Assigned to Me', value: { assignedToMe: true } },
    { id: 'sent', label: 'Sent', value: { direction: 'sent' } },
    { id: 'received', label: 'Received', value: { direction: 'received' } },
    { id: 'pinned', label: 'Pinned', value: { pinned: true } },
    { id: 'linked', label: 'Linked', value: { linked: true } },
    { id: 'unlinked', label: 'Unlinked', value: { linked: false } },
    { id: 'closed', label: 'Closed', value: { status: 'closed' } }
  ];

  // If allowedChips provided, filter to only those; otherwise use all
  const filters = allowedChips 
    ? allFilters.filter(f => allowedChips.includes(f.id))
    : allFilters;

  const handleToggleFilter = (filterId, filterValue) => {
    // Toggle: if clicking an active filter, deactivate it; otherwise activate it
    if (activeFilters[filterId]) {
      onFilterChange(filterId, false);
    } else {
      // Clear other filters when selecting a new one (single-select)
      onFilterChange('clear', {});
      onFilterChange(filterId, true);
    }
  };

  const hasActiveFilters = Object.values(activeFilters).some(f => f);

  return (
    <div className="bg-white border-b border-[#E5E7EB] px-3 py-2.5 space-y-2">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
           <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
           <Input
             value={searchTerm}
             onChange={(e) => onSearchChange(e.target.value)}
             placeholder="Search threads..."
             className="pl-9 h-8 text-[13px]"
           />
         </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-1.5 text-[12px]">
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => handleToggleFilter(filter.id, filter.value)}
            className={`px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
              activeFilters[filter.id]
                ? 'bg-[#FAE008] text-[#111827] font-medium'
                : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            onClick={() => onFilterChange('clear', {})}
            className="px-2 py-1 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
            title="Clear filters"
          >
            <X className="w-3 h-3 inline" />
          </button>
        )}
      </div>
    </div>
  );
}