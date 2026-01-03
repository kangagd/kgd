import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, UserPlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { filterBase44TeamMembers } from "../utils/userFilters";

export default function MultiTechnicianSelect({ selectedEmails = [], technicians = [], onChange }) {
  const [open, setOpen] = useState(false);

  // Filter out Base44 team members
  const assignableTechnicians = useMemo(() => 
    filterBase44TeamMembers(technicians), 
    [technicians]
  );

  const selectedTechs = selectedEmails
    .map(email => assignableTechnicians.find(t => t.email === email))
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
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedTechs.length > 0 ? (
          selectedTechs.map((tech) => (
            <Badge key={tech.email} variant="secondary" className="flex items-center gap-1 pr-1">
              {tech.display_name || tech.full_name}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeTechnician(tech.email);
                }}
                className="ml-1 hover:bg-slate-300 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))
        ) : (
          <span className="text-sm text-slate-400">No technicians assigned</span>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full">
            <UserPlus className="w-4 h-4 mr-2" />
            {selectedTechs.length > 0 ? 'Manage Technicians' : 'Assign Technicians'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Select Technicians</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {assignableTechnicians.map((tech) => (
                <div key={tech.email} className="flex items-center space-x-2">
                  <Checkbox
                    id={tech.email}
                    checked={selectedEmails.includes(tech.email)}
                    onCheckedChange={() => toggleTechnician(tech.email)}
                  />
                  <label
                    htmlFor={tech.email}
                    className="text-sm flex-1 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleTechnician(tech.email);
                    }}
                  >
                    {tech.display_name || tech.full_name}
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