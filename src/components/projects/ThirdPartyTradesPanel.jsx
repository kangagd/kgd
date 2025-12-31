import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, CheckCircle2, Circle, Phone, Mail, User, Wrench, ChevronDown } from "lucide-react";
import { AddIconButton } from "@/components/ui/AddIconButton";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const tradeTypeIcons = {
  "Electrician": "⚡",
  "Gate Installer": "🚪",
  "Post Installer / Fabricator": "🔧",
  "Concreter": "🏗️",
  "Builder's Installer": "👷",
  "Other": "🔨"
};

export default function ThirdPartyTradesPanel({ project, onAddTrade }) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedTradeId, setSelectedTradeId] = useState("");

  const [formData, setFormData] = useState({
    trade_type: "Electrician",
    description: "",
    is_required: true,
    is_booked: false,
    applies_to_all_jobs: true,
    applies_to_job_types: [],
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    notes_for_site: ""
  });

  const { data: tradeRequirements = [] } = useQuery({
    queryKey: ['projectTradeRequirements', project?.id],
    queryFn: () => base44.entities.ProjectTradeRequirement.filter({ project_id: project.id }),
    enabled: !!project?.id
  });

  const { data: thirdPartyTrades = [] } = useQuery({
    queryKey: ['thirdPartyTrades'],
    queryFn: () => base44.entities.ThirdPartyTrade.filter({ is_active: true }),
  });

  const createTradeMutation = useMutation({
    mutationFn: async (data) => {
      const newTrade = await base44.entities.ProjectTradeRequirement.create({
        ...data,
        project_id: project.id
      });
      
      // If marked as booked on creation, trigger logistics job
      if (data.is_booked) {
        try {
          await base44.functions.invoke('onTradeRequirementUpdated', {
            tradeId: newTrade.id,
            wasBooked: false,
            isBooked: true
          });
        } catch (error) {
          console.error('Failed to create logistics job:', error);
        }
      }
      
      return newTrade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTradeRequirements', project.id] });
      queryClient.invalidateQueries({ queryKey: ['projectJobs', project.id] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      resetForm();
      toast.success("Trade requirement added");
    },
    onError: (error) => {
      toast.error("Failed to add trade requirement");
      console.error(error);
    }
  });

  const updateTradeMutation = useMutation({
    mutationFn: async ({ id, data, wasBooked }) => {
      await base44.entities.ProjectTradeRequirement.update(id, data);
      
      // Trigger logistics job creation if newly booked
      if (wasBooked !== undefined && !wasBooked && data.is_booked) {
        try {
          await base44.functions.invoke('onTradeRequirementUpdated', {
            tradeId: id,
            wasBooked: wasBooked,
            isBooked: data.is_booked
          });
        } catch (error) {
          console.error('Failed to create logistics job:', error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTradeRequirements', project.id] });
      queryClient.invalidateQueries({ queryKey: ['projectJobs', project.id] });
      queryClient.invalidateQueries({ queryKey: ['allJobs'] });
      resetForm();
      toast.success("Trade requirement updated");
    },
    onError: (error) => {
      toast.error("Failed to update trade requirement");
      console.error(error);
    }
  });

  const deleteTradeMutation = useMutation({
    mutationFn: (id) => base44.entities.ProjectTradeRequirement.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTradeRequirements', project.id] });
      toast.success("Trade requirement removed");
    },
    onError: (error) => {
      toast.error("Failed to remove trade requirement");
      console.error(error);
    }
  });

  const toggleBookedMutation = useMutation({
    mutationFn: async ({ id, isBooked, wasBooked }) => {
      // Update the trade requirement
      await base44.entities.ProjectTradeRequirement.update(id, { is_booked: isBooked });
      
      // Trigger logistics job creation/update if newly booked
      if (!wasBooked && isBooked) {
        try {
          await base44.functions.invoke('onTradeRequirementUpdated', {
            tradeId: id,
            wasBooked: wasBooked,
            isBooked: isBooked
          });
        } catch (error) {
          console.error('Failed to create/update logistics job:', error);
          // Don't fail the whole operation if logistics job creation fails
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTradeRequirements', project.id] });
      queryClient.invalidateQueries({ queryKey: ['projectJobs', project.id] });
      toast.success("Trade requirement updated");
    },
    onError: (error) => {
      toast.error("Failed to update trade requirement");
      console.error(error);
    }
  });

  const resetForm = () => {
    setFormData({
      trade_type: "Electrician",
      description: "",
      is_required: true,
      is_booked: false,
      applies_to_all_jobs: true,
      applies_to_job_types: [],
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      notes_for_site: ""
    });
    setIsAdding(false);
    setEditingId(null);
    setSelectedTradeId("");
  };

  const handleTradeSelection = (tradeId) => {
    setSelectedTradeId(tradeId);
    
    if (tradeId === "custom") {
      // Reset to custom entry
      setFormData({
        ...formData,
        contact_name: "",
        contact_phone: "",
        contact_email: ""
      });
    } else if (tradeId) {
      // Auto-fill from selected trade
      const selectedTrade = thirdPartyTrades.find(t => t.id === tradeId);
      if (selectedTrade) {
        setFormData({
          ...formData,
          trade_type: selectedTrade.type,
          contact_name: selectedTrade.contact_name || "",
          contact_phone: selectedTrade.contact_phone || "",
          contact_email: selectedTrade.contact_email || ""
        });
      }
    }
  };

  const handleSubmit = () => {
    if (editingId) {
      // Find original trade to compare is_booked status
      const originalTrade = tradeRequirements.find(t => t.id === editingId);
      updateTradeMutation.mutate({ 
        id: editingId, 
        data: formData, 
        wasBooked: originalTrade?.is_booked || false 
      });
    } else {
      createTradeMutation.mutate(formData);
    }
  };

  const handleEdit = (trade) => {
    setFormData({
      trade_type: trade.trade_type,
      description: trade.description || "",
      is_required: trade.is_required,
      is_booked: trade.is_booked,
      applies_to_all_jobs: trade.applies_to_all_jobs,
      applies_to_job_types: trade.applies_to_job_types || [],
      contact_name: trade.contact_name || "",
      contact_phone: trade.contact_phone || "",
      contact_email: trade.contact_email || "",
      notes_for_site: trade.notes_for_site || ""
    });
    setEditingId(trade.id);
    setIsAdding(true);
  };

  const requiredTrades = tradeRequirements.filter(t => t.is_required);
  const bookedCount = requiredTrades.filter(t => t.is_booked).length;

  // Expose method to parent for adding trades
  React.useEffect(() => {
    if (onAddTrade) {
      // Make the function available to parent
      onAddTrade.current = () => setIsAdding(true);
    }
  }, [onAddTrade]);

  return (
    <div className="space-y-3">
      {/* Add Trade Button */}
      {!isAdding && (
        <div className="flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(true);
            }}
            className="w-8 h-8 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] flex items-center justify-center text-[#6B7280] hover:text-[#111827] transition-colors"
            title="Add Trade"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {isAdding && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="space-y-2">
              <Label>Select Existing Trade or Create Custom</Label>
              <Select 
                value={selectedTradeId} 
                onValueChange={handleTradeSelection}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a trade..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">➕ Custom Trade</SelectItem>
                  {thirdPartyTrades.map((trade) => (
                    <SelectItem key={trade.id} value={trade.id}>
                      {trade.name} ({trade.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trade Type</Label>
              <Select 
                value={formData.trade_type} 
                onValueChange={(val) => setFormData({ ...formData, trade_type: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Electrician">⚡ Electrician</SelectItem>
                  <SelectItem value="Gate Installer">🚪 Gate Installer</SelectItem>
                  <SelectItem value="Post Installer / Fabricator">🔧 Post Installer / Fabricator</SelectItem>
                  <SelectItem value="Concreter">🏗️ Concreter</SelectItem>
                  <SelectItem value="Builder's Installer">👷 Builder's Installer</SelectItem>
                  <SelectItem value="Other">🔨 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What will they be doing?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                <Label className="text-sm">Required</Label>
                <Switch
                  checked={formData.is_required}
                  onCheckedChange={(val) => setFormData({ ...formData, is_required: val })}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                <Label className="text-sm">Booked</Label>
                <Switch
                  checked={formData.is_booked}
                  onCheckedChange={(val) => setFormData({ ...formData, is_booked: val })}
                />
              </div>
            </div>

            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                <ChevronDown className="w-4 h-4" />
                Contact Details (Optional)
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                <Input
                  placeholder="Contact Name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
                <Input
                  placeholder="Phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-2">
              <Label>Site Notes for Technicians</Label>
              <Textarea
                value={formData.notes_for_site}
                onChange={(e) => setFormData({ ...formData, notes_for_site: e.target.value })}
                placeholder="e.g., Electrician to arrive at 10:30, tech to meet and show controls"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubmit();
                }}
                disabled={createTradeMutation.isPending || updateTradeMutation.isPending}
                className="flex-1 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
              >
                {editingId ? "Update" : "Add"} Trade
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  resetForm();
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Trade Requirements List */}
        {tradeRequirements.length === 0 && !isAdding ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No third-party trades required yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tradeRequirements.map((trade) => (
              <div
                key={trade.id}
                className="bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{tradeTypeIcons[trade.trade_type]}</span>
                    <div>
                      <h4 className="font-semibold text-slate-900">{trade.trade_type}</h4>
                      {trade.description && (
                        <p className="text-xs text-slate-600 mt-0.5">{trade.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookedMutation.mutate({ 
                          id: trade.id, 
                          isBooked: !trade.is_booked,
                          wasBooked: trade.is_booked 
                        });
                      }}
                      className="hover:opacity-70 transition-opacity"
                      title={trade.is_booked ? "Mark as not booked" : "Mark as booked"}
                    >
                      {trade.is_booked ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(trade);
                      }}
                      className="h-7 w-7 text-slate-400 hover:text-slate-700"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this trade requirement?')) {
                          deleteTradeMutation.mutate(trade.id);
                        }
                      }}
                      className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {trade.is_required && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      Required
                    </Badge>
                  )}
                  {trade.is_booked && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      Booked
                    </Badge>
                  )}
                  {!trade.applies_to_all_jobs && trade.applies_to_job_types?.length > 0 && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                      {trade.applies_to_job_types.join(", ")}
                    </Badge>
                  )}
                </div>

                {(trade.contact_name || trade.contact_phone || trade.contact_email) && (
                  <div className="flex flex-wrap gap-3 text-xs text-slate-600 mb-2">
                    {trade.contact_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {trade.contact_name}
                      </span>
                    )}
                    {trade.contact_phone && (
                      <a 
                        href={`tel:${trade.contact_phone}`}
                        className="flex items-center gap-1 hover:text-blue-600"
                      >
                        <Phone className="w-3 h-3" />
                        {trade.contact_phone}
                      </a>
                    )}
                    {trade.contact_email && (
                      <a 
                        href={`mailto:${trade.contact_email}`}
                        className="flex items-center gap-1 hover:text-blue-600"
                      >
                        <Mail className="w-3 h-3" />
                        {trade.contact_email}
                      </a>
                    )}
                  </div>
                )}

                {trade.notes_for_site && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                    <strong>Site Notes:</strong> {trade.notes_for_site}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}