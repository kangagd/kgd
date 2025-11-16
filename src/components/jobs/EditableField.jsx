import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditableField({ 
  value, 
  onSave, 
  type = "text",
  options = [],
  icon: Icon,
  className = "",
  displayFormat,
  placeholder = "Click to edit"
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 p-2 md:p-3 bg-white border-2 border-orange-400 rounded-lg ${className}`}>
        {Icon && <Icon className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" />}
        {type === "select" ? (
          <Select value={editValue} onValueChange={(val) => setEditValue(val)}>
            <SelectTrigger className="h-7 text-xs md:text-sm border-0 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs md:text-sm border-0 focus:ring-0 p-0"
          />
        )}
        <div className="flex gap-1 flex-shrink-0">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleSave}
            className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <Check className="w-3 h-3" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleCancel}
            className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)}
      className={`flex items-center gap-2 p-2 md:p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors ${className}`}
    >
      {Icon && <Icon className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" />}
      <span className="text-xs md:text-sm">
        {value ? (displayFormat ? displayFormat(value) : value) : <span className="text-slate-400">{placeholder}</span>}
      </span>
    </div>
  );
}