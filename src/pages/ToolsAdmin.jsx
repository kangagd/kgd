import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import BackButton from "../components/common/BackButton";
import { createPageUrl } from "@/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Loader2, Check, AlertCircle, Search, Filter, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import LocationBadge from "@/components/common/LocationBadge";

export default function ToolsAdmin() {
  const queryClient = useQueryClient();

  const { data: tools = [], isLoading: toolsLoading } = useQuery({
    queryKey: ["tool-items"],
    queryFn: () => base44.entities.ToolItem.list("name", 1000),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-for-tools-admin"],
    queryFn: () => base44.entities.Vehicle.list("name", 100),
  });

  const [newTool, setNewTool] = useState({
    name: "",
    category: "",
    default_quantity_required: 1,
    notes: "",
  });

  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });

  const createToolMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.ToolItem.create({
        name: newTool.name,
        category: newTool.category,
        default_quantity_required: Number(newTool.default_quantity_required) || 0,
        notes: newTool.notes || "",
        is_active: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["tool-items"]);
      setNewTool({
        name: "",
        category: "",
        default_quantity_required: 1,
        notes: "",
      });
      toast.success("Tool created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create tool: ${error.message}`);
    }
  });

  const updateToolMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.ToolItem.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["tool-items"]);
      toast.success("Tool updated");
    },
  });

  const deleteToolMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.ToolItem.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["tool-items"]);
      toast.success("Tool deleted");
    },
  });

  const categories = [...new Set(tools.map(t => t.category).filter(Boolean))].sort();

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (tool.notes && tool.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === "all" || tool.category === filterCategory;
    const matchesStatus = filterStatus === "all" || 
                          (filterStatus === "active" ? tool.is_active : !tool.is_active);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const sortedTools = [...filteredTools].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    // Handle string vs number comparison safely
    if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === "asc" 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
    }
    
    if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  };

  const applyTemplateMutation = useMutation({
    mutationFn: async () => {
      const activeTools = (tools || []).filter((t) => t.is_active);
      let createdCount = 0;

      // Process vehicles sequentially to avoid overwhelming the API if there are many
      for (const vehicle of vehicles || []) {
        if (!vehicle.id) continue;

        // Fetch existing tools for this vehicle to ensure idempotency
        const existingVehicleTools = await base44.entities.VehicleTool.filter({
            vehicle_id: vehicle.id
        }, "id", 1000); // Assuming max 1000 tools per vehicle

        const existingToolIds = new Set(existingVehicleTools.map(vt => vt.tool_item_id));

        const toolsToCreate = [];
        for (const tool of activeTools) {
          if (!tool.id) continue;
          if (existingToolIds.has(tool.id)) continue;

          const required = tool.default_quantity_required ?? 0;
          toolsToCreate.push({
            vehicle_id: vehicle.id,
            tool_item_id: tool.id,
            location: tool.category || "Other",
            quantity_required: required,
            quantity_on_hand: required, // Defaulting to full stock as per template logic
            notes: "",
          });
        }

        if (toolsToCreate.length > 0) {
            // Create sequentially or in small batches
            await Promise.all(toolsToCreate.map(t => base44.entities.VehicleTool.create(t)));
            createdCount += toolsToCreate.length;
        }
      }
      return createdCount;
    },
    onSuccess: (count) => {
      toast.success(`Template applied. Created ${count} new vehicle tool entries.`);
    },
    onError: (error) => {
      toast.error(`Failed to apply template: ${error.message}`);
    }
  });

  if (toolsLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8 text-gray-400" /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <BackButton to={createPageUrl("Dashboard")} />
      </div>
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Wrench className="w-6 h-6 text-[#FAE008]" />
                Tools Admin
            </h1>
            <p className="text-gray-500 text-sm mt-1">Manage tool templates and sync to fleet</p>
        </div>
        <Button
          variant="outline"
          onClick={() => applyTemplateMutation.mutate()}
          disabled={applyTemplateMutation.isLoading || !tools.length || !vehicles.length}
          className="border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-950"
        >
          {applyTemplateMutation.isLoading ? (
            <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying to {vehicles.length} vehicles...
            </>
          ) : (
            "Apply template to all vehicles"
          )}
        </Button>
      </div>

      {/* Quick create form */}
      <div className="border border-gray-200 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-1 h-4 bg-[#FAE008] rounded-full"></div>
            Add New Tool Template
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Tool Name</label>
            <Input
              value={newTool.name}
              onChange={(e) => setNewTool((t) => ({ ...t, name: e.target.value }))}
              placeholder="e.g. Cordless Drill"
              className="h-9"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Category / Location</label>
            <Input
              value={newTool.category}
              onChange={(e) => setNewTool((t) => ({ ...t, category: e.target.value }))}
              placeholder="e.g. Power Tools"
              className="h-9"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Default Qty</label>
            <Input
              type="number"
              min={0}
              value={newTool.default_quantity_required}
              onChange={(e) =>
                setNewTool((t) => ({
                  ...t,
                  default_quantity_required: e.target.value,
                }))
              }
              className="h-9"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Notes</label>
            <Input
              value={newTool.notes}
              onChange={(e) => setNewTool((t) => ({ ...t, notes: e.target.value }))}
              placeholder="Optional details"
              className="h-9"
            />
          </div>
          <div className="md:col-span-1">
            <Button
              size="sm"
              className="w-full bg-[#FAE008] hover:bg-[#E5CF07] text-black h-9"
              onClick={() => createToolMutation.mutate()}
              disabled={!newTool.name || createToolMutation.isLoading}
            >
              {createToolMutation.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
                placeholder="Search tools..."
                className="pl-9 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-9 w-[160px]">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Filter className="w-3.5 h-3.5" />
                        <SelectValue placeholder="Category" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-[130px]">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Check className="w-3.5 h-3.5" />
                        <SelectValue placeholder="Status" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
            </Select>

            <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-2"
                onClick={() => handleSort('name')}
            >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="text-xs">Name</span>
            </Button>
        </div>
      </div>

      {/* Tool list */}
      <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">Tool Templates ({filteredTools.length})</h2>
            <div className="text-xs text-gray-500">
                {filteredTools.filter(t => t.is_active).length} active
            </div>
        </div>
        {!sortedTools.length ? (
          <div className="p-8 text-center text-gray-500 italic">
              {tools.length === 0 ? "No tools defined yet. Add one above." : "No tools match your filters."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedTools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-4">
                    <div className="font-medium text-sm text-gray-900">{tool.name}</div>
                    {tool.notes && (
                        <div className="text-xs text-gray-500 truncate">{tool.notes}</div>
                    )}
                  </div>
                  <div className="col-span-3">
                    <LocationBadge location={tool.category} />
                  </div>
                  <div className="col-span-2 text-sm text-gray-600">
                    Qty: {tool.default_quantity_required ?? 0}
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 text-xs ${tool.is_active ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-gray-400 hover:text-gray-500'}`}
                        onClick={() => updateToolMutation.mutate({ id: tool.id, data: { is_active: !tool.is_active } })}
                    >
                        {tool.is_active ? "Active" : "Inactive"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                            if (confirm('Are you sure you want to delete this tool template?')) {
                                deleteToolMutation.mutate(tool.id);
                            }
                        }}
                    >
                        Delete
                    </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}