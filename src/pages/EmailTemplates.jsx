import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Mail, FileText, Trash2, Edit2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactQuill from "react-quill";
import BackButton from "../components/common/BackButton";
import { createPageUrl } from "@/utils";

export default function EmailTemplates() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [intentFilter, setIntentFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    channel: "email",
    intent: "General Response",
    subject: "",
    body: "",
    description: "",
    active: true
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['messageTemplates'],
    queryFn: () => base44.entities.MessageTemplate.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MessageTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] });
      toast.success("Template created successfully");
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MessageTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] });
      toast.success("Template updated successfully");
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MessageTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] });
      toast.success("Template deleted");
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      channel: "email",
      intent: "General Response",
      subject: "",
      body: "",
      description: "",
      active: true
    });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      channel: template.channel,
      intent: template.intent || "General Response",
      subject: template.subject || "",
      body: template.body || "",
      description: template.description || "",
      active: template.active !== false
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !searchTerm || 
      t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChannel = channelFilter === "all" || t.channel === channelFilter;
    const matchesIntent = intentFilter === "all" || t.intent === intentFilter;
    return matchesSearch && matchesChannel && matchesIntent;
  });

  const intentColors = {
    "Quote": "bg-purple-100 text-purple-800",
    "Follow-up": "bg-blue-100 text-blue-800",
    "Appointment Confirmation": "bg-green-100 text-green-800",
    "Job Completion": "bg-emerald-100 text-emerald-800",
    "Invoice": "bg-amber-100 text-amber-800",
    "Supplier Request": "bg-pink-100 text-pink-800",
    "Supplier Order": "bg-indigo-100 text-indigo-800",
    "General Response": "bg-slate-100 text-slate-800",
    "Other": "bg-gray-100 text-gray-800"
  };

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("EmailSettings")} />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#111827]">Email Templates</h1>
            <p className="text-sm text-[#4B5563] mt-1">Create and manage reusable email templates</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] gap-2"
          >
            <Plus className="w-4 h-4" />
            New Template
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={intentFilter} onValueChange={setIntentFilter}>
            <SelectTrigger className="w-full md:w-[220px]">
              <SelectValue placeholder="Intent" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="all">All Intents</SelectItem>
               <SelectItem value="Quote">Quote</SelectItem>
               <SelectItem value="Follow-up">Follow-up</SelectItem>
               <SelectItem value="Appointment Confirmation">Appointment Confirmation</SelectItem>
               <SelectItem value="Job Completion">Job Completion</SelectItem>
               <SelectItem value="Invoice">Invoice</SelectItem>
               <SelectItem value="Supplier Request">Supplier Request</SelectItem>
               <SelectItem value="Supplier Order">Supplier Order</SelectItem>
               <SelectItem value="General Response">General Response</SelectItem>
               <SelectItem value="Other">Other</SelectItem>
             </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-16">
            <Mail className="w-16 h-16 mx-auto text-[#D1D5DB] mb-4" />
            <p className="text-[#6B7280]">
              {searchTerm || channelFilter !== "all" || intentFilter !== "all" 
                ? "No templates match your filters" 
                : "No templates yet. Create your first template to get started."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map(template => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-[16px] font-semibold text-[#111827] truncate">
                        {template.name}
                      </CardTitle>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="outline" className="text-[11px]">
                          {template.channel}
                        </Badge>
                        {template.intent && (
                          <Badge className={`text-[11px] ${intentColors[template.intent] || 'bg-gray-100 text-gray-800'}`}>
                            {template.intent}
                          </Badge>
                        )}
                        {!template.active && (
                          <Badge variant="destructive" className="text-[11px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                        className="h-8 w-8"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Delete this template?')) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {template.description && (
                    <p className="text-[13px] text-[#6B7280] mb-3">{template.description}</p>
                  )}
                  {template.subject && (
                    <div className="mb-2">
                      <span className="text-[12px] font-medium text-[#4B5563]">Subject: </span>
                      <span className="text-[12px] text-[#111827]">{template.subject}</span>
                    </div>
                  )}
                  <div className="text-[12px] text-[#6B7280] line-clamp-3">
                    {template.body?.replace(/<[^>]*>/g, ' ').substring(0, 120)}...
                  </div>
                  {template.variables && template.variables.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                      <span className="text-[11px] text-[#6B7280]">Variables: </span>
                      <span className="text-[11px] text-[#111827]">
                        {template.variables.join(', ')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Template Form Modal */}
        <Dialog open={showForm} onOpenChange={() => !createMutation.isPending && !updateMutation.isPending && resetForm()}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Edit Template" : "Create Template"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[14px] font-medium mb-1.5 block">Template Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Quote Follow-up Email"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[14px] font-medium mb-1.5 block">Channel</label>
                  <Select value={formData.channel} onValueChange={(value) => setFormData({ ...formData, channel: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[14px] font-medium mb-1.5 block">Intent</label>
                  <Select value={formData.intent} onValueChange={(value) => setFormData({ ...formData, intent: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Quote">Quote</SelectItem>
                       <SelectItem value="Follow-up">Follow-up</SelectItem>
                       <SelectItem value="Appointment Confirmation">Appointment Confirmation</SelectItem>
                       <SelectItem value="Job Completion">Job Completion</SelectItem>
                       <SelectItem value="Invoice">Invoice</SelectItem>
                       <SelectItem value="Supplier Request">Supplier Request</SelectItem>
                       <SelectItem value="Supplier Order">Supplier Order</SelectItem>
                       <SelectItem value="General Response">General Response</SelectItem>
                       <SelectItem value="Other">Other</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-[14px] font-medium mb-1.5 block">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="When to use this template"
                />
              </div>

              {formData.channel === "email" && (
                <div>
                  <label className="text-[14px] font-medium mb-1.5 block">Subject Line</label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Use {variables} like {customer_name}, {job_number}"
                  />
                </div>
              )}

              <div>
                <label className="text-[14px] font-medium mb-1.5 block">Message Body</label>
                <div className="text-[12px] text-[#6B7280] mb-2">
                  Available variables: {'{customer_name}, {job_number}, {project_title}, {address}, {scheduled_date}, {technician_name}'}
                </div>
                {formData.channel === "email" ? (
                  <ReactQuill
                    theme="snow"
                    value={formData.body}
                    onChange={(value) => setFormData({ ...formData, body: value })}
                    placeholder="Compose your template message..."
                    className="bg-white rounded-lg [&_.ql-container]:min-h-[200px]"
                  />
                ) : (
                  <Textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Compose your template message..."
                    className="min-h-[200px]"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="active" className="text-[14px] text-[#4B5563]">
                  Active (shown in template selector)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}