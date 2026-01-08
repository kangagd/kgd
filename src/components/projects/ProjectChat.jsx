import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ProjectChat({ projectId }) {
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionPosition, setMentionPosition] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await base44.auth.me());
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: messages = [] } = useQuery({
    queryKey: ['projectMessages', projectId],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('getProjectMessages', { projectId });
        return response.data?.messages || [];
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Unable to load chat messages');
        return [];
      }
    },
    refetchInterval: 5000,
    enabled: !!projectId
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users', 'mentions'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('getUsersForMentions', {});
        return response.data?.users || [];
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Could not load user list for mentions');
        return [];
      }
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText) => {
      const response = await base44.functions.invoke('sendMessage', {
        type: 'project',
        entityId: projectId,
        message: messageText
      });
      
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectMessages', projectId] });
      setMessage("");
    },
    onError: (error) => {
      toast.error('Failed to send message: ' + error.message);
    }
  });

  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim() && user) {
      sendMessageMutation.mutate(message);
      setShowMentionMenu(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Check if @ was just typed
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Only show menu if there's no space after @ or if we're still typing a name
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt);
        setMentionPosition(lastAtIndex);
        setShowMentionMenu(true);
      } else {
        setShowMentionMenu(false);
      }
    } else {
      setShowMentionMenu(false);
    }
  };

  const insertMention = (userName) => {
    const beforeMention = message.substring(0, mentionPosition);
    const afterMention = message.substring(mentionPosition + mentionSearch.length + 1);
    const newMessage = `${beforeMention}@${userName} ${afterMention}`;
    setMessage(newMessage);
    setShowMentionMenu(false);
    inputRef.current?.focus();
  };

  const filteredUsers = allUsers.filter(u => 
    (u.display_name || u.full_name)?.toLowerCase().includes(mentionSearch.toLowerCase()) &&
    u.email !== user?.email
  ).slice(0, 5);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 rounded-lg border border-gray-200">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.sender_email === user.email;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    isOwnMessage
                      ? 'bg-[#FAE008] text-gray-900 shadow-sm'
                      : 'bg-white border border-gray-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-xs font-bold">
                      {msg.sender_name}
                    </span>
                    <span className="text-[10px] opacity-70">
                      {format(new Date(msg.created_date), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                   {(msg.message || '').split(/(@[\w\s]+?)(?=\s|$)/).map((part, i) => {
                     if (part.startsWith('@')) {
                       const mentionedName = part.substring(1).trim();
                       const mentionedUser = allUsers.find(u => 
                         (u.display_name || u.full_name)?.toLowerCase() === mentionedName.toLowerCase()
                       );
                       const isCurrentUser = mentionedUser?.email === user?.email;
                       return (
                         <span 
                           key={i} 
                           className={`font-semibold ${isCurrentUser ? 'bg-blue-100 text-blue-800 px-1 rounded' : 'text-blue-600'}`}
                         >
                           @{mentionedName}
                         </span>
                       );
                     }
                     return <span key={i}>{part}</span>;
                   })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="mt-3 relative">
        {showMentionMenu && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u.display_name || u.full_name)}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold">
                  {(u.display_name || u.full_name)?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.display_name || u.full_name}</div>
                  <div className="text-xs text-gray-500 truncate">{u.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            placeholder="Type a message... (use @ to mention)"
            className="flex-1 bg-white"
          />
          <Button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="bg-[#FAE008] text-gray-900 hover:bg-[#E5CF07] shadow-sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}