import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";

export default function LinkThreadModal({ open, onClose, linkType, onLinkProject, onLinkJob }) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date'),
    enabled: linkType === 'project'
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.list('-updated_date'),
    enabled: linkType === 'job'
  });

  const isProject = linkType === 'project';
  const items = isProject ? projects.filter(p => !p.deleted_at) : jobs.filter(j => !j.deleted_at);

  const filteredItems = items.filter(item => {
    if (isProject) {
      return (
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      return (
        item.job_number?.toString().includes(searchTerm) ||
        item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.address?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  }).slice(0, 50);

  const handleSelect = (item) => {
    if (isProject) {
      onLinkProject(item.id, item.title);
    } else {
      onLinkJob(item.id, item.job_number);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Link to {isProject ? 'Project' : 'Job'}
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder={`Search ${isProject ? 'projects' : 'jobs'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredItems.length === 0 ? (
            <p className="text-center text-[#4B5563] py-8">
              No {isProject ? 'projects' : 'jobs'} found
            </p>
          ) : (
            filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className="p-4 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] hover:border-[#FAE008] cursor-pointer transition-colors"
              >
                <h4 className="text-[14px] font-semibold text-[#111827] mb-1">
                  {isProject ? item.title : `Job #${item.job_number}`}
                </h4>
                <p className="text-[13px] text-[#4B5563]">
                  {item.customer_name}
                </p>
                {!isProject && item.address && (
                  <p className="text-[12px] text-[#6B7280] mt-1">{item.address}</p>
                )}
                {isProject && item.status && (
                  <span className="inline-block mt-2 text-[11px] bg-[#F3F4F6] text-[#4B5563] px-2 py-1 rounded">
                    {item.status}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}