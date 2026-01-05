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

export default function MultiTechnicianSelect({ 
  selectedEmails = [], 
  technicians = [], 
  onChange, 
  leaves = [], 
  scheduledDate = null 
}) {
  const [open, setOpen] = useState(false);

  // Filter out Base44 team members
  const assignableTechnicians = useMemo(() => 
    filterBase44TeamMembers(technicians), 
    [technicians]
  );

  // Check if a technician is on leave for the scheduled date
  const isTechnicianOnLeave = (techEmail) => {
    if (!scheduledDate || !leaves || leaves.length === 0) return false;
    
    try {
      const checkDate = new Date(scheduledDate);
      checkDate.setHours(12, 0, 0, 0); // Use midday to avoid timezone issues
      
      return leaves.some(leave => {
        if (leave.technician_email?.toLowerCase() !== techEmail?.toLowerCase()) return false;
        
        const leaveStart = new Date(leave.start_time);
        const leaveEnd = new Date(leave.end_time);
        
        return checkDate >= leaveStart && checkDate <= leaveEnd;
      });
    } catch {
      return false;
    }
  };

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
              {assignableTechnicians.map((tech) => {
                const onLeave = isTechnicianOnLeave(tech.email);
                return (
                  <div key={tech.email} className={`flex items-center space-x-2 ${onLeave ? 'opacity-60' : ''}`}>
                    <Checkbox
                      id={tech.email}
                      checked={selectedEmails.includes(tech.email)}
                      disabled={onLeave}
                      onCheckedChange={() => !onLeave && toggleTechnician(tech.email)}
                    />
                    <label
                      htmlFor={tech.email}
                      className={`text-sm flex-1 ${onLeave ? 'text-gray-400 cursor-not-allowed' : 'cursor-pointer'}`}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!onLeave) toggleTechnician(tech.email);
                      }}
                    >
                      {tech.display_name || tech.full_name}
                      {onLeave && <span className="text-xs text-gray-500 ml-2">(On Leave)</span>}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}