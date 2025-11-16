import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, X } from "lucide-react";

export default function TechnicianFilter({ technicians, selectedTechnicians, onChange }) {
  const toggleTechnician = (email) => {
    if (selectedTechnicians.includes(email)) {
      onChange(selectedTechnicians.filter(t => t !== email));
    } else {
      onChange([...selectedTechnicians, email]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filter Technicians
          {selectedTechnicians.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedTechnicians.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Filter by Technician</h4>
            {selectedTechnicians.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {technicians.map((tech) => (
              <label
                key={tech.email}
                className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedTechnicians.includes(tech.email)}
                  onChange={() => toggleTechnician(tech.email)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{tech.full_name}</span>
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}