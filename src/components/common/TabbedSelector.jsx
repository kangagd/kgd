import React from "react";
import { cn } from "@/lib/utils";

export default function TabbedSelector({ value, onValueChange, options, className }) {
  return (
    <div className={cn(
      "inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 shadow-sm",
      "w-full sm:w-auto", 
      className
    )}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            "flex-1",
            value === option.value
              ? "bg-white text-slate-950 shadow-sm font-semibold"
              : "hover:bg-slate-200/50 hover:text-slate-700"
          )}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}