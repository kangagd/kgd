import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const FIELD_LABELS = {
  title: "Project Title",
  description: "Description",
  project_type: "Project Type",
  customer_name: "Customer Name",
  customer_email: "Customer Email",
  customer_phone: "Customer Phone",
  address_full: "Address",
  suggested_products: "Products",
  suggested_priority: "Priority"
};

const PROJECT_TYPES = [
  "Garage Door Install",
  "Gate Install",
  "Roller Shutter Install",
  "Multiple",
  "Motor/Accessory",
  "Repair",
  "Maintenance"
];

export default function AIEmailSuggestionsModal({
  open,
  onClose,
  emailThread,
  project,
  suggestions,
  onApply
}) {
  const [selectedFields, setSelectedFields] = useState(() => {
    // Pre-select fields that have suggestions and are different from current
    const fields = {};
    if (suggestions) {
      Object.keys(suggestions).forEach(key => {
        const suggestedValue = suggestions[key];
        const currentValue = project?.[key];
        
        // Only pre-select if there's a meaningful suggestion
        if (suggestedValue && suggestedValue !== currentValue) {
          if (Array.isArray(suggestedValue)) {
            fields[key] = suggestedValue.length > 0;
          } else {
            fields[key] = true;
          }
        }
      });
    }
    return fields;
  });

  const toggleField = (field) => {
    setSelectedFields(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const selectAll = () => {
    const allFields = {};
    Object.keys(suggestions || {}).forEach(key => {
      const suggestedValue = suggestions[key];
      if (suggestedValue && (Array.isArray(suggestedValue) ? suggestedValue.length > 0 : true)) {
        allFields[key] = true;
      }
    });
    setSelectedFields(allFields);
  };

  const deselectAll = () => {
    setSelectedFields({});
  };

  const handleApply = () => {
    const fieldsToApply = {};
    Object.keys(selectedFields).forEach(key => {
      if (selectedFields[key] && suggestions[key]) {
        // Map suggestion field names to project field names
        let projectField = key;
        if (key === 'suggested_priority') {
          // Skip priority for now as it's not a direct project field
          return;
        }
        fieldsToApply[projectField] = suggestions[key];
      }
    });

    if (Object.keys(fieldsToApply).length > 0 && onApply) {
      onApply(fieldsToApply, emailThread?.id);
    }
    onClose();
  };

  const selectedCount = Object.values(selectedFields).filter(Boolean).length;

  const renderFieldRow = (fieldKey, label) => {
    const suggestedValue = suggestions?.[fieldKey];
    const currentValue = project?.[fieldKey];

    // Skip if no suggestion
    if (!suggestedValue || (Array.isArray(suggestedValue) && suggestedValue.length === 0)) {
      return null;
    }

    const formatValue = (value) => {
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return value || "—";
    };

    const isDifferent = Array.isArray(suggestedValue) 
      ? JSON.stringify(suggestedValue) !== JSON.stringify(currentValue)
      : suggestedValue !== currentValue;

    return (
      <div 
        key={fieldKey}
        className={`p-3 rounded-lg border transition-all cursor-pointer ${
          selectedFields[fieldKey] 
            ? 'border-[#6366F1] bg-[#EEF2FF]' 
            : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
        }`}
        onClick={() => toggleField(fieldKey)}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selectedFields[fieldKey] || false}
            onCheckedChange={() => toggleField(fieldKey)}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-[#374151] mb-2">{label}</div>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[#6B7280] mb-0.5">Current</div>
                <div className="text-[13px] text-[#4B5563] truncate">
                  {formatValue(currentValue)}
                </div>
              </div>
              {isDifferent && (
                <>
                  <ArrowRight className="w-4 h-4 text-[#6366F1] flex-shrink-0 mt-4" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#6B7280] mb-0.5 flex items-center gap-1">
                      Suggested
                      <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-[#6366F1]/10 text-[#4338CA]">AI</span>
                    </div>
                    <div className="text-[13px] text-[#111827] font-medium truncate">
                      {formatValue(suggestedValue)}
                    </div>
                  </div>
                </>
              )}
              {!isDifferent && (
                <div className="flex items-center gap-1 text-[12px] text-[#10B981]">
                  <Check className="w-3.5 h-3.5" />
                  Already set
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#6366F1]" />
            </div>
            <div>
              <DialogTitle className="text-[18px] font-semibold text-[#111827]">
                AI Suggested Fields from Email
              </DialogTitle>
              {emailThread?.subject && (
                <p className="text-[13px] text-[#6B7280] mt-0.5 truncate max-w-md">
                  From: {emailThread.subject}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {emailThread?.ai_summary && (
            <div className="mb-4 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
              <div className="text-[12px] font-medium text-[#4B5563] mb-1">Email Summary</div>
              <p className="text-[13px] text-[#374151] leading-relaxed">
                {emailThread.ai_summary}
              </p>
              {emailThread.ai_key_points && emailThread.ai_key_points.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
                  <div className="text-[12px] font-medium text-[#4B5563] mb-1">Key Points</div>
                  <ul className="space-y-1">
                    {emailThread.ai_key_points.slice(0, 3).map((point, idx) => (
                      <li key={idx} className="text-[12px] text-[#6B7280] flex items-start gap-1.5">
                        <span className="text-[#6366F1]">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] text-[#4B5563]">
              Select the fields you want to apply to this project:
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-[12px]">
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll} className="h-7 text-[12px]">
                Clear
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {renderFieldRow('title', 'Project Title')}
            {renderFieldRow('description', 'Description')}
            {renderFieldRow('project_type', 'Project Type')}
            {renderFieldRow('customer_name', 'Customer Name')}
            {renderFieldRow('customer_email', 'Customer Email')}
            {renderFieldRow('customer_phone', 'Customer Phone')}
            {renderFieldRow('address_full', 'Address')}
            {renderFieldRow('suggested_products', 'Products Mentioned')}
            {renderFieldRow('suggested_priority', 'Priority')}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-[#E5E7EB] pt-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-[13px] text-[#6B7280]">
              {selectedCount} field{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleApply}
                disabled={selectedCount === 0}
                className="bg-[#6366F1] hover:bg-[#4F46E5] text-white"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Apply Selected
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}