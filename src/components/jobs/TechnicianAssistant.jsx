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

function AssistantContent({ job, conversation, messages, isLoading, input, setInput, handleSend, handleKeyPress }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const quickPrompts = [
    "What parts might I need for this job?",
    "Help me write completion notes",
    "How do I adjust motor limits?",
    "What safety checks should I perform?"
  ];

  return (
    <>
      <ScrollArea className="flex-1 pr-4 h-[500px]" ref={scrollRef}>
        <div className="space-y-4 pb-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-[#fae008]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-[#000000]" />
              </div>
              <p className="text-slate-600 font-medium mb-6">
                I'm here to help with parts recommendations, completion notes, and technical questions.
              </p>
              <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto">
                {quickPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(prompt)}
                    className="text-xs font-semibold border-2 border-slate-300 hover:border-[#fae008] hover:bg-[#fae008]/10 transition-all h-auto py-3 text-left"
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
            <div className="flex items-center gap-2 text-slate-500 bg-slate-50 border-2 border-slate-200 rounded-xl p-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2 pt-4 border-t-2 border-slate-200">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about parts, completion notes, or technical questions..."
          className="resize-none border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 rounded-xl font-medium"
          rows={2}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-semibold shadow-md hover:shadow-lg transition-all h-auto"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </>
  );
}

export default function TechnicianAssistant({ open, onClose, job, embedded = false }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if ((open || embedded) && !conversation) {
      initConversation();
    }
  }, [open, embedded]);

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
      
      const unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
        setIsLoading(false);
      });

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

  if (embedded) {
    return (
      <div className="flex flex-col h-full">
        <AssistantContent
          job={job}
          conversation={conversation}
          messages={messages}
          isLoading={isLoading}
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          handleKeyPress={handleKeyPress}
        />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col border-2 border-slate-200 rounded-2xl">
        <DialogHeader className="border-b-2 border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#fae008]/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#000000]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-[#000000] tracking-tight">Technician Assistant</DialogTitle>
              {job && (
                <p className="text-sm text-slate-500 font-medium">
                  Job #{job.job_number} - {job.customer_name}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <AssistantContent
          job={job}
          conversation={conversation}
          messages={messages}
          isLoading={isLoading}
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          handleKeyPress={handleKeyPress}
        />
      </DialogContent>
    </Dialog>
  );
}