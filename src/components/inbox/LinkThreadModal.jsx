import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { devLog } from "@/components/utils/devLog";

export default function LinkThreadModal({ 
  open, 
  onClose, 
  onLinkProject, 
  onLinkContract,
  onUnlink,
  currentlyLinkedType,
  currentlyLinkedTitle
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [linkType, setLinkType] = useState('project'); // 'project' or 'contract'

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date'),
    enabled: linkType === 'project'
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-updated_date'),
    enabled: linkType === 'contract'
  });

  const isProject = linkType === 'project';
  const isContract = linkType === 'contract';
  const items = isProject 
    ? projects.filter(p => !p.deleted_at) 
    : isContract 
      ? contracts 
      : [];

  const filteredItems = items.filter(item => {
    const search = searchTerm.toLowerCase();
    if (isProject) {
      return (
        item.title?.toLowerCase().includes(search) ||
        item.customer_name?.toLowerCase().includes(search)
      );
    } else if (isContract) {
      return (
        item.name?.toLowerCase().includes(search) ||
        item.contract_type?.toLowerCase().includes(search) ||
        item.status?.toLowerCase().includes(search) ||
        item.organisation_name?.toLowerCase().includes(search)
      );
    }
    return false;
  }).slice(0, 50);

  const handleSelect = async (item) => {
    try {
      if (isProject) {
        devLog('Linking to project:', item.id, item.title);
        await onLinkProject(item.id);
      } else if (isContract) {
        devLog('Linking to contract:', item.id, item.name);
        await onLinkContract(item.id);
      }
    } catch (error) {
      devLog('Error in handleSelect:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Link Email Thread
          </DialogTitle>
        </DialogHeader>

        {/* Link Type Selector */}
        <div className="flex gap-2 p-1 bg-[#F3F4F6] rounded-lg mb-4">
          <button
            onClick={() => {
              setLinkType('project');
              setSearchTerm('');
            }}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              linkType === 'project'
                ? 'bg-white text-[#111827] shadow-sm'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Link to Project
          </button>
          <button
            onClick={() => {
              setLinkType('contract');
              setSearchTerm('');
            }}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              linkType === 'contract'
                ? 'bg-white text-[#111827] shadow-sm'
                : 'text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            Link to Contract
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder={`Search ${isProject ? 'projects' : 'contracts'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredItems.length === 0 ? (
            <p className="text-center text-[#4B5563] py-8">
              No {isProject ? 'projects' : 'contracts'} found
            </p>
          ) : (
            filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className="p-4 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] hover:border-[#FAE008] cursor-pointer transition-colors"
              >
                <h4 className="text-[14px] font-semibold text-[#111827] mb-1">
                  {isProject ? item.title : item.name}
                </h4>
                <p className="text-[13px] text-[#4B5563]">
                  {isProject ? item.customer_name : item.organisation_name}
                </p>
                {isContract && (
                  <div className="flex items-center gap-2 mt-2">
                    {item.contract_type && (
                      <span className="text-[11px] bg-[#F3F4F6] text-[#4B5563] px-2 py-1 rounded">
                        {item.contract_type}
                      </span>
                    )}
                    {item.status && (
                      <span className="text-[11px] bg-[#F3F4F6] text-[#4B5563] px-2 py-1 rounded">
                        {item.status}
                      </span>
                    )}
                  </div>
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

        <div className="flex justify-between gap-3 pt-4 border-t border-[#E5E7EB]">
          {onUnlink && currentlyLinkedType && (
            <Button 
              variant="outline" 
              onClick={onUnlink}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Unlink from {currentlyLinkedType === 'project' ? 'Project' : 'Contract'}
            </Button>
          )}
          <div className="flex gap-3 ml-auto">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}