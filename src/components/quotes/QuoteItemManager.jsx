import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, Search, ChevronDown, ChevronRight, FolderPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const recalculateTotals = () => {
    const selectedSectionIds = new Set(
      quoteSections.filter(s => !s.is_optional || s.is_selected).map(s => s.id)
    );
    
    const items = quoteItems.filter(item => {
      // Check if item's section is selected (or item has no section)
      const sectionSelected = !item.section_id || selectedSectionIds.has(item.section_id);
      // Check if item itself is selected (if optional)
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

    const newTotals = {
      subtotal,
      tax_total: taxTotal,
      total
    };

    if (quote.subtotal !== newTotals.subtotal || 
        quote.tax_total !== newTotals.tax_total || 
        quote.total !== newTotals.total) {
      onUpdate({
        ...quote,
        ...newTotals
      });
    }
  };

  useEffect(() => {
    recalculateTotals();
  }, [quoteItems.length]);

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
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Input
                      value={newItem.title}
                      onChange={(e) => {
                        setNewItem({ ...newItem, title: e.target.value, product_id: "" });
                        setSearchQuery(e.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      placeholder="Search products or enter custom item..."
                      className="pr-10"
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[400px]" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search products..." 
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No products found.</CommandEmpty>
                      <CommandGroup heading="Price List Items">
                        {filteredProducts.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.id}
                            onSelect={() => handleProductSelect(product.id)}
                            className="cursor-pointer"
                          >
                            <div className="flex justify-between items-center w-full">
                              <div>
                                <div className="font-medium">{product.item}</div>
                                {product.description && (
                                  <div className="text-xs text-[#6B7280] truncate max-w-[250px]">
                                    {product.description}
                                  </div>
                                )}
                              </div>
                              <div className="text-sm font-semibold text-[#111827]">
                                ${product.price.toFixed(2)}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
          <div className="space-y-4">
            {quoteSections
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
              .map((section) => {
                const sectionItems = groupedItems[section.id] || [];
                const isCollapsed = collapsedSections[section.id];
                const sectionTotal = calculateSectionTotal(sectionItems);

                return (
                  <div key={section.id} className="space-y-2">
                    <Card className={`border ${section.is_optional && !section.is_selected ? 'bg-white border-[#D1D5DB]' : 'bg-[#F9FAFB] border-[#E5E7EB]'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
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
                          <div className="flex items-center gap-4">
                            <span className={`text-sm font-semibold ${section.is_optional && !section.is_selected ? 'text-[#6B7280]' : 'text-[#111827]'}`}>
                              ${sectionTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
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
                      </CardContent>
                    </Card>

                    {!isCollapsed && sectionItems.map((item) => (
                      <Card key={item.id} className="bg-white border border-[#E5E7EB] ml-7">
                        <CardContent className="p-4">
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
                            <div className="text-right">
                              <div className="text-lg font-bold text-[#111827] mb-2">
                                ${(item.line_total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
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
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })}

            {groupedItems.uncategorized.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-[#6B7280] text-sm">Uncategorized Items</h4>
                {groupedItems.uncategorized.map((item) => (
                  <Card key={item.id} className="bg-white border border-[#E5E7EB]">
                    <CardContent className="p-4">
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
                        <div className="text-right">
                          <div className="text-lg font-bold text-[#111827] mb-2">
                            ${(item.line_total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
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