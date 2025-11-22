import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Link as LinkIcon, 
  X, 
  Plus, 
  ExternalLink, 
  FolderKanban, 
  Briefcase, 
  User,
  Search
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function LinkedEntitiesPanel({ thread, message }) {
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [linkType, setLinkType] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: linkedEntities = [] } = useQuery({
    queryKey: ['linkedEntities', thread?.id, message?.id],
    queryFn: async () => {
      const filters = {};
      if (message?.id) filters.email_message_id = message.id;
      else if (thread?.id) filters.email_thread_id = thread.id;
      return base44.entities.LinkedEntity.filter(filters);
    },
    enabled: !!(thread?.id || message?.id)
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-search'],
    queryFn: () => base44.entities.Project.list('-created_date', 50),
    enabled: linkType === 'Project'
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-search'],
    queryFn: () => base44.entities.Job.list('-created_date', 50),
    enabled: linkType === 'Job'
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-search'],
    queryFn: () => base44.entities.Customer.list('name', 50),
    enabled: linkType === 'Customer'
  });

  const createLinkMutation = useMutation({
    mutationFn: (data) => base44.entities.LinkedEntity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedEntities'] });
      setIsAddingLink(false);
      setLinkType(null);
      setSearchTerm("");
      toast.success('Entity linked');
    }
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id) => base44.entities.LinkedEntity.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedEntities'] });
      toast.success('Link removed');
    }
  });

  const handleAddLink = (entity) => {
    const data = {
      entity_type: linkType,
      entity_id: entity.id,
      entity_name: linkType === 'Job' ? `Job #${entity.job_number}` : entity.title || entity.name,
      link_type: 'reference'
    };

    if (message?.id) {
      data.email_message_id = message.id;
      data.email_thread_id = thread.id;
    } else if (thread?.id) {
      data.email_thread_id = thread.id;
    }

    createLinkMutation.mutate(data);
  };

  const getEntityIcon = (type) => {
    if (type === 'Project') return FolderKanban;
    if (type === 'Job') return Briefcase;
    if (type === 'Customer') return User;
    return LinkIcon;
  };

  const getEntityUrl = (type, id) => {
    if (type === 'Project') return createPageUrl("Projects") + `?projectId=${id}`;
    if (type === 'Job') return createPageUrl("Jobs") + `?jobId=${id}`;
    if (type === 'Customer') return createPageUrl("Customers") + `?customerId=${id}`;
    return '#';
  };

  const getSearchResults = () => {
    const term = searchTerm.toLowerCase();
    if (linkType === 'Project') {
      return projects.filter(p => 
        p.title?.toLowerCase().includes(term) || 
        p.customer_name?.toLowerCase().includes(term)
      );
    }
    if (linkType === 'Job') {
      return jobs.filter(j => 
        j.job_number?.toString().includes(term) || 
        j.customer_name?.toLowerCase().includes(term) ||
        j.address?.toLowerCase().includes(term)
      );
    }
    if (linkType === 'Customer') {
      return customers.filter(c => 
        c.name?.toLowerCase().includes(term) || 
        c.email?.toLowerCase().includes(term)
      );
    }
    return [];
  };

  return (
    <div className="border-t border-[#E5E7EB] pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-[#111827]">Linked To</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddingLink(true)}
          className="h-7 text-[12px]"
        >
          <Plus className="w-3 h-3 mr-1" />
          Link
        </Button>
      </div>

      {linkedEntities.length === 0 ? (
        <p className="text-[12px] text-[#6B7280] italic">No linked entities</p>
      ) : (
        <div className="space-y-2">
          {linkedEntities.map((link) => {
            const Icon = getEntityIcon(link.entity_type);
            return (
              <div key={link.id} className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="flex-1 justify-start h-auto py-2 px-3"
                >
                  <a
                    href={getEntityUrl(link.entity_type, link.entity_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[11px] text-[#6B7280] uppercase font-semibold">
                        {link.entity_type}
                      </p>
                      <p className="text-[13px] text-[#111827] font-medium truncate">{link.entity_name}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteLinkMutation.mutate(link.id)}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isAddingLink} onOpenChange={setIsAddingLink}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Email to Entity</DialogTitle>
          </DialogHeader>
          
          {!linkType ? (
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setLinkType('Project')}
              >
                <FolderKanban className="w-4 h-4 mr-2" />
                Link to Project
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setLinkType('Job')}
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Link to Job
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setLinkType('Customer')}
              >
                <User className="w-4 h-4 mr-2" />
                Link to Customer
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <Input
                  placeholder={`Search ${linkType}s...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {getSearchResults().slice(0, 20).map((entity) => (
                  <Button
                    key={entity.id}
                    variant="ghost"
                    className="w-full justify-start h-auto py-2 px-3"
                    onClick={() => handleAddLink(entity)}
                  >
                    <div className="text-left">
                      <p className="text-[13px] font-medium text-[#111827]">
                        {linkType === 'Job' ? `Job #${entity.job_number}` : entity.title || entity.name}
                      </p>
                      {linkType !== 'Customer' && entity.customer_name && (
                        <p className="text-[11px] text-[#6B7280]">{entity.customer_name}</p>
                      )}
                      {linkType === 'Job' && entity.address && (
                        <p className="text-[11px] text-[#6B7280]">{entity.address}</p>
                      )}
                    </div>
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => { setLinkType(null); setSearchTerm(""); }}
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}