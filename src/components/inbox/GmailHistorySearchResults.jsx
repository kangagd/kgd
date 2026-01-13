import React from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Paperclip, CheckSquare, Square } from 'lucide-react';
import { normalizeGmailHistoryThread } from './gmailHistoryThreadShape';

export default function GmailHistorySearchResults({
  threads,
  selectedThreadId,
  onSelectThread,
  isLoading,
  selectedThreadIds = [],
  onToggleThread,
  isImporting = false
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Searching...</p>
        </div>
      </div>
    );
  }

  if (!threads || threads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <p className="text-sm text-gray-600">No threads found</p>
          <p className="text-xs text-gray-500 mt-1">Try a different search query</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto h-full">
      {threads.map((rawThread) => {
        const thread = normalizeGmailHistoryThread(rawThread);
        const isActive = selectedThreadId === thread.gmailThreadId;
        const isChecked = selectedThreadIds.includes(thread.gmailThreadId);

        return (
          <div
            key={thread.gmailThreadId}
            className={`relative flex items-start gap-2 p-3 rounded-lg border transition-all ${
              isActive
                ? 'bg-blue-50 border-blue-300 shadow-sm'
                : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            {/* Checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleThread?.(thread.gmailThreadId);
              }}
              disabled={isImporting}
              className="flex-shrink-0 mt-0.5 hover:opacity-75 transition-opacity disabled:opacity-50"
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 text-[#111827]" />
              ) : (
                <Square className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* Thread Content */}
            <button
              onClick={() => onSelectThread(thread)}
              className="flex-1 text-left"
            >
            {/* Subject */}
            <h3 className="font-medium text-sm text-gray-900 truncate">
              {thread.subject || '(no subject)'}
            </h3>

            {/* Participants & Date */}
            <p className="text-xs text-gray-600 mt-1 truncate">
              {thread.participantsText}
              {thread.lastMessageAt && (
                <>
                  {' · '}
                  {format(parseISO(thread.lastMessageAt), 'MMM d, h:mm a')}
                </>
              )}
            </p>

            {/* Snippet */}
            {thread.snippet && (
              <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
                {thread.snippet}
              </p>
            )}

            {/* Badges */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Message count */}
              {thread.messageCount && (
                <Badge variant="outline" className="text-xs">
                  {thread.messageCount} msg
                </Badge>
              )}

              {/* Attachments */}
              {thread.hasAttachments && (
                <div className="flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded">
                  <Paperclip className="w-3 h-3" />
                  Attachments
                </div>
              )}

              {/* Import status */}
              {thread.importedState === 'imported_linked' && (
                <Badge className="text-xs bg-green-100 text-green-800 border-green-300">
                  ✓ {thread.linkedEntityTitle}
                </Badge>
              )}
              {thread.importedState === 'imported_unlinked' && (
                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-800 border-yellow-300">
                  Imported
                </Badge>
              )}
            </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}