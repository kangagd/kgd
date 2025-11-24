import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, Search, ChevronDown, ChevronRight, FolderPlus, Edit2, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function QuoteItemManager({ quote, quoteItems, quoteSections, onUpdate }) {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionIsOptional, setNewSectionIsOptional] = useState(false);
  const [newSectionOptionGroup, setNewSectionOptionGroup] = useState("");
  const [showNewSectionForm, setShowNewSectionForm] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionData, setEditingSectionData] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemData, setEditingItemData] = useState(null);
  const [newItem, setNewItem] = useState({
    product_id: "",
    section_id: "",
    title: "",
    description: "",
    quantity: 1,
    unit_price: 0,
    unit_label: "each",
    is_optional: false,
    is_selected: true
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list()
  });

  const { data: quoteTemplates = [] } = useQuery({
    queryKey: ['quoteTemplates'],
    queryFn: () => base44.entities.QuoteTemplate.list('-sort_order')
  });

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return priceListItems.filter(p => p.in_inventory !== false);
    const query = searchQuery.toLowerCase();
    return priceListItems.filter(p => 
      p.in_inventory !== false && 
      (p.item.toLowerCase().includes(query) || 
       p.category?.toLowerCase().includes(query) ||
       p.description?.toLowerCase().includes(query))
    );
  }, [priceListItems, searchQuery]);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return quoteTemplates.filter(t => t.is_active);
    const query = searchQuery.toLowerCase();
    return quoteTemplates.filter(t => 
      t.is_active && 
      (t.name.toLowerCase().includes(query) || 
       t.category?.toLowerCase().includes(query) ||
       t.description?.toLowerCase().includes(query))
    );
  }, [quoteTemplates, searchQuery]);

  const createSectionMutation = useMutation({
    mutationFn: (data) => base44.entities.QuoteSection.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteSections', quote.id] });
      setNewSectionName("");
      setNewSectionIsOptional(false);
      setNewSectionOptionGroup("");
      setShowNewSectionForm(false);
    }
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuoteSection.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteSections', quote.id] });
    }
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id) => base44.entities.QuoteSection.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteSections', quote.id] });
      queryClient.invalidateQueries({ queryKey: ['quoteItems', quote.id] });
    }
  });

  const createItemMutation = useMutation({
    mutationFn: (data) => base44.entities.QuoteItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems', quote.id] });
      setNewItem({
        product_id: "",
        section_id: "",
        title: "",
        description: "",
        quantity: 1,
        unit_price: 0,
        unit_label: "each",
        is_optional: false,
        is_selected: true
      });
      setSearchQuery("");
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuoteItem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems', quote.id] });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id) => base44.entities.QuoteItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quoteItems', quote.id] });
    }
  });

  useEffect(() => {
    const selectedSectionIds = new Set(
      quoteSections.filter(s => !s.is_optional || s.is_selected).map(s => s.id)
    );
    
    const items = quoteItems.filter(item => {
      const sectionSelected = !item.section_id || selectedSectionIds.has(item.section_id);
      const itemSelected = !item.is_optional || item.is_selected;
      return sectionSelected && itemSelected;
    });
    
    const subtotal = items.reduce((sum, item) => {
      const lineSubtotal = (item.quantity * item.unit_price) - (item.discount || 0);
      return sum + lineSubtotal;
    }, 0);
    
    const taxTotal = items.reduce((sum, item) => {
      const lineSubtotal = (item.quantity * item.unit_price) - (item.discount || 0);
      const lineTax = lineSubtotal * (item.tax_rate || 0.1);
      return sum + lineTax;
    }, 0);

    const total = subtotal + taxTotal;

    // Only update if totals actually changed
    if (Math.abs((quote.subtotal || 0) - subtotal) > 0.01 || 
        Math.abs((quote.tax_total || 0) - taxTotal) > 0.01 || 
        Math.abs((quote.total || 0) - total) > 0.01) {
      onUpdate({
        ...quote,
        subtotal,
        tax_total: taxTotal,
        total
      });
    }
  }, [quoteItems.map(i => `${i.id}-${i.is_selected}-${i.quantity}-${i.unit_price}`).join(','), 
      quoteSections.map(s => `${s.id}-${s.is_selected}`).join(',')]);

  const handleAddItem = () => {
    const lineSubtotal = (newItem.quantity * newItem.unit_price) - (newItem.discount || 0);
    const lineTax = lineSubtotal * 0.1;
    const lineTotal = lineSubtotal + lineTax;

    createItemMutation.mutate({
      ...newItem,
      quote_id: quote.id,
      line_subtotal: lineSubtotal,
      line_total: lineTotal,
      tax_rate: 0.1
    });
  };

  const handleDeleteItem = (itemId) => {
    deleteItemMutation.mutate(itemId);
  };

  const handleToggleOptional = (item) => {
    const updatedData = {
      ...item,
      is_selected: !item.is_selected
    };
    updateItemMutation.mutate({ id: item.id, data: updatedData });
  };

  const handleProductSelect = (productId) => {
    const product = priceListItems.find(p => p.id === productId);
    if (product) {
      setNewItem({
        ...newItem,
        product_id: productId,
        title: product.item,
        description: product.description || "",
        unit_price: product.price
      });
      setSearchQuery(product.item);
      setSearchOpen(false);
    }
  };

  const handleTemplateSelect = (templateId) => {
    const template = quoteTemplates.find(t => t.id === templateId);
    if (template) {
      setNewItem({
        ...newItem,
        product_id: "",
        title: template.name,
        description: template.description || "",
        unit_price: template.unit_price,
        quantity: template.default_quantity,
        unit_label: template.unit_label
      });
      setSearchQuery(template.name);
      setSearchOpen(false);
    }
  };

  const handleCreateSection = () => {
    if (!newSectionName.trim()) return;
    const sortOrder = quoteSections.length;
    createSectionMutation.mutate({
      quote_id: quote.id,
      title: newSectionName,
      sort_order: sortOrder,
      is_optional: newSectionIsOptional,
      is_selected: true,
      option_group_key: newSectionOptionGroup.trim() || null
    });
  };

  const handleToggleSectionSelection = (section) => {
    if (section.option_group_key) {
      // Radio button behavior - deselect other sections in the same group
      const sectionsInGroup = quoteSections.filter(s => s.option_group_key === section.option_group_key);
      sectionsInGroup.forEach(s => {
        if (s.id === section.id) {
          updateSectionMutation.mutate({ id: s.id, data: { ...s, is_selected: true } });
        } else if (s.is_selected) {
          updateSectionMutation.mutate({ id: s.id, data: { ...s, is_selected: false } });
        }
      });
    } else {
      // Checkbox behavior - toggle this section only
      updateSectionMutation.mutate({ 
        id: section.id, 
        data: { ...section, is_selected: !section.is_selected } 
      });
    }
  };

  const startEditingSection = (section) => {
    setEditingSectionId(section.id);
    setEditingSectionData({
      title: section.title,
      description: section.description || "",
      is_optional: section.is_optional || false,
      option_group_key: section.option_group_key || ""
    });
  };

  const cancelEditingSection = () => {
    setEditingSectionId(null);
    setEditingSectionData(null);
  };

  const saveEditingSection = (section) => {
    updateSectionMutation.mutate({
      id: section.id,
      data: {
        ...section,
        ...editingSectionData,
        option_group_key: editingSectionData.option_group_key.trim() || null
      }
    });
    setEditingSectionId(null);
    setEditingSectionData(null);
  };

  const startEditingItem = (item) => {
    setEditingItemId(item.id);
    setEditingItemData({
      title: item.title,
      description: item.description || "",
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_label: item.unit_label,
      section_id: item.section_id || "",
      is_optional: item.is_optional || false
    });
  };

  const cancelEditingItem = () => {
    setEditingItemId(null);
    setEditingItemData(null);
  };

  const saveEditingItem = (item) => {
    const lineSubtotal = (editingItemData.quantity * editingItemData.unit_price) - (item.discount || 0);
    const lineTax = lineSubtotal * (item.tax_rate || 0.1);
    const lineTotal = lineSubtotal + lineTax;

    updateItemMutation.mutate({
      id: item.id,
      data: {
        ...item,
        ...editingItemData,
        section_id: editingItemData.section_id || null,
        line_subtotal: lineSubtotal,
        line_total: lineTotal
      }
    });
    setEditingItemId(null);
    setEditingItemData(null);
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'section') {
      // Reordering sections
      const sections = [...quoteSections].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const [removed] = sections.splice(source.index, 1);
      sections.splice(destination.index, 0, removed);

      // Update sort_order for all sections
      sections.forEach((section, index) => {
        updateSectionMutation.mutate({
          id: section.id,
          data: { ...section, sort_order: index }
        });
      });
    } else if (type === 'item') {
      // Reordering items
      const sourceSectionId = source.droppableId.replace('items-', '') || null;
      const destSectionId = destination.droppableId.replace('items-', '') || null;

      const sourceItems = quoteItems
        .filter(item => (item.section_id || null) === sourceSectionId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      if (sourceSectionId === destSectionId) {
        // Same section reorder
        const [removed] = sourceItems.splice(source.index, 1);
        sourceItems.splice(destination.index, 0, removed);

        sourceItems.forEach((item, index) => {
          updateItemMutation.mutate({
            id: item.id,
            data: { ...item, sort_order: index }
          });
        });
      } else {
        // Move to different section
        const destItems = quoteItems
          .filter(item => (item.section_id || null) === destSectionId)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const [removed] = sourceItems.splice(source.index, 1);
        destItems.splice(destination.index, 0, removed);

        // Update source section items
        sourceItems.forEach((item, index) => {
          updateItemMutation.mutate({
            id: item.id,
            data: { ...item, sort_order: index }
          });
        });

        // Update destination section items (including moved item)
        destItems.forEach((item, index) => {
          updateItemMutation.mutate({
            id: item.id,
            data: { ...item, section_id: destSectionId, sort_order: index }
          });
        });
      }
    }
  };

  const handleDeleteSection = (sectionId) => {
    const itemsInSection = quoteItems.filter(item => item.section_id === sectionId);
    if (itemsInSection.length > 0) {
      if (!confirm(`This section has ${itemsInSection.length} item(s). Delete anyway? Items will be moved to "Uncategorized".`)) {
        return;
      }
    }
    deleteSectionMutation.mutate(sectionId);
  };

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const groupedItems = useMemo(() => {
    const groups = {
      uncategorized: quoteItems.filter(item => !item.section_id)
    };
    
    quoteSections.forEach(section => {
      groups[section.id] = quoteItems.filter(item => item.section_id === section.id);
    });
    
    return groups;
  }, [quoteItems, quoteSections]);

  const calculateSectionTotal = (items) => {
    return items
      .filter(item => !item.is_optional || item.is_selected)
      .reduce((sum, item) => sum + (item.line_total || 0), 0);
  };

  const optionGroups = useMemo(() => {
    const groups = {};
    quoteSections.forEach(section => {
      if (section.option_group_key) {
        if (!groups[section.option_group_key]) {
          groups[section.option_group_key] = [];
        }
        groups[section.option_group_key].push(section);
      }
    });
    return groups;
  }, [quoteSections]);

  return (
    <div className="space-y-6">
      <Card className="bg-white border border-[#E5E7EB]">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-[#111827] mb-4">Add Line Item</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Item Title *</Label>
              <div className="relative">
                <Input
                  value={newItem.title}
                  onChange={(e) => {
                    setNewItem({ ...newItem, title: e.target.value, product_id: "" });
                    setSearchQuery(e.target.value);
                    if (e.target.value.length > 0) {
                      setSearchOpen(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setSearchOpen(false);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setSearchOpen(false), 200);
                  }}
                  placeholder="Type custom item or search price list..."
                  className="pr-10"
                />
                {newItem.title.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchOpen(!searchOpen)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6B7280] hover:text-[#111827]"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )}
                {searchOpen && newItem.title.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                    {filteredTemplates.length > 0 && (
                      <div className="p-2 border-b border-[#E5E7EB]">
                        <div className="text-xs font-semibold text-[#6B7280] px-2 py-1 mb-1">Templates</div>
                        {filteredTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => handleTemplateSelect(template.id)}
                            className="w-full flex justify-between items-center px-3 py-2 hover:bg-[#FAE008]/10 rounded-lg transition-colors text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-[#111827]">{template.name}</div>
                              <div className="text-xs text-[#6B7280]">
                                {template.category} • {template.default_quantity} {template.unit_label}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-[#111827] ml-4">
                              ${template.unit_price.toFixed(2)}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {filteredProducts.length > 0 ? (
                      <div className="p-2">
                        <div className="text-xs font-semibold text-[#6B7280] px-2 py-1 mb-1">Price List Items</div>
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleProductSelect(product.id)}
                            className="w-full flex justify-between items-center px-3 py-2 hover:bg-[#F3F4F6] rounded-lg transition-colors text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-[#111827]">{product.item}</div>
                              {product.description && (
                                <div className="text-xs text-[#6B7280] truncate">
                                  {product.description}
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-semibold text-[#111827] ml-4">
                              ${product.price.toFixed(2)}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : filteredTemplates.length === 0 && (
                      <div className="py-6 text-center text-sm text-[#6B7280]">
                        No templates or products found. Continue entering custom item details below.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit Label</Label>
              <Input
                value={newItem.unit_label}
                onChange={(e) => setNewItem({ ...newItem, unit_label: e.target.value })}
                placeholder="e.g., each, set"
              />
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit Price *</Label>
              <Input
                type="number"
                value={newItem.unit_price}
                onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Section (Optional)</Label>
              <Select value={newItem.section_id} onValueChange={(val) => setNewItem({ ...newItem, section_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="No section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No section</SelectItem>
                  {quoteSections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Add item description..."
                className="min-h-[60px]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={newItem.is_optional}
                onCheckedChange={(checked) => setNewItem({ ...newItem, is_optional: checked })}
              />
              <Label>Optional Item</Label>
            </div>
          </div>
          <Button
            onClick={handleAddItem}
            disabled={!newItem.title || createItemMutation.isPending}
            className="mt-4 bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#111827]">Quote Items</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewSectionForm(!showNewSectionForm)}
            className="text-sm"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Section
          </Button>
        </div>

        {showNewSectionForm && (
          <Card className="bg-white border border-[#E5E7EB]">
            <CardContent className="p-4">
              <div className="space-y-3">
                <Input
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="Section name (e.g., Labor, Materials, Add-ons)"
                  onKeyDown={(e) => e.key === 'Enter' && !newSectionIsOptional && !newSectionOptionGroup && handleCreateSection()}
                />
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newSectionIsOptional}
                      onCheckedChange={setNewSectionIsOptional}
                    />
                    <Label className="text-sm">Optional Section</Label>
                  </div>
                  {newSectionIsOptional && (
                    <Input
                      value={newSectionOptionGroup}
                      onChange={(e) => setNewSectionOptionGroup(e.target.value)}
                      placeholder="Option group (optional, for radio behavior)"
                      className="flex-1"
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateSection}
                    disabled={!newSectionName.trim() || createSectionMutation.isPending}
                    className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
                  >
                    Create
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewSectionForm(false);
                      setNewSectionName("");
                      setNewSectionIsOptional(false);
                      setNewSectionOptionGroup("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {quoteItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-[#E5E7EB]">
            <p className="text-[#6B7280]">No items added yet</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="sections" type="section">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {quoteSections
                    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                    .map((section, sectionIndex) => {
                const sectionItems = groupedItems[section.id] || [];
                const isCollapsed = collapsedSections[section.id];
                const sectionTotal = calculateSectionTotal(sectionItems);

                return (
                  <Draggable key={section.id} draggableId={section.id} index={sectionIndex}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="space-y-2"
                      >
                        <Card className={`border ${section.is_optional && !section.is_selected ? 'bg-white border-[#D1D5DB]' : 'bg-[#F9FAFB] border-[#E5E7EB]'} ${snapshot.isDragging ? 'shadow-lg' : ''}`}>
                      <CardContent className="p-4">
                        {editingSectionId === section.id ? (
                          <div className="space-y-3">
                            <Input
                              value={editingSectionData.title}
                              onChange={(e) => setEditingSectionData({ ...editingSectionData, title: e.target.value })}
                              placeholder="Section title"
                            />
                            <Textarea
                              value={editingSectionData.description}
                              onChange={(e) => setEditingSectionData({ ...editingSectionData, description: e.target.value })}
                              placeholder="Section description (optional)"
                              className="min-h-[60px]"
                            />
                            <div className="flex items-center gap-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={editingSectionData.is_optional}
                                  onCheckedChange={(checked) => setEditingSectionData({ ...editingSectionData, is_optional: checked })}
                                />
                                <Label className="text-sm">Optional Section</Label>
                              </div>
                              {editingSectionData.is_optional && (
                                <Input
                                  value={editingSectionData.option_group_key}
                                  onChange={(e) => setEditingSectionData({ ...editingSectionData, option_group_key: e.target.value })}
                                  placeholder="Option group (for radio behavior)"
                                  className="flex-1"
                                />
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveEditingSection(section)}
                                className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditingSection}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="w-5 h-5 text-[#6B7280]" />
                                </div>
                                {section.is_optional && (
                                  <div className="flex items-center">
                                    {section.option_group_key ? (
                                      <input
                                        type="radio"
                                        checked={section.is_selected}
                                        onChange={() => handleToggleSectionSelection(section)}
                                        className="w-4 h-4 cursor-pointer"
                                      />
                                    ) : (
                                      <Switch
                                        checked={section.is_selected}
                                        onCheckedChange={() => handleToggleSectionSelection(section)}
                                      />
                                    )}
                                  </div>
                                )}
                                <button
                                  onClick={() => toggleSection(section.id)}
                                  className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="w-5 h-5 text-[#6B7280]" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-[#6B7280]" />
                                  )}
                                  <h4 className={`font-semibold ${section.is_optional && !section.is_selected ? 'text-[#6B7280]' : 'text-[#111827]'}`}>
                                    {section.title}
                                  </h4>
                                  <span className="text-sm text-[#6B7280]">({sectionItems.length})</span>
                                  {section.is_optional && (
                                    <span className="text-xs bg-[#FAE008]/20 text-[#92400E] px-2 py-0.5 rounded-lg">
                                      {section.option_group_key ? 'Choose One' : 'Optional'}
                                    </span>
                                  )}
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${section.is_optional && !section.is_selected ? 'text-[#6B7280]' : 'text-[#111827]'}`}>
                                  ${sectionTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEditingSection(section)}
                                  className="hover:bg-[#F3F4F6]"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteSection(section.id)}
                                  className="hover:bg-red-100 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {section.description && !isCollapsed && (
                              <p className="text-sm text-[#6B7280] mt-2 ml-7">{section.description}</p>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {!isCollapsed && (
                      <Droppable droppableId={`items-${section.id}`} type="item">
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                            {sectionItems
                              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                              .map((item, itemIndex) => (
                      <Draggable key={item.id} draggableId={item.id} index={itemIndex}>
                        {(provided, snapshot) => (
                          <Card 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`bg-white border border-[#E5E7EB] ml-7 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-2">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing mt-1">
                                  <GripVertical className="w-5 h-5 text-[#6B7280]" />
                                </div>
                                <div className="flex-1">
                          {editingItemId === item.id ? (
                            <div className="space-y-3">
                              <Input
                                value={editingItemData.title}
                                onChange={(e) => setEditingItemData({ ...editingItemData, title: e.target.value })}
                                placeholder="Item title"
                              />
                              <Textarea
                                value={editingItemData.description}
                                onChange={(e) => setEditingItemData({ ...editingItemData, description: e.target.value })}
                                placeholder="Item description"
                                className="min-h-[60px]"
                              />
                              <div className="grid md:grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs">Quantity</Label>
                                  <Input
                                    type="number"
                                    value={editingItemData.quantity}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, quantity: parseFloat(e.target.value) || 0 })}
                                    min="0"
                                    step="0.01"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Unit Price</Label>
                                  <Input
                                    type="number"
                                    value={editingItemData.unit_price}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, unit_price: parseFloat(e.target.value) || 0 })}
                                    min="0"
                                    step="0.01"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Unit Label</Label>
                                  <Input
                                    value={editingItemData.unit_label}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, unit_label: e.target.value })}
                                    placeholder="each"
                                  />
                                </div>
                              </div>
                              <div className="grid md:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Section</Label>
                                  <Select value={editingItemData.section_id} onValueChange={(val) => setEditingItemData({ ...editingItemData, section_id: val })}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="No section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={null}>No section</SelectItem>
                                      {quoteSections.map((section) => (
                                        <SelectItem key={section.id} value={section.id}>
                                          {section.title}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-end">
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      checked={editingItemData.is_optional}
                                      onCheckedChange={(checked) => setEditingItemData({ ...editingItemData, is_optional: checked })}
                                    />
                                    <Label className="text-xs">Optional</Label>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveEditingItem(item)}
                                  className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditingItem}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-[#111827]">{item.title}</h4>
                                  {item.is_optional && (
                                    <span className="text-xs bg-[#FAE008]/20 text-[#92400E] px-2 py-0.5 rounded-lg">
                                      Optional
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-sm text-[#6B7280] mb-3">{item.description}</p>
                                )}
                                <div className="flex items-center gap-6 text-sm">
                                  <div>
                                    <span className="text-[#6B7280]">Qty: </span>
                                    <span className="text-[#111827] font-medium">{item.quantity} {item.unit_label}</span>
                                  </div>
                                  <div>
                                    <span className="text-[#6B7280]">Price: </span>
                                    <span className="text-[#111827] font-medium">
                                      ${item.unit_price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  {item.is_optional && (
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={item.is_selected}
                                        onCheckedChange={() => handleToggleOptional(item)}
                                      />
                                      <span className="text-xs text-[#6B7280]">
                                        {item.is_selected ? 'Included' : 'Excluded'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-2">
                                <div className="text-lg font-bold text-[#111827]">
                                  ${(item.line_total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => startEditingItem(item)}
                                    className="hover:bg-[#F3F4F6]"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="hover:bg-red-100 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                  )}
                  </Draggable>
                  );
                  })}
                  {provided.placeholder}
                  </div>
                  )}
                  </Droppable>

                  {groupedItems.uncategorized.length > 0 && (
                    <Droppable droppableId="items-" type="item">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                          <h4 className="font-medium text-[#6B7280] text-sm">Uncategorized Items</h4>
                          {groupedItems.uncategorized
                            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                            .map((item, itemIndex) => (
                  <Draggable key={item.id} draggableId={item.id} index={itemIndex}>
                    {(provided, snapshot) => (
                      <Card 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-white border border-[#E5E7EB] ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-2">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing mt-1">
                              <GripVertical className="w-5 h-5 text-[#6B7280]" />
                            </div>
                            <div className="flex-1">
                      {editingItemId === item.id ? (
                        <div className="space-y-3">
                          <Input
                            value={editingItemData.title}
                            onChange={(e) => setEditingItemData({ ...editingItemData, title: e.target.value })}
                            placeholder="Item title"
                          />
                          <Textarea
                            value={editingItemData.description}
                            onChange={(e) => setEditingItemData({ ...editingItemData, description: e.target.value })}
                            placeholder="Item description"
                            className="min-h-[60px]"
                          />
                          <div className="grid md:grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs">Quantity</Label>
                              <Input
                                type="number"
                                value={editingItemData.quantity}
                                onChange={(e) => setEditingItemData({ ...editingItemData, quantity: parseFloat(e.target.value) || 0 })}
                                min="0"
                                step="0.01"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Unit Price</Label>
                              <Input
                                type="number"
                                value={editingItemData.unit_price}
                                onChange={(e) => setEditingItemData({ ...editingItemData, unit_price: parseFloat(e.target.value) || 0 })}
                                min="0"
                                step="0.01"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Unit Label</Label>
                              <Input
                                value={editingItemData.unit_label}
                                onChange={(e) => setEditingItemData({ ...editingItemData, unit_label: e.target.value })}
                                placeholder="each"
                              />
                            </div>
                          </div>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Section</Label>
                              <Select value={editingItemData.section_id} onValueChange={(val) => setEditingItemData({ ...editingItemData, section_id: val })}>
                                <SelectTrigger>
                                  <SelectValue placeholder="No section" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={null}>No section</SelectItem>
                                  {quoteSections.map((section) => (
                                    <SelectItem key={section.id} value={section.id}>
                                      {section.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={editingItemData.is_optional}
                                  onCheckedChange={(checked) => setEditingItemData({ ...editingItemData, is_optional: checked })}
                                />
                                <Label className="text-xs">Optional</Label>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveEditingItem(item)}
                              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditingItem}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-[#111827]">{item.title}</h4>
                              {item.is_optional && (
                                <span className="text-xs bg-[#FAE008]/20 text-[#92400E] px-2 py-0.5 rounded-lg">
                                  Optional
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-[#6B7280] mb-3">{item.description}</p>
                            )}
                            <div className="flex items-center gap-6 text-sm">
                              <div>
                                <span className="text-[#6B7280]">Qty: </span>
                                <span className="text-[#111827] font-medium">{item.quantity} {item.unit_label}</span>
                              </div>
                              <div>
                                <span className="text-[#6B7280]">Price: </span>
                                <span className="text-[#111827] font-medium">
                                  ${item.unit_price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {item.is_optional && (
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={item.is_selected}
                                    onCheckedChange={() => handleToggleOptional(item)}
                                  />
                                  <span className="text-xs text-[#6B7280]">
                                    {item.is_selected ? 'Included' : 'Excluded'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <div className="text-lg font-bold text-[#111827]">
                              ${(item.line_total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEditingItem(item)}
                                className="hover:bg-[#F3F4F6]"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteItem(item.id)}
                                className="hover:bg-red-100 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
              )}
              </DragDropContext>
              )}
              </div>

      <Card className="bg-[#F9FAFB] border border-[#E5E7EB]">
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Subtotal:</span>
              <span className="font-medium text-[#111827]">
                ${(quote.subtotal || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Tax (GST):</span>
              <span className="font-medium text-[#111827]">
                ${(quote.tax_total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#E5E7EB]">
              <span className="text-lg font-semibold text-[#111827]">Total:</span>
              <span className="text-2xl font-bold text-[#111827]">
                ${(quote.total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}