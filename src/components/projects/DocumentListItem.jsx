import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { FileText, X, Edit2 } from "lucide-react";

export default function DocumentListItem({ doc, docUrl, docName, index, onPreview, onRename, onDelete, canEdit }) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(docName);

  return (
    <div className="relative group">
      <button
        onClick={onPreview}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg hover:border-[#FAE008] transition-all cursor-pointer"
      >
        <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
        {isEditingName ? (
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                onRename(editedName);
                setIsEditingName(false);
              } else if (e.key === 'Escape') {
                setIsEditingName(false);
                setEditedName(docName);
              }
            }}
            onBlur={() => {
              setIsEditingName(false);
              setEditedName(docName);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-7 text-[12px]"
            autoFocus
          />
        ) : (
          <span className="text-[12px] font-medium text-[#111827] truncate flex-1 text-left">
            {docName}
          </span>
        )}
        {canEdit && !isEditingName && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingName(true);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[#F3F4F6] rounded"
            title="Rename document"
          >
            <Edit2 className="w-3 h-3 text-[#6B7280]" />
          </button>
        )}
      </button>
      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Delete document"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}