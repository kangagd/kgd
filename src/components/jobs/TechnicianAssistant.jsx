import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Loader2 } from "lucide-react";
import MessageBubble from "../assistant/MessageBubble";

export default function TechnicianAssistant({ open, onClose, job }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && !conversation) {
      initConversation();
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const initConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: "technician_assistant",
        metadata: {
          name: `Tech Assist - Job #${job?.job_number}`,
          job_id: job?.id,
        }
      });
      setConversation(conv);
      
      // Subscribe to updates
      const unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
        setIsLoading(false);
      });

      // Send initial context message
      if (job) {
        const contextMessage = `I'm working on Job #${job.job_number} for ${job.customer_name}. Job type: ${job.job_type_name || 'Not specified'}. ${job.notes ? `Notes: ${job.notes}` : ''}`;
        
        await base44.agents.addMessage(conv, {
          role: "user",
          content: contextMessage
        });
      }

      return () => unsubscribe?.();
    } catch (error) {
      console.error("Error initializing conversation:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !conversation || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: userMessage
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickPrompts = [
    "What parts might I need for this job?",
    "Help me write completion notes",
    "How do I adjust motor limits?",
    "What safety checks should I perform?"
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-600" />
            <DialogTitle>Technician Assistant</DialogTitle>
          </div>
          {job && (
            <p className="text-sm text-slate-500">
              Job #{job.job_number} - {job.customer_name}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 mb-4">
                  I'm here to help with parts recommendations, completion notes, and technical questions.
                </p>
                <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                  {quickPrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setInput(prompt)}
                      className="text-xs"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages
                .filter(msg => msg.content || msg.tool_calls?.length > 0)
                .map((message, index) => (
                  <MessageBubble key={index} message={message} />
                ))
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about parts, completion notes, or technical questions..."
            className="resize-none"
            rows={2}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}