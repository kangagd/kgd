import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, Search } from "lucide-react";

export default function BulkLinkProjectModal({ open, onClose, onLink, selectedCount }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", searchTerm],
    queryFn: async () => {
      const allProjects = await base44.entities.Project.list("-updated_date", 50);
      if (!searchTerm) return allProjects;
      
      const search = searchTerm.toLowerCase();
      return allProjects.filter(p => 
        p.title?.toLowerCase().includes(search) ||
        p.project_number?.toString().includes(search) ||
        p.customer_name?.toLowerCase().includes(search)
      );
    },
    enabled: open,
  });

  const handleLink = () => {
    if (selectedProject) {
      onLink(selectedProject.id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link {selectedCount} threads to project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#6B7280]" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8 text-[#6B7280] text-sm">
                No projects found
              </div>
            ) : (
              projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className={`w-full px-4 py-3 text-left border-b hover:bg-[#F9FAFB] transition-colors ${
                    selectedProject?.id === project.id ? 'bg-[#FAE008]/10' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-[#6B7280]">
                          #{project.project_number}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {project.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#111827] mb-1">
                        {project.title}
                      </p>
                      {project.customer_name && (
                        <p className="text-xs text-[#6B7280]">{project.customer_name}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedProject}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            Link to Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}