import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, User, Briefcase, FileText, AlertCircle, Plus, X, Package, Eye, Edit } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function CreateInvoiceModal({ 
  open, 
  onClose, 
  onConfirm, 
  isSubmitting,
  type = "job", // "job" or "project"
  data = {}
}) {
  const [lineItems, setLineItems] = useState([{ description: "", amount: "", discount: "" }]);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data: priceListItems = [] } = useQuery({
    queryKey: ['priceListItems'],
    queryFn: () => base44.entities.PriceListItem.list('category'),
    enabled: open
  });

  const filteredPriceListItems = priceListItems.filter(item =>
    item.item?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", amount: "", discount: "" }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  const selectPriceListItem = (index, itemId) => {
    const item = priceListItems.find(i => i.id === itemId);
    if (item) {
      const updated = [...lineItems];
      updated[index] = {
        description: item.description || item.item,
        amount: item.price.toString(),
        discount: ""
      };
      setLineItems(updated);
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + amount;
    }, 0);
  };

  const calculateDiscountTotal = () => {
    return lineItems.reduce((sum, item) => {
      const discount = parseFloat(item.discount) || 0;
      return sum + discount;
    }, 0);
  };

  const calculateSubtotalAfterDiscount = () => {
    return calculateSubtotal() - calculateDiscountTotal();
  };

  const calculateGST = () => {
    return calculateSubtotalAfterDiscount() * 0.10;
  };

  const calculateTotal = () => {
    return calculateSubtotalAfterDiscount() + calculateGST();
  };

  const handlePreview = () => {
    setError("");
    
    // Validate line items
    const validItems = lineItems.filter(item => item.description && parseFloat(item.amount) > 0);
    
    if (validItems.length === 0) {
      setError("Please add at least one line item with a valid amount");
      return;
    }

    const total = calculateTotal();
    if (total <= 0) {
      setError("Total invoice amount must be greater than zero");
      return;
    }

    setShowPreview(true);
  };

  const handleConfirm = () => {
    const validItems = lineItems.filter(item => item.description && parseFloat(item.amount) > 0);
    
    onConfirm({ 
      lineItems: validItems.map(item => ({
        description: item.description,
        amount: parseFloat(item.amount),
        discount: parseFloat(item.discount) || 0
      })),
      total: calculateTotal()
    });
  };

  const handleClose = () => {
    setLineItems([{ description: "", amount: "", discount: "" }]);
    setError("");
    setSearchTerm("");
    setShowPreview(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] rounded-2xl border-2 border-[#E5E7EB] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
            {showPreview ? 'Preview Invoice' : `Create Xero Invoice for this ${type === "job" ? "Job" : "Project"}?`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          {showPreview ? (
            // Preview Mode
            <>
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[12px] text-[#6B7280] mb-0.5">Customer</div>
                    <div className="text-[14px] font-semibold text-[#111827]">{data.customer_name}</div>
                    {data.customer_email && (
                      <div className="text-[12px] text-[#6B7280] mt-0.5">{data.customer_email}</div>
                    )}
                  </div>
                </div>

                {type === "job" && data.job_number && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-[12px] text-[#6B7280] mb-0.5">Job Number</div>
                      <div className="text-[14px] font-semibold text-[#111827]">#{data.job_number}</div>
                    </div>
                  </div>
                )}

                {type === "project" && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-[12px] text-[#6B7280] mb-0.5">Project</div>
                      <div className="text-[14px] font-semibold text-[#111827]">{data.title}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border-2 border-[#E5E7EB] rounded-lg p-4">
                <h3 className="text-[14px] font-semibold text-[#111827] mb-3">Invoice Line Items</h3>
                <div className="space-y-3">
                  {lineItems.filter(item => item.description && parseFloat(item.amount) > 0).map((item, index) => (
                    <div key={index} className="border-b border-[#E5E7EB] pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-[#111827] text-[14px]">{item.description}</span>
                        <span className="font-semibold text-[#111827] text-[14px]">${parseFloat(item.amount).toFixed(2)}</span>
                      </div>
                      {item.discount && parseFloat(item.discount) > 0 && (
                        <div className="flex justify-between items-center text-[13px] mt-1">
                          <span className="text-red-600">Discount</span>
                          <span className="text-red-600">-${parseFloat(item.discount).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#6B7280]">Subtotal (excl. GST)</span>
                  <span className="font-medium text-[#111827]">${calculateSubtotal().toFixed(2)}</span>
                </div>
                {calculateDiscountTotal() > 0 && (
                  <div className="flex justify-between text-[14px]">
                    <span className="text-red-600">Total Discounts</span>
                    <span className="font-medium text-red-600">-${calculateDiscountTotal().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#6B7280]">GST (10%)</span>
                  <span className="font-medium text-[#111827]">${calculateGST().toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E5E7EB]">
                  <span className="text-[14px] font-semibold text-[#111827]">Total (incl. GST)</span>
                  <span className="text-[18px] font-bold text-[#111827]">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-[12px] text-blue-900 leading-relaxed">
                  <strong>Ready to send:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>Invoice will be created in Xero (Authorised status)</li>
                    <li>Customer can be emailed from Xero</li>
                    <li>Payment tracking synced automatically</li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            // Edit Mode
            <>
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[12px] text-[#6B7280] mb-0.5">Customer</div>
                    <div className="text-[14px] font-semibold text-[#111827]">{data.customer_name}</div>
                    {data.customer_email && (
                      <div className="text-[12px] text-[#6B7280] mt-0.5">{data.customer_email}</div>
                    )}
                  </div>
                </div>

                {type === "job" && data.job_number && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-[12px] text-[#6B7280] mb-0.5">Job Number</div>
                      <div className="text-[14px] font-semibold text-[#111827]">#{data.job_number}</div>
                    </div>
                  </div>
                )}

                {type === "project" && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-[12px] text-[#6B7280] mb-0.5">Project</div>
                      <div className="text-[14px] font-semibold text-[#111827]">{data.title}</div>
                      {data.project_type && (
                        <div className="text-[12px] text-[#6B7280] mt-0.5">{data.project_type}</div>
                      )}
                    </div>
                  </div>
                )}

                {data.project_name && type === "job" && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-[12px] text-[#6B7280] mb-0.5">Project Reference</div>
                      <div className="text-[14px] font-medium text-[#111827]">{data.project_name}</div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563]">
                    Invoice Line Items *
                  </Label>
                  <Button
                    type="button"
                    onClick={addLineItem}
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5]"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {lineItems.map((item, index) => (
                    <div key={index} className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-medium text-[#6B7280]">Item {index + 1}</span>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLineItem(index);
                            }}
                            className="text-red-600 hover:bg-red-50 rounded p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        <Label className="text-[12px] text-[#6B7280] mb-1">Quick Select</Label>
                        <Select 
                          onValueChange={(value) => {
                            selectPriceListItem(index, value);
                            setSearchTerm("");
                          }}
                          onOpenChange={() => setSearchTerm("")}
                        >
                          <SelectTrigger className="h-9 text-sm border-[#E5E7EB]">
                            <SelectValue placeholder="Select from Price List" />
                          </SelectTrigger>
                          <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                            <div className="px-2 py-2 border-b border-[#E5E7EB]">
                              <Input
                                placeholder="Search items..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-8 text-sm"
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => e.preventDefault()}
                                autoFocus={false}
                              />
                            </div>
                            <div className="max-h-[200px] overflow-y-auto">
                              {filteredPriceListItems.length === 0 ? (
                                <div className="px-2 py-3 text-sm text-[#6B7280] text-center">
                                  No items found
                                </div>
                              ) : (
                                filteredPriceListItems.map((priceItem) => (
                                  <SelectItem key={priceItem.id} value={priceItem.id}>
                                    <div className="flex items-center justify-between gap-3 w-full">
                                      <span className="text-sm">{priceItem.item}</span>
                                      <span className="text-xs text-[#6B7280]">${priceItem.price}</span>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-[12px] text-[#6B7280] mb-1">Description</Label>
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          className="h-9 text-sm border-[#E5E7EB]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[12px] text-[#6B7280] mb-1">Amount (excl. GST)</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={item.amount}
                              onChange={(e) => updateLineItem(index, 'amount', e.target.value)}
                              className="pl-8 h-9 text-sm border-[#E5E7EB]"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-[12px] text-[#6B7280] mb-1">Discount</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-red-600" />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={item.discount}
                              onChange={(e) => updateLineItem(index, 'discount', e.target.value)}
                              className="pl-8 h-9 text-sm border-[#E5E7EB]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-2">
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-[#6B7280]">Subtotal (excl. GST)</span>
                    <span className="font-medium text-[#111827]">
                      ${calculateSubtotal().toFixed(2)}
                    </span>
                  </div>
                  {calculateDiscountTotal() > 0 && (
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="text-red-600">Total Discounts</span>
                      <span className="font-medium text-red-600">
                        -${calculateDiscountTotal().toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-[#6B7280]">GST (10%)</span>
                    <span className="font-medium text-[#111827]">
                      ${calculateGST().toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
                    <span className="text-[14px] font-semibold text-[#111827]">Total (incl. GST)</span>
                    <span className="text-[18px] font-bold text-[#111827]">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-[14px] text-red-700 font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 flex-shrink-0 border-t border-[#E5E7EB] pt-4">
          {showPreview ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(false)}
                disabled={isSubmitting}
                className="border-[#E5E7EB] hover:bg-[#F3F4F6] rounded-lg font-semibold"
              >
                <Edit className="w-4 h-4 mr-2" />
                Back to Edit
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold rounded-lg shadow-sm"
              >
                {isSubmitting ? 'Creating Invoice...' : 'Send to Xero'}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="border-[#E5E7EB] hover:bg-[#F3F4F6] rounded-lg font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePreview}
                disabled={isSubmitting}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold rounded-lg shadow-sm"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Invoice
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}