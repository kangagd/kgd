import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, X, Save, Star, Trash2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function AdvancedSearch({ onSearchChange, currentFilters }) {
  const [searchText, setSearchText] = useState(currentFilters?.searchText || "");
  const [sender, setSender] = useState(currentFilters?.sender || "");
  const [recipient, setRecipient] = useState(currentFilters?.recipient || "");
  const [dateFrom, setDateFrom] = useState(currentFilters?.dateFrom || "");
  const [dateTo, setDateTo] = useState(currentFilters?.dateTo || "");
  const [hasAttachment, setHasAttachment] = useState(currentFilters?.hasAttachment || false);
  const [attachmentName, setAttachmentName] = useState(currentFilters?.attachmentName || "");
  const [searchInBody, setSearchInBody] = useState(currentFilters?.searchInBody !== false);
  const [statusFilter, setStatusFilter] = useState(currentFilters?.statusFilter || "all");
  const [isOpen, setIsOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [isSearchingGmail, setIsSearchingGmail] = useState(false);

  useEffect(() => {
    loadSavedSearches();
  }, []);

  const loadSavedSearches = async () => {
    try {
      const user = await base44.auth.me();
      const searches = JSON.parse(localStorage.getItem(`saved_searches_${user.email}`) || "[]");
      setSavedSearches(searches);
    } catch (error) {
      console.error("Error loading saved searches:", error);
    }
  };

  const applyFilters = () => {
    onSearchChange({
      searchText,
      sender,
      recipient,
      dateFrom,
      dateTo,
      hasAttachment,
      attachmentName,
      searchInBody,
      statusFilter
    });
    setIsOpen(false);
  };

  const clearFilters = () => {
    setSearchText("");
    setSender("");
    setRecipient("");
    setDateFrom("");
    setDateTo("");
    setHasAttachment(false);
    setAttachmentName("");
    setSearchInBody(true);
    setStatusFilter("all");
    onSearchChange({
      searchText: "",
      sender: "",
      recipient: "",
      dateFrom: "",
      dateTo: "",
      hasAttachment: false,
      attachmentName: "",
      searchInBody: true,
      statusFilter: "all"
    });
  };

  const saveSearch = async () => {
    if (!searchName.trim()) {
      toast.error("Please enter a name for this search");
      return;
    }

    try {
      const user = await base44.auth.me();
      const newSearch = {
        id: Date.now().toString(),
        name: searchName,
        filters: {
          searchText,
          sender,
          recipient,
          dateFrom,
          dateTo,
          hasAttachment,
          attachmentName,
          searchInBody,
          statusFilter
        }
      };

      const searches = [...savedSearches, newSearch];
      localStorage.setItem(`saved_searches_${user.email}`, JSON.stringify(searches));
      setSavedSearches(searches);
      setSearchName("");
      setSaveDialogOpen(false);
      toast.success("Search saved successfully");
    } catch (error) {
      toast.error("Failed to save search");
    }
  };

  const loadSearch = (search) => {
    const { filters } = search;
    setSearchText(filters.searchText || "");
    setSender(filters.sender || "");
    setRecipient(filters.recipient || "");
    setDateFrom(filters.dateFrom || "");
    setDateTo(filters.dateTo || "");
    setHasAttachment(filters.hasAttachment || false);
    setAttachmentName(filters.attachmentName || "");
    setSearchInBody(filters.searchInBody !== false);
    setStatusFilter(filters.statusFilter || "all");
    onSearchChange(filters);
    setIsOpen(false);
  };

  const deleteSearch = async (searchId) => {
    try {
      const user = await base44.auth.me();
      const searches = savedSearches.filter(s => s.id !== searchId);
      localStorage.setItem(`saved_searches_${user.email}`, JSON.stringify(searches));
      setSavedSearches(searches);
      toast.success("Search deleted");
    } catch (error) {
      toast.error("Failed to delete search");
    }
  };

  const activeFiltersCount = [
    searchText,
    sender,
    recipient,
    dateFrom,
    dateTo,
    hasAttachment,
    attachmentName,
    statusFilter !== "all"
  ].filter(Boolean).length;

  const searchGmailHistory = async () => {
    if (!searchText.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setIsSearchingGmail(true);
    try {
      const result = await base44.functions.invoke('searchGmailHistory', {
        query: searchText,
        sender: sender || undefined,
        recipient: recipient || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });

      if (result.data?.error) {
        toast.error(result.data.error);
      } else {
        toast.success(`Found and synced ${result.data?.synced || 0} emails from Gmail`);
        // Trigger parent to refresh thread list
        onSearchChange({ ...currentFilters, searchText });
      }
    } catch (error) {
      toast.error("Failed to search Gmail history");
      console.error(error);
    } finally {
      setIsSearchingGmail(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
        <Input
          placeholder="Search emails (subject, body, sender)..."
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            onSearchChange({
              searchText: e.target.value,
              sender,
              recipient,
              dateFrom,
              dateTo,
              hasAttachment,
              attachmentName,
              searchInBody,
              statusFilter
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              searchGmailHistory();
            }
          }}
          className="pl-10 pr-32"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="h-6 px-2 text-[11px]">
              {activeFiltersCount}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={searchGmailHistory}
            disabled={isSearchingGmail || !searchText.trim()}
            title="Search Gmail history (Ctrl+Enter)"
          >
            {isSearchingGmail ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Filter className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[14px]">Advanced Search</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-7 px-2 text-[12px]"
                  >
                    Clear All
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-[13px]">Sender</Label>
                    <Input
                      placeholder="sender@example.com"
                      value={sender}
                      onChange={(e) => setSender(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[13px]">Recipient</Label>
                    <Input
                      placeholder="recipient@example.com"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[13px]">From Date</Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[13px]">To Date</Label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasAttachment"
                      checked={hasAttachment}
                      onCheckedChange={setHasAttachment}
                    />
                    <Label htmlFor="hasAttachment" className="text-[13px] cursor-pointer">
                      Has attachments
                    </Label>
                  </div>

                  <div>
                    <Label className="text-[13px]">Attachment Name</Label>
                    <Input
                      placeholder="invoice.pdf, contract..."
                      value={attachmentName}
                      onChange={(e) => setAttachmentName(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[13px]">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="searchInBody"
                      checked={searchInBody}
                      onCheckedChange={setSearchInBody}
                    />
                    <Label htmlFor="searchInBody" className="text-[13px] cursor-pointer">
                      Search in email body
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <Button onClick={applyFilters} className="flex-1" size="sm">
                    Apply Filters
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveDialogOpen(true)}
                    disabled={activeFiltersCount === 0}
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                </div>

                {savedSearches.length > 0 && (
                  <div className="pt-3 border-t">
                    <Label className="text-[12px] text-[#6B7280] mb-2 block">Saved Searches</Label>
                    <div className="space-y-1">
                      {savedSearches.map((search) => (
                        <div
                          key={search.id}
                          className="flex items-center justify-between p-2 hover:bg-[#F9FAFB] rounded-lg group"
                        >
                          <button
                            onClick={() => loadSearch(search)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            <Star className="w-3 h-3 text-[#FAE008]" />
                            <span className="text-[13px]">{search.name}</span>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSearch(search.id)}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Save Search Dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-[16px] font-semibold mb-4">Save Search</h3>
            <Input
              placeholder="Enter search name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveSearch()}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <Button onClick={saveSearch} className="flex-1">
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSaveDialogOpen(false);
                  setSearchName("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}