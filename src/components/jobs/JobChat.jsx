import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle } from "lucide-react";
import { format } from "date-fns";

export default function JobChat({ jobId }) {
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
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
    queryKey: ['jobMessages', jobId],
    queryFn: () => base44.entities.JobMessage?.filter({ job_id: jobId }, 'created_date') || [],
    refetchInterval: 5000
  });

  const sendMessageMutation = useMutation({
    mutationFn: (messageText) => 
      base44.entities.JobMessage.create({
        job_id: jobId,
        sender_email: user.email,
        sender_name: user.full_name,
        message: messageText
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobMessages', jobId] });
      setMessage("");
    }
  });

  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim() && user) {
      sendMessageMutation.mutate(message);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 rounded-lg">
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
                  className={`max-w-[70%] rounded-lg p-3 ${
                    isOwnMessage
                      ? 'bg-[#FAE008] text-gray-900'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <p className="text-xs font-semibold mb-1">
                    {msg.sender_name}
                  </p>
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {format(new Date(msg.created_date), 'h:mm a')}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2 mt-3">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={!message.trim() || sendMessageMutation.isPending}
          className="bg-[#FAE008] text-gray-900 hover:bg-[#E5CF07]"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}