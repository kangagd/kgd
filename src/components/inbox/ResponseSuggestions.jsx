import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export default function ResponseSuggestions({ thread, messages, onUseTemplate }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const generateSuggestions = async () => {
    setIsLoading(true);
    
    try {
      const latestMessage = messages[messages.length - 1];
      const emailContent = `Subject: ${latestMessage.subject}\n\n${latestMessage.body_text || latestMessage.body_html?.replace(/<[^>]*>/g, '').substring(0, 800)}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an email assistant for a garage door and gate service company. Based on this customer email, suggest 3 professional response templates.

Customer Email:
${emailContent}

Category: ${thread.category}

Provide 3 different response templates varying in tone/approach (e.g., quick acknowledgment, detailed response, scheduling-focused). Keep each under 150 words.

Respond in this JSON format:
{
  "suggestions": [
    {
      "title": "Quick Acknowledgment",
      "body": "Response text here..."
    },
    {
      "title": "Detailed Response",
      "body": "Response text here..."
    },
    {
      "title": "Action-Oriented",
      "body": "Response text here..."
    }
  ]
}`,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  body: { type: "string" }
                }
              }
            }
          }
        }
      });

      setSuggestions(response.suggestions || []);
    } catch (error) {
      toast.error("Failed to generate suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text, index) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success("Response copied to clipboard");
  };

  if (suggestions.length === 0 && !isLoading) {
    return (
      <Card className="border border-[#E5E7EB] bg-white mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#FAE008]" />
              <span className="text-[14px] font-medium text-[#111827]">
                AI Response Suggestions
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateSuggestions}
            >
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E5E7EB] bg-white mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[#FAE008]" />
            <h3 className="text-[14px] font-semibold text-[#111827]">
              Suggested Responses
            </h3>
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

        {isExpanded && (isLoading ? (
          <div className="flex items-center gap-2 text-[#6B7280] text-[13px] py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating suggestions...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="border border-[#E5E7EB] rounded-lg p-3 hover:border-[#FAE008] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-semibold text-[#6B7280] uppercase">
                    {suggestion.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(suggestion.body, idx)}
                    className="h-7 px-2"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <p className="text-[13px] text-[#111827] leading-relaxed whitespace-pre-wrap">
                  {suggestion.body}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUseTemplate(suggestion.body)}
                  className="mt-2 w-full"
                >
                  Use This Template
                </Button>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}