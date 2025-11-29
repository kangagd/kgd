import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, AlertTriangle, Briefcase, Building2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import EntityModal from "../components/common/EntityModal";
import ContractDetails from "../components/contracts/ContractDetails";
import ContractForm from "../components/contracts/ContractForm";
import { createPageUrl } from "@/utils";
import EntityPageLayout from "../components/common/EntityPageLayout";
import EntityCard from "../components/common/EntityCard";
import { ContractStatusBadge } from "../components/common/StatusBadge";

export default function Contracts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const data = await base44.entities.Contract.list('-created_at');
      // Fetch stats for each contract
      const statsPromises = data.map(async (contract) => {
        const stations = await base44.entities.Customer.filter({ contract_id: contract.id });
        const jobs = await base44.entities.Job.filter({ contract_id: contract.id, status: { $nin: ['Completed', 'Cancelled'] } });
        return {
          ...contract,
          stationCount: stations.length,
          openJobCount: jobs.length
        };
      });
      return Promise.all(statsPromises);
    }
  });

  const filteredContracts = contracts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.contract_type && c.contract_type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contract.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowForm(false);
      setEditingContract(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (showForm) {
    return (
      <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <ContractForm
            contract={editingContract}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingContract(null);
            }}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      </div>
    );
  }

  if (selectedContract) {
    return (
      <div className="bg-[#ffffff] min-h-screen">
        <ContractDetails 
          contract={selectedContract} 
          onClose={() => setSelectedContract(null)}
          onEdit={() => {
            setEditingContract(selectedContract);
            setShowForm(true);
            setSelectedContract(null);
          }}
        />
      </div>
    );
  }

  return (
    <EntityPageLayout
      title="Contracts"
      subtitle="Manage service contracts and SLAs"
      actions={
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Contract
        </Button>
      }
    >
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder="Search contracts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-3 border border-[#E5E7EB] rounded-lg w-full md:w-96"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading contracts...</div>
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No contracts found</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredContracts.map((contract) => (
              <EntityCard
                key={contract.id}
                onClick={() => setSelectedContract(contract)}
              >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-[#111827]">{contract.name}</h3>
                        <ContractStatusBadge value={contract.status} />
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-[#6B7280] mt-2">
                        <div className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {contract.organisation_id ? 'Linked Organisation' : 'No Organisation'}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {contract.contract_type}
                        </div>
                        {contract.start_date && (
                          <div>
                            {format(parseISO(contract.start_date), 'MMM yyyy')} - {contract.end_date ? format(parseISO(contract.end_date), 'MMM yyyy') : 'Ongoing'}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-bold text-[#111827] text-lg">{contract.stationCount || 0}</p>
                        <p className="text-[#6B7280]">Stations</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-[#111827] text-lg">{contract.openJobCount || 0}</p>
                        <p className="text-[#6B7280]">Open Jobs</p>
                      </div>
                      {contract.sla_response_time_hours && (
                        <div className="text-center">
                          <p className="font-bold text-[#111827] text-lg">{contract.sla_response_time_hours}h</p>
                          <p className="text-[#6B7280]">SLA</p>
                        </div>
                      )}
                    </div>
                  </div>
              </EntityCard>
            ))}
          </div>
        )}
    </EntityPageLayout>
  );
}