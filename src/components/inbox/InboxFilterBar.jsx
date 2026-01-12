import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, History } from 'lucide-react';
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
  onOpenHistorySearch
}) {
  const filters = [
    { id: 'needs-reply', label: 'Needs Reply', value: { inferredState: 'needs_reply' } },
    { id: 'waiting-on-customer', label: 'Waiting on Customer', value: { inferredState: 'waiting_on_customer' } },
    { id: 'pinned', label: 'Pinned', value: { pinned: true } },
    { id: 'linked', label: 'Linked', value: { linked: true } },
    { id: 'unlinked', label: 'Unlinked', value: { linked: false } },
    { id: 'closed', label: 'Closed', value: { status: 'closed' } }
  ];

  const isFilterActive = (filterId) => {
    return Object.values(activeFilters).some(f => f);
  };

  const handleToggleFilter = (filterId, filterValue) => {
    onFilterChange(filterId, filterValue);
  };

  const hasActiveFilters = Object.values(activeFilters).some(f => f);

  return (
    <div className="bg-white border-b border-[#E5E7EB] p-4 space-y-3">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search threads..."
            className="pl-9"
          />
        </div>
        <Button
          onClick={onOpenHistorySearch}
          variant="outline"
          size="icon"
          title="Search Gmail history"
          className="flex-shrink-0"
        >
          <History className="w-4 h-4" />
        </Button>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {filters.map(filter => (
          <Button
            key={filter.id}
            onClick={() => handleToggleFilter(filter.id, filter.value)}
            variant={activeFilters[filter.id] ? 'default' : 'outline'}
            size="sm"
            className={activeFilters[filter.id] ? 'bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]' : ''}
          >
            {filter.label}
          </Button>
        ))}
        {hasActiveFilters && (
          <Button
            onClick={() => onFilterChange('clear', {})}
            variant="ghost"
            size="sm"
            className="text-[#6B7280] hover:text-[#111827]"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}