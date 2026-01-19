import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Loader2, X, AlertCircle, ChevronDown, CheckSquare, Square } from 'lucide-react';
import GmailHistorySearchResults from './GmailHistorySearchResults';
import GmailHistoryThreadPreview from './GmailHistoryThreadPreview';
import { normalizeGmailHistoryThread } from './gmailHistoryThreadShape';
import { QUERY_CONFIG } from '@/components/api/queryConfig';
import { inboxKeys, projectKeys, jobKeys } from '@/components/api/queryKeys';
import { devLog } from "@/components/utils/devLog";

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Check if search query is valid
function isValidSearchQuery(query) {
  const trimmed = query.trim();
  if (trimmed.length >= 3) return true;
  // Check for Gmail operators
  const hasOperators = /from:|to:|before:|after:|subject:|has:|in:/.test(trimmed);
  return hasOperators;
}

export default function GmailHistorySearchModal({
  open,
  onOpenChange,
  onSelectThread,
  defaultQuery = '',
  defaultLinkTarget = null,
  mode = 'inbox'
}) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [debouncedQuery] = [useDebounce(searchQuery, 500)];
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [pageToken, setPageToken] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [filterNotImported, setFilterNotImported] = useState(true);
  const [filterHasAttachments, setFilterHasAttachments] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [previewLimit] = useState(5);
  const [selectedThreadIds, setSelectedThreadIds] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, failures: [] });

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery(defaultQuery);
      setSelectedThreadId(null);
      setSelectedThread(null);
      setPageToken(null);
      setAllResults([]);
      setHasMore(false);
      setSearchError(null);
      setErrorExpanded(false);
      setSelectedThreadIds([]);
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0, failures: [] });
    }
  }, [open]);

  // Perform search
  const { isLoading: isSearching } = useQuery({
    queryKey: [
      'gmailHistorySearch',
      {
        query: debouncedQuery,
        pageToken,
        notImported: filterNotImported,
        hasAttachments: filterHasAttachments
      }
    ],
    queryFn: async () => {
      if (!isValidSearchQuery(debouncedQuery)) {
        return { threads: [], nextPageToken: null };
      }

      try {
        const response = await base44.functions.invoke('gmailHistoricalSearchThreads', {
          query: debouncedQuery,
          pageToken,
          maxResults: 25,
          filters: {
            notImported: filterNotImported,
            hasAttachments: filterHasAttachments,
            before: null,
            after: null
          }
        });

        // Check for server-side error
        if (response.data.error) {
          const errorDetail = response.data.errorDetail || response.data.error;
          setSearchError({
            message: 'Search failed',
            detail: errorDetail
          });
          return { threads: [], nextPageToken: null };
        }

        if (!response.data.threads) {
          setSearchError({
            message: 'Search failed',
            detail: 'No threads returned'
          });
          return { threads: [], nextPageToken: null };
        }

        // Clear error on successful search
        setSearchError(null);

        const normalized = response.data.threads.map(normalizeGmailHistoryThread);

        // If first page, replace results; otherwise append
        if (!pageToken) {
          setAllResults(normalized);
        } else {
          setAllResults(prev => [...prev, ...normalized]);
        }

        setHasMore(!!response.data.nextPageToken);
        setPageToken(response.data.nextPageToken || null);

        return { threads: normalized, nextPageToken: response.data.nextPageToken };
      } catch (error) {
        devLog('Search error:', error);
        
        // Build error message from Axios/network error
        let errorDetail = 'Unknown error';
        if (error.response) {
          errorDetail = `HTTP ${error.response.status}: ${error.response.data?.error || error.response.statusText || 'Request failed'}`;
        } else if (error.message) {
          errorDetail = error.message;
        }
        
        setSearchError({
          message: 'Search failed',
          detail: errorDetail
        });
        
        return { threads: [], nextPageToken: null };
      }
    },
    enabled: open && isValidSearchQuery(debouncedQuery),
    ...QUERY_CONFIG.reference,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Fetch preview content when a thread is selected
  const { data: previewData, isLoading: isPreviewLoading, error: previewError } = useQuery({
    queryKey: ['gmailHistoryPreview', selectedThread?.gmailThreadId, previewLimit],
    queryFn: async () => {
      const response = await base44.functions.invoke('gmailGetThreadPreviewContent', {
        gmailThreadId: selectedThread.gmailThreadId,
        limit: previewLimit
      });
      return response.data;
    },
    enabled: !!selectedThread?.gmailThreadId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const handleSelectThread = useCallback((thread) => {
    setSelectedThreadId(thread.gmailThreadId);
    setSelectedThread(thread);
    onSelectThread?.(thread);
  }, [onSelectThread]);

  const handleImportSuccess = useCallback(() => {
    // Invalidate relevant caches
    queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });

    if (defaultLinkTarget?.id) {
      if (defaultLinkTarget.type === 'project') {
        queryClient.invalidateQueries({ queryKey: projectKeys.messages(defaultLinkTarget.id) });
      } else if (defaultLinkTarget.type === 'job') {
        queryClient.invalidateQueries({ queryKey: jobKeys.messages(defaultLinkTarget.id) });
      }
    }

    // Optionally close modal
    setTimeout(() => {
      onOpenChange(false);
    }, 1500);
  }, [queryClient, defaultLinkTarget, onOpenChange]);

  const handleToggleThread = useCallback((threadId) => {
    setSelectedThreadIds(prev => {
      if (prev.includes(threadId)) {
        return prev.filter(id => id !== threadId);
      } else {
        return [...prev, threadId];
      }
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    if (selectedThreadIds.length === allResults.length) {
      setSelectedThreadIds([]);
    } else {
      setSelectedThreadIds(allResults.map(t => t.gmailThreadId));
    }
  }, [selectedThreadIds, allResults]);

  const handleBatchImport = useCallback(async () => {
    if (selectedThreadIds.length === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: selectedThreadIds.length, failures: [] });

    const failures = [];
    
    for (let i = 0; i < selectedThreadIds.length; i++) {
      const threadId = selectedThreadIds[i];
      
      try {
        const linkTarget = defaultLinkTarget ? {
          linkedEntityType: defaultLinkTarget.type,
          linkedEntityId: defaultLinkTarget.id,
          linkedEntityNumber: defaultLinkTarget.number,
          linkedEntityTitle: defaultLinkTarget.title
        } : null;

        await base44.functions.invoke('importGmailThread', {
          gmailThreadId: threadId,
          linkTarget
        });

        setImportProgress(prev => ({ ...prev, current: i + 1 }));
      } catch (error) {
        devLog('Failed to import thread:', threadId, error);
        failures.push({ threadId, error: error.message || 'Unknown error' });
        setImportProgress(prev => ({ ...prev, current: i + 1, failures }));
      }
    }

    setIsImporting(false);

    // Show results
    const successCount = selectedThreadIds.length - failures.length;
    if (failures.length === 0) {
      toast.success(`Successfully imported ${successCount} thread${successCount !== 1 ? 's' : ''}`);
    } else if (successCount > 0) {
      toast.warning(`Imported ${successCount} of ${selectedThreadIds.length} threads (${failures.length} failed)`);
    } else {
      toast.error(`Failed to import all threads`);
    }

    // Invalidate caches
    handleImportSuccess();

    // Clear selection
    setSelectedThreadIds([]);
  }, [selectedThreadIds, defaultLinkTarget, handleImportSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] p-0 gap-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="border-b border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">Search Gmail History</DialogTitle>
              <p className="text-xs text-gray-500 mt-1">
                Find and import archived emails not in your initial sync
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        {/* Search Controls */}
        <div className="border-b border-gray-200 p-4 space-y-3 flex-shrink-0">
          {/* Query Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by subject, from, to, etc. (supports Gmail operators)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters & Actions */}
          <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterNotImported}
                  onChange={(e) => setFilterNotImported(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <span>Not imported</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterHasAttachments}
                  onChange={(e) => setFilterHasAttachments(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <span>Has attachments</span>
              </label>
            </div>

            {/* Batch Actions */}
            {selectedThreadIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  {selectedThreadIds.length} selected
                </span>
                <Button
                  onClick={handleBatchImport}
                  disabled={isImporting}
                  size="sm"
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      {importProgress.current}/{importProgress.total}
                    </>
                  ) : (
                    `Import ${selectedThreadIds.length} Thread${selectedThreadIds.length !== 1 ? 's' : ''}`
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Help text */}
          {!isValidSearchQuery(debouncedQuery) && (
            <p className="text-xs text-gray-500">
              Enter at least 3 characters or use Gmail operators: from:, to:, subject:, before:, after:, has:, in:
            </p>
          )}

          {/* Error Block */}
          {searchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <button
                onClick={() => setErrorExpanded(!errorExpanded)}
                className="flex items-center gap-2 w-full text-left hover:opacity-75 transition-opacity"
              >
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span className="font-medium text-red-900 flex-1">{searchError.message}</span>
                <ChevronDown className={`w-4 h-4 text-red-600 flex-shrink-0 transition-transform ${errorExpanded ? 'rotate-180' : ''}`} />
              </button>
              {errorExpanded && (
                <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800 font-mono overflow-auto max-h-24 border border-red-200">
                  {searchError.detail}
                </div>
              )}
            </div>
          )}
          </div>

        {/* Content: Results + Preview */}
        <div className="flex-1 min-h-0 flex gap-0 overflow-hidden">
          {/* Results List */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 overflow-hidden flex flex-col">
            {/* Select All Header */}
            {allResults.length > 0 && (
              <div className="border-b border-gray-200 p-3 flex items-center gap-2 bg-gray-50">
                <button
                  onClick={handleToggleAll}
                  className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                  disabled={isImporting}
                >
                  {selectedThreadIds.length === allResults.length ? (
                    <CheckSquare className="w-4 h-4 text-[#111827]" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-xs font-medium text-gray-600">
                    Select All ({allResults.length})
                  </span>
                </button>
              </div>
            )}
            
            <GmailHistorySearchResults
              threads={allResults}
              selectedThreadId={selectedThreadId}
              onSelectThread={handleSelectThread}
              isLoading={isSearching}
              selectedThreadIds={selectedThreadIds}
              onToggleThread={handleToggleThread}
              isImporting={isImporting}
            />

            {/* Load More Button */}
            {hasMore && !isSearching && (
              <div className="border-t border-gray-200 p-3 flex-shrink-0">
                <Button
                  onClick={() => {
                    // Trigger next page fetch by invoking query manually
                    const nextPageToken = allResults[allResults.length - 1]?.nextPageToken;
                    setPageToken(nextPageToken || null);
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Load more results
                </Button>
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedThread ? (
              <GmailHistoryThreadPreview
                thread={selectedThread}
                previewMessages={previewData?.messages || []}
                loading={isPreviewLoading}
                error={previewData?.error || previewError?.message}
                onBack={() => {
                  setSelectedThreadId(null);
                  setSelectedThread(null);
                }}
                defaultLinkTarget={defaultLinkTarget}
                onImported={handleImportSuccess}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <p className="text-sm text-gray-600">Select a thread to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}