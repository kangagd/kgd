import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Eye, Edit3 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function MarkdownTextarea({ value, onChange, onBlur, placeholder, rows = 4 }) {
  const [preview, setPreview] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2 mb-1">
        <Button
          type="button"
          size="sm"
          variant={preview ? "outline" : "secondary"}
          onClick={() => setPreview(false)}
          className="h-7 text-xs"
        >
          <Edit3 className="w-3 h-3 mr-1" />
          Edit
        </Button>
        <Button
          type="button"
          size="sm"
          variant={preview ? "secondary" : "outline"}
          onClick={() => setPreview(true)}
          className="h-7 text-xs"
        >
          <Eye className="w-3 h-3 mr-1" />
          Preview
        </Button>
      </div>
      
      {preview ? (
        <div className="min-h-[100px] p-3 bg-slate-50 rounded-lg border border-slate-200">
          {value ? (
            <ReactMarkdown className="prose prose-sm max-w-none">
              {value}
            </ReactMarkdown>
          ) : (
            <p className="text-slate-400 text-sm">{placeholder}</p>
          )}
        </div>
      ) : (
        <Textarea
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          className="text-xs md:text-sm bg-slate-50 border-slate-300 font-mono"
        />
      )}
    </div>
  );
}