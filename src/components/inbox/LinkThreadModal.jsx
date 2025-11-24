import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Sparkles, Loader2, Check, X, FolderKanban, Briefcase } from "lucide-react";

export default function LinkThreadModal({ 
  open, 
  onClose, 
  linkType, 
  onLinkProject, 
  onLinkJob,
  thread,
  existingProjectIds = [],
  existingJobIds = []
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState(linkType || 'project');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date'),
    enabled: open
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.list('-updated_date'),
    enabled: open
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: open
  });

  // Get AI suggestions when modal opens
  useEffect(() => {
    if (open && thread) {
      fetchAISuggestions();
    }
  }, [open, thread?.id]);

  const fetchAISuggestions = async () => {
    if (!thread) return;
    setLoadingAI(true);
    try {
      // Extract keywords from email
      const emailContent = `Subject: ${thread.subject}\nFrom: ${thread.from_address}\nSnippet: ${thread.last_message_snippet || ''}`;
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this email and extract key information to match with projects/jobs:
${emailContent}

Extract:
1. Customer name (if mentioned)
2. Address or location (if mentioned)
3. Product type (garage door, gate, roller shutter)
4. Job type (repair, install, service, quote, maintenance)
5. Any reference numbers

Return as JSON:`,
        response_json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string" },
            address: { type: "string" },
            product_type: { type: "string" },
            job_type: { type: "string" },
            reference_numbers: { type: "array", items: { type: "string" } }
          }
        }
      });

      // Find matching projects and jobs based on AI extraction
      const suggestions = [];
      
      // Match by customer name
      if (response.customer_name) {
        const matchingProjects = projects.filter(p => 
          p.customer_name?.toLowerCase().includes(response.customer_name.toLowerCase()) ||
          p.customer_email?.toLowerCase() === thread.from_address?.toLowerCase()
        ).slice(0, 3);
        
        const matchingJobs = jobs.filter(j => 
          j.customer_name?.toLowerCase().includes(response.customer_name.toLowerCase()) ||
          j.customer_email?.toLowerCase() === thread.from_address?.toLowerCase()
        ).slice(0, 3);

        suggestions.push(...matchingProjects.map(p => ({ type: 'project', item: p, reason: 'Customer match' })));
        suggestions.push(...matchingJobs.map(j => ({ type: 'job', item: j, reason: 'Customer match' })));
      }

      // Match by email address
      const emailMatchProjects = projects.filter(p => 
        p.customer_email?.toLowerCase() === thread.from_address?.toLowerCase() &&
        !suggestions.find(s => s.type === 'project' && s.item.id === p.id)
      ).slice(0, 2);
      
      const emailMatchJobs = jobs.filter(j => 
        j.customer_email?.toLowerCase() === thread.from_address?.toLowerCase() &&
        !suggestions.find(s => s.type === 'job' && s.item.id === j.id)
      ).slice(0, 2);

      suggestions.push(...emailMatchProjects.map(p => ({ type: 'project', item: p, reason: 'Email match' })));
      suggestions.push(...emailMatchJobs.map(j => ({ type: 'job', item: j, reason: 'Email match' })));

      // Match by address
      if (response.address) {
        const addressMatchProjects = projects.filter(p => 
          p.address?.toLowerCase().includes(response.address.toLowerCase()) &&
          !suggestions.find(s => s.type === 'project' && s.item.id === p.id)
        ).slice(0, 2);
        
        const addressMatchJobs = jobs.filter(j => 
          j.address?.toLowerCase().includes(response.address.toLowerCase()) &&
          !suggestions.find(s => s.type === 'job' && s.item.id === j.id)
        ).slice(0, 2);

        suggestions.push(...addressMatchProjects.map(p => ({ type: 'project', item: p, reason: 'Address match' })));
        suggestions.push(...addressMatchJobs.map(j => ({ type: 'job', item: j, reason: 'Address match' })));
      }

      setAiSuggestions(suggestions.slice(0, 6));
    } catch (error) {
      console.error('AI suggestion error:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const activeProjects = projects.filter(p => !p.deleted_at);
  const activeJobs = jobs.filter(j => !j.deleted_at);

  const filteredProjects = activeProjects.filter(item => 
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.address?.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50);

  const filteredJobs = activeJobs.filter(item =>
    item.job_number?.toString().includes(searchTerm) ||
    item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.address?.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 50);

  const toggleSelection = (type, item) => {
    const key = `${type}-${item.id}`;
    setSelectedItems(prev => {
      const exists = prev.find(s => s.key === key);
      if (exists) {
        return prev.filter(s => s.key !== key);
      }
      return [...prev, { key, type, item }];
    });
  };

  const isSelected = (type, id) => selectedItems.find(s => s.key === `${type}-${id}`);
  const isAlreadyLinked = (type, id) => {
    if (type === 'project') return existingProjectIds.includes(id);
    return existingJobIds.includes(id);
  };

  const handleConfirm = () => {
    const projectsToLink = selectedItems.filter(s => s.type === 'project');
    const jobsToLink = selectedItems.filter(s => s.type === 'job');

    if (projectsToLink.length > 0) {
      onLinkProject(
        projectsToLink.map(p => p.item.id),
        projectsToLink.map(p => p.item.title)
      );
    }
    if (jobsToLink.length > 0) {
      onLinkJob(
        jobsToLink.map(j => j.item.id),
        jobsToLink.map(j => j.item.job_number)
      );
    }
    
    setSelectedItems([]);
    onClose();
  };

  const renderItem = (type, item, reason = null) => {
    const selected = isSelected(type, item.id);
    const alreadyLinked = isAlreadyLinked(type, item.id);

    return (
      <div
        key={`${type}-${item.id}`}
        onClick={() => !alreadyLinked && toggleSelection(type, item)}
        className={`p-4 border rounded-lg transition-all ${
          alreadyLinked 
            ? 'border-green-200 bg-green-50 cursor-not-allowed'
            : selected
              ? 'border-[#FAE008] bg-[#FAE008]/10 cursor-pointer'
              : 'border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#FAE008] cursor-pointer'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {type === 'project' ? (
                <FolderKanban className="w-4 h-4 text-purple-600 flex-shrink-0" />
              ) : (
                <Briefcase className="w-4 h-4 text-blue-600 flex-shrink-0" />
              )}
              <h4 className="text-[14px] font-semibold text-[#111827] truncate">
                {type === 'project' ? item.title : `Job #${item.job_number}`}
              </h4>
              {reason && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">
                  {reason}
                </Badge>
              )}
            </div>
            <p className="text-[13px] text-[#4B5563] truncate mt-1">
              {item.customer_name}
            </p>
            {item.address && (
              <p className="text-[12px] text-[#6B7280] truncate">{item.address}</p>
            )}
            {type === 'project' && item.status && (
              <Badge variant="secondary" className="mt-2 text-[11px]">
                {item.status}
              </Badge>
            )}
          </div>
          <div className="flex-shrink-0 ml-2">
            {alreadyLinked ? (
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            ) : selected ? (
              <div className="w-6 h-6 rounded-full bg-[#FAE008] flex items-center justify-center">
                <Check className="w-4 h-4 text-[#111827]" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-[#E5E7EB]" />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold">
            Link Email to Projects & Jobs
          </DialogTitle>
        </DialogHeader>

        {/* AI Suggestions */}
        {(loadingAI || aiSuggestions.length > 0) && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200/50">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-[14px] font-semibold text-[#111827]">AI Suggestions</span>
              {loadingAI && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
            </div>
            {aiSuggestions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {aiSuggestions.map((suggestion) => (
                  <div key={`ai-${suggestion.type}-${suggestion.item.id}`}>
                    {renderItem(suggestion.type, suggestion.item, suggestion.reason)}
                  </div>
                ))}
              </div>
            ) : !loadingAI && (
              <p className="text-[13px] text-[#6B7280]">No automatic matches found</p>
            )}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder="Search projects and jobs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="project" className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4" />
              Projects ({filteredProjects.length})
            </TabsTrigger>
            <TabsTrigger value="job" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Jobs ({filteredJobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="project" className="flex-1 overflow-y-auto space-y-2 mt-3">
            {filteredProjects.length === 0 ? (
              <p className="text-center text-[#4B5563] py-8">No projects found</p>
            ) : (
              filteredProjects.map(item => renderItem('project', item))
            )}
          </TabsContent>

          <TabsContent value="job" className="flex-1 overflow-y-auto space-y-2 mt-3">
            {filteredJobs.length === 0 ? (
              <p className="text-center text-[#4B5563] py-8">No jobs found</p>
            ) : (
              filteredJobs.map(item => renderItem('job', item))
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t border-[#E5E7EB] pt-4">
          {selectedItems.length > 0 && (
            <div className="flex-1 flex items-center gap-2 text-[13px] text-[#4B5563]">
              <span>{selectedItems.length} selected</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedItems([])}
                className="h-7 px-2"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedItems.length === 0}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            Link Selected ({selectedItems.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}