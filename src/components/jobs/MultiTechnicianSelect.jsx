import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, UserPlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export default function MultiTechnicianSelect({ selectedEmails = [], technicians = [], onChange }) {
  const [open, setOpen] = useState(false);

  const selectedTechs = selectedEmails
    .map(email => technicians.find(t => t.email === email))
    .filter(Boolean);

  const toggleTechnician = (techEmail) => {
    if (selectedEmails.includes(techEmail)) {
      onChange(selectedEmails.filter(e => e !== techEmail));
    } else {
      onChange([...selectedEmails, techEmail]);
    }
  };

  const removeTechnician = (techEmail) => {
    onChange(selectedEmails.filter(e => e !== techEmail));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selectedTechs.length > 0 ? (
          selectedTechs.map((tech) => (
            <Badge key={tech.email} variant="secondary" className="flex items-center gap-2 pr-1.5 py-1.5 border-2 font-semibold text-sm">
              {tech.full_name}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeTechnician(tech.email);
                }}
                className="ml-1 hover:bg-slate-300 rounded-full p-1 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </Badge>
          ))
        ) : (
          <span className="text-sm text-slate-500 font-medium">No technicians assigned</span>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full font-semibold border-2 h-10">
            <UserPlus className="w-4 h-4 mr-2" />
            {selectedTechs.length > 0 ? 'Manage Technicians' : 'Assign Technicians'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 border-2 border-slate-300 shadow-lg rounded-xl" align="start">
          <div className="space-y-4">
            <h4 className="font-bold text-base text-[#000000]">Select Technicians</h4>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {technicians.map((tech) => (
                <div key={tech.email} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                  <Checkbox
                    id={tech.email}
                    checked={selectedEmails.includes(tech.email)}
                    onCheckedChange={() => toggleTechnician(tech.email)}
                  />
                  <label
                    htmlFor={tech.email}
                    className="text-sm font-semibold flex-1 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleTechnician(tech.email);
                    }}
                  >
                    {tech.full_name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}