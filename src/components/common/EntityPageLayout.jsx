import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function EntityPageLayout({ 
  title, 
  subtitle, 
  actions, 
  children 
}) {
  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-[#4B5563] mt-1">{subtitle}</p>}
          </div>
          {actions && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              {actions}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}