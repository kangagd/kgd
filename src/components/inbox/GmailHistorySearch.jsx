import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Loader2, CheckCircle, Link as LinkIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function GmailHistorySearch({ open, onClose, projectId = null, onThreadSynced }) {
  const [email, setEmail] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [syncingThreadId, setSyncingThreadId] = useState(null);
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSearching(true);
    try {
      const response = await base44.functions.invoke('searchGmailHistory', { 
        sender: email.trim(),
        maxResults: 50
      });

      if (response.data?.threads) {
        // B4: Enrich results with separate sync/link status
        const enrichedThreads = await Promise.all(
          response.data.threads.map(async (gmailThread) => {
            try {
              // Check if EmailThread exists for this gmail_thread_id
              const existing = await base44.entities.EmailThread.filter({
                gmail_thread_id: gmailThread.gmail_thread_id
              });

              const emailThread = existing.length > 0 ? existing[0] : null;
              
              return {
                ...gmailThread,
                // B4: "Synced" = EmailThread exists
                is_synced: !!emailThread,
                synced_id: emailThread?.id,
                // B4: "Linked" = project_id is set (non-null, non-empty)
                is_linked: !!emailThread?.project_id
              };
            } catch (err) {
              console.error('Failed to check thread status:', err);
              return { ...gmailThread, is_synced: false, is_linked: false };
            }
          })
        );

        setResults(enrichedThreads);
        if (enrichedThreads.length === 0) {
          toast.info("No emails found for this address");
        }
      }
    } catch (error) {
      toast.error("Search failed: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSyncThread = async (thread) => {
    setSyncingThreadId(thread.gmail_thread_id);
    try {
      const response = await base44.functions.invoke('syncSpecificGmailThread', {
        gmail_thread_id: thread.gmail_thread_id,
        project_id: projectId
      });

      if (response.data?.thread_id) {
        const threadId = response.data.thread_id;
        
        if (projectId) {
          toast.success("Email synced and linked to project");
        } else {
          toast.success("Email synced successfully");
        }
        
        // B4: Update the result to show it's synced; linked only if projectId was provided
        setResults(prev => prev.map(t => 
          t.gmail_thread_id === thread.gmail_thread_id 
            ? { ...t, is_synced: true, synced_id: threadId, is_linked: !!projectId }
            : t
        ));
        
        // Automatically open the thread
        if (onThreadSynced) {
          onThreadSynced(threadId);
        }
      }
    } catch (error) {
      toast.error("Sync failed: " + error.message);
    } finally {
      setSyncingThreadId(null);
    }
  };

  const handleViewThread = (thread) => {
    if (thread.synced_id) {
      if (onThreadSynced) {
        onThreadSynced(thread.synced_id);
      } else {
        navigate(`?threadId=${thread.synced_id}`);
        onClose();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Gmail History</DialogTitle>
          <p className="text-sm text-gray-500">Search through all emails (including those not yet synced)</p>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Enter email address to search..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button 
            onClick={handleSearch}
            disabled={isSearching}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 space-y-2">
          {results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Enter an email address to search Gmail history</p>
            </div>
          ) : (
            results.map((thread, idx) => (
              <div 
                key={idx}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-medium text-sm truncate">{thread.subject}</h3>
                      {thread.is_synced && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Synced
                        </Badge>
                      )}
                      {thread.is_synced && thread.is_linked && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          Linked
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mb-1">From: {thread.from}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{thread.snippet}</p>
                    {thread.date && (
                      <p className="text-xs text-gray-400 mt-1">
                        {(() => {
                          try {
                            return format(new Date(thread.date), 'MMM d, yyyy h:mm a');
                          } catch {
                            return thread.date;
                          }
                        })()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {thread.is_synced ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewThread(thread)}
                        className="h-8"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        View
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSyncThread(thread)}
                        disabled={syncingThreadId === thread.gmail_thread_id}
                        className="h-8 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                      >
                        {syncingThreadId === thread.gmail_thread_id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <LinkIcon className="w-3.5 h-3.5 mr-1" />
                            Sync & Link
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}