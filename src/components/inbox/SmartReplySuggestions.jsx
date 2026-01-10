import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SmartReplySuggestions({ message, thread, onSelectSuggestion }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded || suggestions.length > 0) return;

    const generateSuggestions = async () => {
      setLoading(true);
      try {
        const emailContext = `
From: ${message.from_name || message.from_address}
Subject: ${thread.subject}
Message: ${(message.body_text || message.body_html || '').substring(0, 500)}
        `.trim();

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a helpful email assistant. Based on this email, generate 2-3 short, professional, and natural reply suggestions (1-2 sentences each). Keep them concise and actionable. Return as JSON array with "text" field.

Email context:
${emailContext}

Return JSON like: [{"text": "suggestion 1"}, {"text": "suggestion 2"}, {"text": "suggestion 3"}]`,
          response_json_schema: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: { type: 'object', properties: { text: { type: 'string' } } }
              }
            }
          }
        });

        const parsed = result.suggestions || [];
        setSuggestions(parsed.slice(0, 3));
      } catch (err) {
        console.error('Failed to generate smart replies:', err);
      } finally {
        setLoading(false);
      }
    };

    generateSuggestions();
  }, [expanded, message, thread, suggestions.length]);

  return (
    <div className="mt-3 pt-3 border-t border-[#F3F4F6]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[13px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors"
      >
        <Zap className={`w-4 h-4 ${expanded ? 'text-[#FAE008]' : ''}`} />
        Smart Replies
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
              <Loader className="w-4 h-4 animate-spin" />
              Generating suggestions...
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                onClick={() => onSelectSuggestion(suggestion.text)}
                variant="outline"
                className="w-full justify-start text-left h-auto py-2 px-3 text-[13px] whitespace-normal hover:bg-[#FAE008]/10"
              >
                {suggestion.text}
              </Button>
            ))
          ) : (
            <div className="text-[12px] text-[#6B7280]">No suggestions available</div>
          )}
        </div>
      )}
    </div>
  );
}