import React from "react";
import { Button } from "@/components/ui/button";

export default function DateRangeSelector({ value, onChange }) {
  const options = [
    { value: "3m", label: "3m" },
    { value: "6m", label: "6m" },
    { value: "12m", label: "12m" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-[#4B5563] font-medium mr-1">Period:</span>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <Button
            key={opt.value}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(opt.value)}
            className={`h-8 text-xs px-3 transition-all ${
              isSelected
                ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] border-[#FAE008] font-semibold"
                : "text-[#4B5563] border-[#E5E7EB] hover:bg-[#F3F4F6] font-medium bg-white"
            }`}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}