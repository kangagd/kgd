import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmailThreadSummary({ thread, messages }) {
  const [summary, setSummary] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (messages.length >= 2) {
      generateSummary();
    }
  }, [thread.id, messages.length]);

  const generateSummary = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Prepare email content for AI - limit to last 10 messages and 500 chars per email
      const recentMessages = messages.slice(-10);
      const emailContent = recentMessages.map((msg, idx) => {
        const bodyText = msg.body_text || msg.body_html?.replace(/<[^>]*>/g, '') || '';
        const truncatedBody = bodyText.substring(0, 500);
        
        return `Email ${idx + 1} (${msg.is_outbound ? 'Sent' : 'Received'} - ${new Date(msg.sent_at).toLocaleDateString()}):\n` +
          `From: ${msg.from_address}\n` +
          `Subject: ${msg.subject}\n` +
          `Body: ${truncatedBody}\n\n`;
      }).join('---\n\n');

      // Generate summary
      const summaryResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this email thread and provide a concise summary with key items.

Email thread:
${emailContent}

Provide:
1. A brief 2-3 sentence summary
2. Action items (tasks that need to be done)
3. Key decisions made
4. Important dates or deadlines

Keep it concise and focused on what matters most.`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            action_items: { type: "array", items: { type: "string" } },
            key_decisions: { type: "array", items: { type: "string" } },
            deadlines: { type: "array", items: { type: "string" } }
          }
        }
      });

      setSummary(summaryResponse.summary);
      
      const allActionItems = [
        ...(summaryResponse.action_items || []).map(item => ({ type: 'action', text: item })),
        ...(summaryResponse.key_decisions || []).map(item => ({ type: 'decision', text: item })),
        ...(summaryResponse.deadlines || []).map(item => ({ type: 'deadline', text: item }))
      ];
      
      setActionItems(allActionItems);
    } catch (err) {
      console.error('Summary generation error:', err);
      setError(err.message || 'Failed to generate summary');
    } finally {
      setIsLoading(false);
    }
  };

  if (messages.length < 2) {
    return null;
  }

  return (
    <Card className="border-2 border-[#FAE008]/30 bg-gradient-to-r from-[#FFFEF5] to-white mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FAE008] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#111827]" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[#111827]">AI Summary</h3>
              <p className="text-[12px] text-[#6B7280]">
                {messages.length} messages analyzed
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {isExpanded && (
          <>
            {isLoading && (
              <div className="flex items-center gap-2 text-[#6B7280] text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating summary...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-[#DC2626] text-[13px] mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Failed to generate summary</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateSummary}
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            )}

            {!isLoading && !error && summary && (
              <>
                <div className="mb-4">
                  <h4 className="text-[12px] font-semibold text-[#6B7280] uppercase mb-2">Overview</h4>
                  <p className="text-[14px] text-[#111827] leading-relaxed">{summary}</p>
                </div>

                {actionItems.length > 0 && (
                  <div>
                    <h4 className="text-[12px] font-semibold text-[#6B7280] uppercase mb-2">
                      Key Items
                    </h4>
                    <div className="space-y-2">
                      {actionItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-[13px] text-[#111827] bg-white rounded-lg p-2.5 border border-[#E5E7EB]"
                        >
                          {item.type === 'action' && (
                            <CheckCircle2 className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
                          )}
                          {item.type === 'decision' && (
                            <div className="w-4 h-4 mt-0.5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <div className="w-2 h-2 rounded-full bg-green-600" />
                            </div>
                          )}
                          {item.type === 'deadline' && (
                            <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <span className="font-medium text-[11px] text-[#6B7280] uppercase mr-2">
                              {item.type}
                            </span>
                            <span>{item.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!isLoading && !error && !summary && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateSummary}
                className="w-full"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Summary
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}