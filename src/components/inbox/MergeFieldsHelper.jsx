import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

// Available merge fields from buildTemplateContext
const MERGE_FIELDS = [
  { key: "customer_name", label: "Customer Name" },
  { key: "customer_email", label: "Customer Email" },
  { key: "customer_phone", label: "Customer Phone" },
  { key: "job_number", label: "Job Number" },
  { key: "job_type", label: "Job Type" },
  { key: "project_title", label: "Project Title" },
  { key: "project_number", label: "Project Number" },
  { key: "address", label: "Address" },
  { key: "scheduled_date", label: "Scheduled Date" },
  { key: "scheduled_time", label: "Scheduled Time" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "invoice_amount", label: "Invoice Amount" },
  { key: "invoice_link", label: "Invoice Link" },
  { key: "invoice_pdf", label: "Invoice PDF" },
  { key: "technician_name", label: "Technician Name" },
];

export default function MergeFieldsHelper({ onInsert }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (key) => {
    onInsert(`{${key}}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-8 text-[12px] text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
          title="Insert merge fields"
        >
          Merge fields
          <ChevronDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0">
        <div className="text-[11px] font-semibold text-[#6B7280] px-2 py-1">
          Available fields
        </div>
        <div className="max-h-[400px] overflow-y-auto px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-1">
            {MERGE_FIELDS.map((field) => (
              <button
                key={field.key}
                onClick={() => handleSelect(field.key)}
                className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-[#111827] hover:bg-[#F3F4F6] transition-colors"
              >
                <span className="font-medium">{field.label}</span>
                <span className="text-[11px] text-[#9CA3AF] block">
                  {`{${field.key}}`}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-[#E5E7EB] px-2 py-2">
          <div className="text-[11px] text-[#6B7280] leading-relaxed">
            Fields populate from linked Project/Contract + Customer data
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}