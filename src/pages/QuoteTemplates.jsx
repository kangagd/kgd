import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Edit2, Trash2, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuoteTemplateForm from "../components/quotes/QuoteTemplateForm";

export default function QuoteTemplates() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['quoteTemplates'],
    queryFn: () => base44.entities.QuoteTemplate.list('-sort_order')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QuoteTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteTemplates'] });
      setShowForm(false);
      setEditingTemplate(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuoteTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteTemplates'] });
      setShowForm(false);
      setEditingTemplate(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QuoteTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteTemplates'] });
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: (template) => base44.entities.QuoteTemplate.create({
      ...template,
      name: `${template.name} (Copy)`,
      id: undefined,
      created_date: undefined,
      updated_date: undefined
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteTemplates'] });
    }
  });

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !searchTerm || 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
    return matchesSearch && matchesCategory && t.is_active;
  });

  const handleSubmit = (data) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this template?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDuplicate = (template) => {
    duplicateMutation.mutate(template);
  };

  if (showForm) {
    return (
      <QuoteTemplateForm
        template={editingTemplate}
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowForm(false);
          setEditingTemplate(null);
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    );
  }

  const categories = ["all", "Service", "Product", "Labor", "Materials", "Other"];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Quote Templates</h1>
          <p className="text-sm text-[#6B7280] mt-1">Reusable items for faster quote creation</p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates..."
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
        <TabsList>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat === "all" ? "All" : cat}
              {cat !== "all" && (
                <span className="ml-2 text-xs bg-[#E5E7EB] px-1.5 py-0.5 rounded">
                  {templates.filter(t => t.category === cat && t.is_active).length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-[#E5E7EB] rounded mb-2" />
                <div className="h-3 bg-[#E5E7EB] rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-[#E5E7EB]">
          <p className="text-[#6B7280] mb-4">No templates found</p>
          <Button
            onClick={() => setShowForm(true)}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Template
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="border border-[#E5E7EB] hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#111827] mb-1">{template.name}</h3>
                    <span className="text-xs bg-[#F3F4F6] text-[#6B7280] px-2 py-0.5 rounded">
                      {template.category}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(template)}
                      className="h-7 w-7"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDuplicate(template)}
                      className="h-7 w-7"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(template.id)}
                      className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {template.description && (
                  <p className="text-sm text-[#6B7280] mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm">
                  <div className="text-[#6B7280]">
                    {template.default_quantity} {template.unit_label}
                  </div>
                  <div className="text-lg font-bold text-[#111827]">
                    ${template.unit_price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}