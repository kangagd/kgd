import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Mail, 
  CheckSquare, 
  Calendar, 
  FolderKanban, 
  Briefcase, 
  UserCircle, 
  FileText 
} from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { createPageUrl } from "@/utils";

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  const runCommand = React.useCallback((command) => {
    onOpenChange(false);
    command();
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={() => onOpenChange(false)}
      />
      
      {/* Command Dialog Container */}
      <div className="relative z-50 w-full max-w-lg overflow-hidden rounded-xl border bg-white shadow-2xl transition-all sm:mt-0 mt-16 mx-4">
        <Command className="rounded-xl border-none">
          <CommandInput placeholder="Search pages..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Pages">
              <CommandItem
                onSelect={(_value) => runCommand(() => navigate(createPageUrl("Dashboard")))}
                className="cursor-pointer"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </CommandItem>
              <CommandItem
                onSelect={(_value) => runCommand(() => navigate(createPageUrl("Inbox")))}
                className="cursor-pointer"
              >
                <Mail className="mr-2 h-4 w-4" />
                <span>Inbox</span>
              </CommandItem>
              <CommandItem
                onSelect={(_value) => runCommand(() => navigate(createPageUrl("Tasks")))}
                className="cursor-pointer"
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                <span>Tasks</span>
              </CommandItem>
              <CommandItem
                onSelect={(_value) => runCommand(() => navigate(createPageUrl("Schedule")))}
                className="cursor-pointer"
              >
                <Calendar className="mr-2 h-4 w-4" />
                <span>Schedule</span>
              </CommandItem>
              <CommandItem
                onSelect={(_value) => runCommand(() => navigate(createPageUrl("Projects")))}
                className="cursor-pointer"
              >
                <FolderKanban className="mr-2 h-4 w-4" />
                <span>Projects</span>
              </CommandItem>
              <CommandItem
                onSelect={(_value) => runCommand(() => navigate(createPageUrl("Jobs")))}
                className="cursor-pointer"
              >
                <Briefcase className="mr-2 h-4 w-4" />
                <span>Jobs</span>
              </CommandItem>
              <CommandItem
                onSelect={(_value) => runCommand(() => navigate(createPageUrl("Customers")))}
                className="cursor-pointer"
              >
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Customers</span>
              </CommandItem>
              <CommandItem
                onSelect={(_value) => runCommand(() => navigate(createPageUrl("Contracts")))}
                className="cursor-pointer"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>Contracts</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  );
}