import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Loader2, AlertCircle, CheckCircle, Paperclip } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { normalizeGmailHistoryThread } from './gmailHistoryThreadShape';
import { inboxKeys, projectKeys, jobKeys } from '@/components/api/queryKeys';
import DOMPurify from 'dompurify';

const LinkProjectJobModal = ({ open, onOpenChange, gmailThreadId, onLinked }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [entityType, setEntityType] = useState('project');
  const [isImporting, setIsImporting] = useState(false);

  const { data: allData, isLoading } = useQuery({
    queryKey: ['projectsAndJobs', entityType],
    queryFn: async () => {
      const projects = await base44.entities.Project.list();
      const jobs = await base44.entities.Job.list();
      return { projects, jobs };
    },
    enabled: open
  });

  const filtered = React.useMemo(() => {
    if (!allData) return [];
    const term = searchTerm.toLowerCase();
    if (entityType === 'project') {
      return (allData.projects || []).filter(p =>
        p.title?.toLowerCase().includes(term) ||
        p.project_number?.toString().includes(term)
      );
    } else {
      return (allData.jobs || []).filter(j =>
        j.job_number?.toString().includes(term) ||
        j.customer_name?.toLowerCase().includes(term)
      );
    }
  }, [allData, searchTerm, entityType]);

  const handleSelectEntity = async (entity) => {
    setIsImporting(true);
    try {
      const linkTarget = {
        linkedEntityType: entityType,
        linkedEntityId: entity.id,
        linkedEntityNumber: entityType === 'project' ? entity.project_number : entity.job_number,
        linkedEntityTitle: entityType === 'project' ? entity.title : `#${entity.job_number}`
      };

      const response = await base44.functions.invoke('importGmailThread', {
        gmailThreadId,
        linkTarget
      });

      if (response.data.success) {
        toast.success(`Thread imported and linked to ${entityType}`);
        onLinked?.();
        onOpenChange(false);
      } else {
        toast.error(response.data.error || 'Import failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link to {entityType === 'project' ? 'Project' : 'Job'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entity Type Tabs */}
          <div className="flex gap-2">
            <Button
              onClick={() => setEntityType('project')}
              variant={entityType === 'project' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
            >
              Project
            </Button>
            <Button
              onClick={() => setEntityType('job')}
              variant={entityType === 'job' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
            >
              Job
            </Button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder={`Search ${entityType}s...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />

          {/* Results */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              No {entityType}s found
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filtered.slice(0, 10).map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => handleSelectEntity(entity)}
                  disabled={isImporting}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 border text-sm disabled:opacity-50 transition-colors"
                >
                  <div className="font-medium">
                    {entityType === 'project' ? entity.title : `#${entity.job_number}`}
                  </div>
                  {entityType === 'project' && entity.customer_name && (
                    <div className="text-xs text-gray-500">{entity.customer_name}</div>
                  )}
                  {entityType === 'job' && entity.customer_name && (
                    <div className="text-xs text-gray-500">{entity.customer_name}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function GmailHistoryThreadPreview({
  thread,
  previewMessages = [],
  loading = false,
  error = null,
  onBack,
  defaultLinkTarget,
  onImported
}) {
  const [isImporting, setIsImporting] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [loadingFull, setLoadingFull] = useState(false);
  const queryClient = useQueryClient();

  // Fetch full thread content on demand
  const { data: fullThreadData, isLoading: isLoadingFull } = useQuery({
    queryKey: ['gmailHistoryPreview', thread?.gmailThreadId || thread?.gmail_thread_id, 'full'],
    queryFn: async () => {
      const response = await base44.functions.invoke('gmailGetThreadPreviewContent', {
        gmailThreadId: thread?.gmailThreadId || thread?.gmail_thread_id,
        limit: 50 // Get up to 50 messages
      });
      return response.data;
    },
    enabled: loadingFull && !!(thread?.gmailThreadId || thread?.gmail_thread_id),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Use full messages if loaded, otherwise use preview
  const displayMessages = fullThreadData?.messages && fullThreadData.messages.length > 0
    ? fullThreadData.messages
    : previewMessages;

  // Show empty state if no thread selected
  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600">Select a thread to preview</p>
      </div>
    );
  }

  // Normalize thread to ensure consistent shape
  const normalized = normalizeGmailHistoryThread(thread);

  // Sanitize HTML safely
  const sanitizeHtml = useMemo(() => (html) => {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'a',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel', 'title', 'style'],
      FORCE_BODY: true
    });
  }, []);

  const handleImportOnly = async () => {
    setIsImporting(true);
    try {
      const response = await base44.functions.invoke('importGmailThread', {
        gmailThreadId: normalized.gmailThreadId
      });

      if (response.data.success) {
        toast.success('Thread imported successfully');
        setImportSuccess(true);
        queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });
        queryClient.invalidateQueries({ queryKey: ['gmailHistoricalSearch'] });
        setTimeout(() => onImported?.(), 1000);
      } else {
        toast.error(response.data.error);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportWithLink = async () => {
    setLinkModalOpen(true);
  };

  const handleLinked = () => {
    setImportSuccess(true);
    queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });
    queryClient.invalidateQueries({ queryKey: ['gmailHistoricalSearch'] });
    setTimeout(() => onImported?.(), 1000);
  };

  if (importSuccess) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="font-semibold text-lg">Thread Imported</h3>
            <p className="text-sm text-gray-600 mt-1">
              The thread has been successfully imported into the inbox
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading message content...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-900">Failed to load content</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b">
          <div className="flex-1">
            <h2 className="text-lg font-semibold truncate">{normalized.subject}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {normalized.messageCount ? `${normalized.messageCount} message${normalized.messageCount !== 1 ? 's' : ''}` : 'Thread'}
            </p>
          </div>
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Thread Info */}
        <div className="space-y-3 text-sm">
          {normalized.participantsText && (
            <div>
              <span className="text-gray-600">Participants:</span>
              <span className="ml-2 font-medium">{normalized.participantsText}</span>
            </div>
          )}
          {normalized.lastMessageAt && (
            <div>
              <span className="text-gray-600">Date:</span>
              <span className="ml-2">{format(parseISO(normalized.lastMessageAt), 'PPpp')}</span>
            </div>
          )}
          {normalized.hasAttachments && (
            <div className="text-green-700 text-xs font-medium">📎 Has attachments</div>
          )}
        </div>

        {/* Snippet */}
        {normalized.snippet && (
          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 line-clamp-3">
            {normalized.snippet}
          </div>
        )}

        {/* Messages */}
        {displayMessages && displayMessages.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Messages ({displayMessages.length})</h3>
              {previewMessages.length > 0 && previewMessages.length < displayMessages.length && (
                <span className="text-xs text-gray-500">Full thread loaded</span>
              )}
              {previewMessages.length > 0 && previewMessages.length === displayMessages.length && !loadingFull && (
                <Button
                  onClick={() => setLoadingFull(true)}
                  variant="outline"
                  size="sm"
                  disabled={isLoadingFull}
                  className="text-xs h-7"
                >
                  {isLoadingFull ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load full thread'
                  )}
                </Button>
              )}
            </div>
            {isLoadingFull && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading full thread content...
              </div>
            )}
            {displayMessages.map((msg, idx) => (
              <div key={msg.gmailMessageId || idx} className="bg-gray-50 rounded-lg overflow-hidden">
                {/* Message Header */}
                <div className="border-b border-gray-200 p-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm truncate">{msg.from}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {msg.dateIso ? format(parseISO(msg.dateIso), 'PPpp') : 'No date'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Message Body */}
                <div className="p-3">
                  {msg.bodyHtml ? (
                    <div
                      className="text-sm text-gray-800 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.bodyHtml) }}
                    />
                  ) : msg.bodyText ? (
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words font-sans">
                      {msg.bodyText}
                    </pre>
                  ) : (
                    <p className="text-sm text-gray-500">(No body content)</p>
                  )}

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        Attachments ({msg.attachments.length})
                      </p>
                      <ul className="space-y-1">
                        {msg.attachments.map((att, attIdx) => (
                          <li key={attIdx} className="text-xs text-gray-600 flex items-center gap-1">
                            <span className="text-gray-400">•</span>
                            <span className="truncate">{att.filename}</span>
                            {att.size > 0 && <span className="text-gray-500 ml-auto flex-shrink-0">({Math.round(att.size / 1024)} KB)</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Import Status */}
        {normalized.importedState !== 'not_imported' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              {normalized.importedState === 'imported_linked'
                ? `Already imported and linked to ${normalized.linkedEntityTitle}`
                : 'Already imported but not linked to any project/job'}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-4 border-t">
          {defaultLinkTarget ? (
            <>
              <Button
                onClick={async () => {
                  setIsImporting(true);
                  try {
                    const response = await base44.functions.invoke('importGmailThread', {
                      gmailThreadId: normalized.gmailThreadId,
                      linkTarget: {
                        linkedEntityType: defaultLinkTarget.type,
                        linkedEntityId: defaultLinkTarget.id,
                        linkedEntityNumber: defaultLinkTarget.number,
                        linkedEntityTitle: defaultLinkTarget.title
                      }
                    });

                    if (response.data.success) {
                      toast.success(`Thread imported and linked to ${defaultLinkTarget.type}`);
                      setImportSuccess(true);
                      queryClient.invalidateQueries({ queryKey: inboxKeys.threads() });
                      queryClient.invalidateQueries({ queryKey: ['gmailHistoricalSearch'] });
                      if (defaultLinkTarget.type === 'project') {
                        queryClient.invalidateQueries({ queryKey: projectKeys.messages(defaultLinkTarget.id) });
                      } else if (defaultLinkTarget.type === 'job') {
                        queryClient.invalidateQueries({ queryKey: jobKeys.messages(defaultLinkTarget.id) });
                      }
                      setTimeout(() => onImported?.(), 1000);
                    } else {
                      toast.error(response.data.error);
                    }
                  } catch (error) {
                    toast.error(error.message);
                  } finally {
                    setIsImporting(false);
                  }
                }}
                disabled={isImporting}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import + Link to ${defaultLinkTarget.type}`
                )}
              </Button>
              <Button
                onClick={handleImportOnly}
                disabled={isImporting}
                variant="outline"
                className="w-full"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Only'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleImportWithLink}
                disabled={isImporting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import + Link to Project/Job'
                )}
              </Button>
              <Button
                onClick={handleImportOnly}
                disabled={isImporting}
                variant="outline"
                className="w-full"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Only'
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Link Modal */}
      <LinkProjectJobModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        gmailThreadId={normalized.gmailThreadId}
        onLinked={handleLinked}
      />
    </>
  );
}