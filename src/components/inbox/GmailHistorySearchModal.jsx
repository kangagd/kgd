import React, { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import GmailHistorySearchResults from './GmailHistorySearchResults';
import GmailHistoryThreadPreview from './GmailHistoryThreadPreview';

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function GmailHistorySearchModal({
  open,
  onOpenChange,
  prefilledQuery = '',
  projectId = null,
  jobId = null
}) {
  const [query, setQuery] = useState(prefilledQuery);
  const [excludeImported, setExcludeImported] = useState(true);
  const [hasAttachments, setHasAttachments] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [pageToken, setPageToken] = useState(null);
  const debouncedQuery = useDebounce(query, 500);

  // Only search if query is long enough or contains operator
  const shouldSearch = useMemo(() => {
    const q = debouncedQuery.trim();
    if (q.length < 3) return false;
    const hasOperator = /\b(from:|to:|subject:|has:|before:|after:|newer_than:|older_than:)/i.test(q);
    return q.length >= 3 || hasOperator;
  }, [debouncedQuery]);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useQuery({
    queryKey: ['gmailHistoricalSearch', debouncedQuery, excludeImported, hasAttachments],
    queryFn: async ({ pageParam = null }) => {
      if (!shouldSearch) return null;

      const response = await base44.functions.invoke('gmailHistoricalSearchThreads', {
        query: debouncedQuery,
        pageToken: pageParam,
        maxResults: 20,
        excludeImported
      });

      if (!response.data.success) {
        throw new Error(response.data.error);
      }

      // Filter by attachments if needed
      let results = response.data.results || [];
      if (hasAttachments) {
        results = results.filter(r => r.hasAttachments);
      }

      return {
        results,
        nextPageToken: response.data.nextPageToken
      };
    },
    enabled: shouldSearch && open,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialPageParam: null
  });

  const handleLoadMore = () => {
    if (data?.nextPageToken && !isFetchingNextPage) {
      fetchNextPage({ pageParam: data.nextPageToken });
    }
  };

  const allResults = useMemo(() => {
    if (!data?.results) return [];
    return data.results;
  }, [data]);

  const resetSearch = () => {
    setQuery('');
    setSelectedThread(null);
    setPageToken(null);
  };

  if (selectedThread) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <GmailHistoryThreadPreview
            thread={selectedThread}
            onBack={() => setSelectedThread(null)}
            projectId={projectId}
            jobId={jobId}
            onImported={() => {
              setSelectedThread(null);
              resetSearch();
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Gmail History</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., from:customer@example.com before:2024-01-01"
                className="pl-10"
              />
            </div>
            <p className="text-xs text-gray-500">
              Supports: from:, to:, subject:, has:attachment, before:, after:, newer_than:, older_than:
            </p>
          </div>

          {/* Filters */}
          <div className="space-y-2 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Checkbox
                id="excludeImported"
                checked={excludeImported}
                onCheckedChange={setExcludeImported}
              />
              <label htmlFor="excludeImported" className="text-sm cursor-pointer">
                Hide already imported threads
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hasAttachments"
                checked={hasAttachments}
                onCheckedChange={setHasAttachments}
              />
              <label htmlFor="hasAttachments" className="text-sm cursor-pointer">
                Only show threads with attachments
              </label>
            </div>
          </div>

          {/* Results */}
          {!shouldSearch && (
            <div className="text-center py-8 text-gray-500">
              Enter a search query (min. 3 characters or use operators) to search Gmail history
            </div>
          )}

          {shouldSearch && isLoading && (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Searching Gmail...</span>
            </div>
          )}

          {shouldSearch && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error.message}</div>
            </div>
          )}

          {shouldSearch && data?.results && allResults.length > 0 && (
            <GmailHistorySearchResults
              results={allResults}
              onSelectThread={setSelectedThread}
            />
          )}

          {shouldSearch && data?.results && allResults.length === 0 && !isLoading && (
            <div className="text-center py-8 text-gray-500">
              No threads found matching your search
            </div>
          )}

          {/* Load More */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleLoadMore}
                disabled={isFetchingNextPage}
                variant="outline"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More Results'
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}