import { useState, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SmartComposeHelper({ currentText, onAcceptSuggestion }) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const debounceTimer = useRef(null);

  const generateSuggestion = useCallback(async (text) => {
    if (text.length < 10 || text.endsWith('.') || text.endsWith('?')) {
      setSuggestion('');
      setVisible(false);
      return;
    }

    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an email writing assistant. Complete this email sentence naturally and professionally. Provide ONLY the completion (continuation) of the sentence, starting with a space. Be concise (10-15 words max).

Current text: "${text}"

Provide only the completion, no quotes or explanation.`,
        response_json_schema: {
          type: 'object',
          properties: {
            completion: { type: 'string' }
          }
        }
      });

      if (result.completion) {
        setSuggestion(result.completion);
        setVisible(true);
      }
    } catch (err) {
      console.error('Failed to generate compose suggestion:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTextChange = useCallback((text) => {
    clearTimeout(debounceTimer.current);
    
    debounceTimer.current = setTimeout(() => {
      generateSuggestion(text);
    }, 800); // Debounce for 800ms to avoid too many API calls
  }, [generateSuggestion]);

  return {
    suggestion,
    visible,
    loading,
    handleTextChange,
    onAcceptSuggestion: () => {
      onAcceptSuggestion(suggestion);
      setSuggestion('');
      setVisible(false);
    },
    onRejectSuggestion: () => {
      setSuggestion('');
      setVisible(false);
    }
  };
}

export function SmartComposeSuggestionUI({ suggestion, loading, visible, onAccept, onReject }) {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 mt-2 p-2 bg-[#FAE008]/10 rounded-lg border border-[#FAE008]/20">
      <span className="text-[12px] text-[#6B7280]">
        {loading ? (
          <div className="flex items-center gap-1.5">
            <Loader className="w-3 h-3 animate-spin" />
            Suggesting...
          </div>
        ) : (
          <span className="text-[#111827]">{suggestion}</span>
        )}
      </span>
      {!loading && suggestion && (
        <div className="flex gap-1 ml-auto">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-green-100"
            onClick={onAccept}
            title="Accept suggestion"
          >
            <Check className="w-3 h-3 text-green-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-red-100"
            onClick={onReject}
            title="Reject suggestion"
          >
            <X className="w-3 h-3 text-red-600" />
          </Button>
        </div>
      )}
    </div>
  );
}