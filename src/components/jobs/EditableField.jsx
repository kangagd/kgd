import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger } from
"@/components/ui/popover";

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
  const [multiSelectValue, setMultiSelectValue] = useState(Array.isArray(value) ? value : []);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
    if (isEditing && type === "multi-select") {
      setPopoverOpen(true);
    }
  }, [isEditing, type]);

  useEffect(() => {
    setEditValue(value || "");
    setMultiSelectValue(Array.isArray(value) ? value : []);
  }, [value]);

  const handleSave = () => {
    if (type === "multi-select") {
      if (JSON.stringify(multiSelectValue) !== JSON.stringify(value)) {
        onSave(multiSelectValue);
      }
    } else {
      if (editValue !== value) {
        onSave(editValue);
      }
    }
    setPopoverOpen(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setMultiSelectValue(Array.isArray(value) ? value : []);
    setPopoverOpen(false);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type !== "multi-select") {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const toggleMultiSelect = (optionValue) => {
    setMultiSelectValue((prev) =>
    prev.includes(optionValue) ?
    prev.filter((v) => v !== optionValue) :
    [...prev, optionValue]
    );
  };

  if (isEditing) {
    return (
      <div className={`space-y-2 p-2 md:p-3 bg-white border-2 border-[#fae008] rounded-lg ${className}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" />}
          {type === "multi-select" ?
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start h-7 text-xs md:text-sm">
                  {multiSelectValue.length === 0 ?
                "Select..." :
                `${multiSelectValue.length} selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {options.map((opt) =>
                <div key={opt.value} className="flex items-center space-x-2">
                      <Checkbox
                    id={`edit-${opt.value}`}
                    checked={multiSelectValue.includes(opt.value)}
                    onCheckedChange={() => toggleMultiSelect(opt.value)} />

                      <label
                    htmlFor={`edit-${opt.value}`}
                    className="text-sm flex-1 cursor-pointer">

                        {opt.label}
                      </label>
                    </div>
                )}
                </div>
              </PopoverContent>
            </Popover> :
          type === "select" ?
          <Select value={editValue} onValueChange={(val) => setEditValue(val)}>
              <SelectTrigger className="h-7 text-xs md:text-sm border-0 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) =>
              <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
              )}
              </SelectContent>
            </Select> :

          <Input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs md:text-sm border-0 focus:ring-0 p-0" />

          }
        </div>
        <div className="flex gap-2 justify-center">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCancel}
            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50">
            <X className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSave}
            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50">
            <Check className="w-4 h-4" />
          </Button>
        </div>
      </div>);

  }

  return (
    <div
      onClick={() => setIsEditing(true)} className="bg-[#ffffff] text-slate-950 p-2 text-sm font-bold rounded-lg flex items-center gap-2 md:p-3 cursor-pointer transition-colors">


      {Icon && <Icon className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" />}
      <span className="text-[14px] font-normal text-[#111827] leading-[1.4]">
        {value ? displayFormat ? displayFormat(value) : value : <span className="text-slate-400">{placeholder}</span>}
      </span>
    </div>);

}