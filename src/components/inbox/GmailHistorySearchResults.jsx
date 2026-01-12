import React from 'react';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Paperclip, Link as LinkIcon } from 'lucide-react';

export default function GmailHistorySearchResults({ results, onSelectThread }) {
  return (
    <div className="space-y-2">
      {results.map((thread) => {
        const importStatus = thread.imported
          ? thread.linkedEntityTitle
            ? `Imported + linked to ${thread.linkedEntityTitle}`
            : 'Imported (unlinked)'
          : 'Not imported';

        const statusColor = thread.imported
          ? thread.linkedEntityTitle
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
          : 'bg-blue-100 text-blue-800';

        return (
          <button
            key={thread.gmail_thread_id}
            onClick={() => onSelectThread(thread)}
            className="w-full text-left border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors flex items-start justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate text-sm">
                {thread.subject}
              </h3>
              <p className="text-xs text-gray-600 mt-1 truncate">
                {thread.participants.from}
                {thread.participants.to?.length > 0 && ` → ${thread.participants.to[0]}`}
              </p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {thread.snippet}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-[11px]">
                  {thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''}
                </Badge>
                <Badge className={`text-[11px] ${statusColor}`}>
                  {importStatus}
                </Badge>
                {thread.hasAttachments && (
                  <Paperclip className="w-3 h-3 text-gray-500" />
                )}
                <span className="text-[11px] text-gray-500">
                  {format(parseISO(thread.lastMessageAt), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-2" />
          </button>
        );
      })}
    </div>
  );
}