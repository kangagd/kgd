import React from "react";
import { cn } from "@/lib/utils";

export default function TabbedSelector({ value, onValueChange, options, className }) {
  return (
    <div className={cn(
      "flex h-10 items-center justify-center rounded-xl bg-[#F3F4F6] p-1 text-[#6B7280] shadow-sm",
      className
    )}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            value === option.value
              ? "bg-white text-[#111827] shadow-sm font-semibold"
              : "hover:text-[#111827] hover:bg-white/50"
          )}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}