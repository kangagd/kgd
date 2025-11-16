import React, { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function MarkdownTextarea({ value, onChange, onBlur, placeholder, rows = 4 }) {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef(null);

  const insertFormatting = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange({ target: { value: newText } });
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onBlur) onBlur();
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex gap-1 mb-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => insertFormatting('**', '**')}
            className="h-7 w-7 p-0"
            title="Bold"
          >
            <Bold className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => insertFormatting('*', '*')}
            className="h-7 w-7 p-0"
            title="Italic"
          >
            <Italic className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => insertFormatting('- ', '')}
            className="h-7 w-7 p-0"
            title="Bullet List"
          >
            <List className="w-3 h-3" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => insertFormatting('1. ', '')}
            className="h-7 w-7 p-0"
            title="Numbered List"
          >
            <ListOrdered className="w-3 h-3" />
          </Button>
        </div>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={rows}
          className="text-xs md:text-sm bg-white border-slate-300"
          autoFocus
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="min-h-[100px] p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors"
    >
      {value ? (
        <ReactMarkdown 
          className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
            li: ({ children }) => <li className="mb-1">{children}</li>,
            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
          }}
        >
          {value}
        </ReactMarkdown>
      ) : (
        <p className="text-slate-400 text-sm">{placeholder}</p>
      )}
    </div>
  );
}