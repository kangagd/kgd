import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
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
  userEmail 
}) {
  const filters = [
    { id: 'assigned-to-me', label: 'Assigned to me', value: { assignedTo: userEmail } },
    { id: 'unassigned', label: 'Unassigned', value: { assignedTo: null } },
    { id: 'needs-reply', label: 'Needs reply', value: { needsReply: true } },
    { id: 'linked-project', label: 'Linked to project', value: { hasProject: true } },
    { id: 'closed', label: 'Closed', value: { status: 'Closed' } }
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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search threads..."
          className="pl-9"
        />
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