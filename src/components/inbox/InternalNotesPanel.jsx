import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Trash2, User, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function InternalNotesPanel({ threadId }) {
  const [newNote, setNewNote] = useState("");
  const [user, setUser] = useState(null);
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(`internalNotes-${threadId}-open`);
    return stored !== null ? stored === 'true' : true;
  });
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['thread-notes', threadId],
    queryFn: () => base44.entities.EmailThreadNote.filter({ thread_id: threadId }),
    refetchInterval: 30000 // Refresh every 30 seconds for real-time feel
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.entities.EmailThreadNote.create({
        thread_id: threadId,
        note: newNote.trim(),
        created_by: user.email,
        created_by_name: user.full_name || user.display_name
      });
      
      // Update thread last_worked tracking
      await base44.entities.EmailThread.update(threadId, {
        last_worked_by: user.email,
        last_worked_by_name: user.full_name || user.display_name,
        last_worked_at: new Date().toISOString()
      });
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread-notes', threadId] });
      queryClient.invalidateQueries({ queryKey: ['emailThreads'] });
      setNewNote("");
      toast.success('Note added');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add note');
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId) => base44.entities.EmailThreadNote.delete(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread-notes', threadId] });
      toast.success('Note deleted');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete note');
    }
  });

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }
    addNoteMutation.mutate();
  };

  // Sort notes by date, newest first
  const sortedNotes = [...notes].sort((a, b) => 
    new Date(b.created_date) - new Date(a.created_date)
  );

  React.useEffect(() => {
    localStorage.setItem(`internalNotes-${threadId}-open`, isOpen);
  }, [isOpen, threadId]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg hover:bg-[#F3F4F6] transition-colors">
          <div className="flex items-center gap-2 text-sm font-medium text-[#6B7280]">
            <MessageSquare className="w-4 h-4" />
            Internal Notes ({notes.length})
          </div>
          <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 mt-2">

      {/* Add Note Form */}
      <form onSubmit={handleAddNote} className="space-y-2">
        <Textarea
          placeholder="Add an internal note (visible only to team members)..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button 
            type="submit" 
            size="sm" 
            disabled={addNoteMutation.isPending || !newNote.trim()}
          >
            {addNoteMutation.isPending ? 'Adding...' : 'Add Note'}
          </Button>
        </div>
      </form>

      {/* Notes List */}
      {isLoading ? (
        <div className="text-sm text-[#6B7280] text-center py-4">Loading notes...</div>
      ) : sortedNotes.length === 0 ? (
        <div className="text-sm text-[#6B7280] text-center py-4">No internal notes yet</div>
      ) : (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <Card key={note.id} className="bg-[#FFFBEB] border-[#FDE68A]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-[#92400E]">
                      <User className="w-3 h-3" />
                      <span className="font-medium">{note.created_by_name || note.created_by}</span>
                      <span>•</span>
                      <span>{format(new Date(note.created_date), 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="text-sm text-[#111827] whitespace-pre-wrap">{note.note}</p>
                  </div>
                  {user?.email === note.created_by && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNoteMutation.mutate(note.id)}
                      className="h-8 w-8 p-0 text-[#DC2626] hover:text-[#B91C1C] hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </CollapsibleContent>
    </Collapsible>
  );
}