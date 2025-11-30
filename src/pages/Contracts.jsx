import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import ContractDetails from "../components/contracts/ContractDetails";
import ContractForm from "../components/contracts/ContractForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Contracts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchParams, setSearchParams] = useSearchParams();
  
  const queryClient = useQueryClient();

  // Handle URL params for deep linking
  React.useEffect(() => {
    const contractId = searchParams.get("contractId");
    if (contractId && !selectedContract && !showForm) {
       base44.entities.Contract.get(contractId).then(contract => {
           if(contract) setSelectedContract(contract);
       });
    }
  }, [searchParams]);

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
          openJobCount: jobs.length,
          organisation_name: contract.organisation_name // assuming cached or joined in future, currently might need fetch if not present
        };
      });
      return Promise.all(statsPromises);
    }
  });

  // Fetch organisations for filter mapping (optional optimization: fetch only relevant)
  const { data: organisations = [] } = useQuery({
     queryKey: ['organisations'],
     queryFn: () => base44.entities.Organisation.list()
  });
  
  const orgMap = useMemo(() => {
      return organisations.reduce((acc, org) => {
          acc[org.id] = org.name;
          return acc;
      }, {});
  }, [organisations]);


  const filteredContracts = contracts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (orgMap[c.organisation_id] || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesType = typeFilter === "all" || c.contract_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

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
      // Also update selectedContract if it's open
      if (selectedContract && selectedContract.id === id) {
         setSelectedContract(prev => ({ ...prev, ...data }));
      }
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
          onClose={() => {
              setSelectedContract(null);
              setSearchParams({});
          }}
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
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Contracts</h1>
            <p className="text-sm text-[#4B5563] mt-1">Manage service contracts and SLAs</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Contract
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 border border-[#E5E7EB] rounded-lg w-full"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="On Hold">On Hold</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Service & Repair">Service & Repair</SelectItem>
              <SelectItem value="Maintenance Program">Maintenance Program</SelectItem>
              <SelectItem value="Mixed">Mixed</SelectItem>
              <SelectItem value="Supply + Install">Supply + Install</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading contracts...</div>
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No contracts found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Contract Name</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="text-center">Sites</TableHead>
                        <TableHead className="text-center">Open Jobs</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredContracts.map((contract) => (
                        <TableRow 
                            key={contract.id} 
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => setSelectedContract(contract)}
                        >
                            <TableCell className="font-medium text-[#111827]">{contract.name}</TableCell>
                            <TableCell>{orgMap[contract.organisation_id] || "Unknown"}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className="bg-slate-50 font-normal">
                                    {contract.contract_type}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge className={
                                    contract.status === 'Active' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 
                                    contract.status === 'Expired' ? 'bg-red-100 text-red-800 hover:bg-red-200' : 
                                    'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                }>
                                    {contract.status}
                                </Badge>
                            </TableCell>
                            <TableCell>{contract.start_date ? format(parseISO(contract.start_date), 'MMM d, yyyy') : '-'}</TableCell>
                            <TableCell>{contract.end_date ? format(parseISO(contract.end_date), 'MMM d, yyyy') : 'Ongoing'}</TableCell>
                            <TableCell className="text-center font-semibold">{contract.stationCount || 0}</TableCell>
                            <TableCell className="text-center font-semibold text-blue-600">{contract.openJobCount || 0}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
             </Table>
          </div>
        )}
      </div>
    </div>
  );
}