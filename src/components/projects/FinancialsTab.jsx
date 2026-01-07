
import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MOVEMENT_TYPE } from "@/components/domain/inventoryConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, X, DollarSign, FileText, ExternalLink, Link as LinkIcon, Loader2, Unlink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import RichTextField from "../common/RichTextField";
import { usePermissions } from "../common/PermissionsContext";
import { exToGstAmount, exToInc } from "@/components/gst";

const getFinancialStatusOptions = (projectType) => {
  if (projectType === "Repair" || projectType === "Motor/Accessory") {
    return [
      { value: "Initial Payment Made", label: "Initial Payment Made" },
      { value: "Balance Paid in Full", label: "Balance Paid in Full" }
    ];
  } else if (projectType === "Maintenance") {
    return [
      { value: "Balance Paid in Full", label: "Balance Paid in Full" }
    ];
  } else {
    // Installation types
    return [
      { value: "Initial Payment Made", label: "Initial Payment Made" },
      { value: "Second Payment Made", label: "Second Payment Made" },
      { value: "Balance Paid in Full", label: "Balance Paid in Full" }
    ];
  }
};

export default function FinancialsTab({ project, onUpdate }) {
  const queryClient = useQueryClient();
  const { canViewCosts, isAdminOrManager } = usePermissions();
  const [uploading, setUploading] = useState(false);
  const [primaryQuote, setPrimaryQuote] = useState(null);
  const [primaryInvoice, setPrimaryInvoice] = useState(null);
  const [linkingLegacy, setLinkingLegacy] = useState(false);
  const [unlinkingInvoice, setUnlinkingInvoice] = useState(null);

  useEffect(() => {
    const loadLinkedDocs = async () => {
      if (project.primary_quote_id) {
        try {
          const quote = await base44.entities.Quote.get(project.primary_quote_id);
          setPrimaryQuote(quote);
        } catch (e) {
          console.error("Failed to load primary quote", e);
        }
      } else {
        setPrimaryQuote(null);
      }

      if (project.primary_xero_invoice_id) {
        try {
          const invoice = await base44.entities.XeroInvoice.get(project.primary_xero_invoice_id);
          setPrimaryInvoice(invoice);
        } catch (e) {
          console.error("Failed to load primary invoice", e);
        }
      } else {
        setPrimaryInvoice(null);
      }
    };
    loadLinkedDocs();
  }, [project.primary_quote_id, project.primary_xero_invoice_id]);

  const handleLinkLegacyDocs = async () => {
    setLinkingLegacy(true);
    try {
      const response = await base44.functions.invoke("linkLegacyFinanceForProject", { project_id: project.id });
      if (response.data?.success) {
        const updates = response.data.updates || {};
        if (Object.keys(updates).length > 0) {
           onUpdate(updates);
        }
      }
    } catch (error) {
      console.error("Failed to link legacy docs:", error);
    } finally {
      setLinkingLegacy(false);
    }
  };

  const handleUnlinkInvoice = async (invoiceId) => {
    if (!confirm('Unlink this invoice from the project?')) return;
    
    setUnlinkingInvoice(invoiceId);
    try {
      await base44.entities.XeroInvoice.update(invoiceId, { project_id: null });
      
      // If it's the primary invoice, clear that too
      if (project.primary_xero_invoice_id === invoiceId) {
        onUpdate({ primary_xero_invoice_id: null });
      }

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['projectXeroInvoices', project.id] });
      queryClient.invalidateQueries({ queryKey: ['xero-invoices-for-project', project.id] });
    } catch (error) {
      console.error("Failed to unlink invoice:", error);
    } finally {
      setUnlinkingInvoice(null);
    }
  };
  const [newPayment, setNewPayment] = useState({
    payment_name: "",
    payment_status: "Pending",
    payment_amount: "",
    paid_date: "",
    notes: "",
    attachments: []
  });
  const [showAddPayment, setShowAddPayment] = useState(false);

  // Fetch stock movements of type "usage" for this project
  const { data: usageMovements = [] } = useQuery({
    queryKey: ["stock-usage-for-project", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const all = await base44.entities.StockMovement.filter({
        project_id: project.id,
        movement_type: MOVEMENT_TYPE.USAGE,
      });
      return all;
    },
    enabled: !!project?.id,
  });

  // Fetch price list items to derive cost per item
  const { data: priceListItems = [] } = useQuery({
    queryKey: ["priceListItems-for-financials"],
    queryFn: () => base44.entities.PriceListItem.list("category"),
  });

  // Fetch all quotes for this project
  const { data: projectQuotes = [] } = useQuery({
    queryKey: ["quotes-for-project", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      return base44.entities.Quote.filter({ project_id: project.id });
    },
    enabled: !!project?.id,
  });

  // Fetch all XeroInvoices for this project
  const { data: projectXeroInvoices = [] } = useQuery({
    queryKey: ["xero-invoices-for-project", project?.id],
    queryFn: async () => {
      if (!project?.id) return [];
      const allInvoices = await base44.entities.XeroInvoice.filter({ project_id: project.id });
      
      // Deduplicate by xero_invoice_id (in case duplicates were created)
      const uniqueInvoices = allInvoices.reduce((acc, inv) => {
        if (!acc.find(i => i.xero_invoice_id === inv.xero_invoice_id)) {
          acc.push(inv);
        }
        return acc;
      }, []);
      
      return uniqueInvoices;
    },
    enabled: !!project?.id,
  });

  // PriceList lookup
  const priceMap = useMemo(() => {
    const map = {};
    for (const item of priceListItems) {
      map[item.id] = item;
    }
    return map;
  }, [priceListItems]);

  // Helper to get a sensible cost per unit with fallbacks
  const getUnitCost = (item) => {
    if (!item) return 0;
    return (
      item.unit_cost ??
      item.cost_price ??
      item.buy_price ??
      item.cost ??
      item.price ??
      0
    );
  };

  // Calculated materials cost from usage movements
  const autoMaterialsCost = useMemo(() => {
    if (!usageMovements.length) return 0;
    return usageMovements.reduce((sum, mv) => {
      const item = mv.price_list_item_id ? priceMap[mv.price_list_item_id] : null;
      const unitCost = getUnitCost(item);
      const qty = mv.quantity || 0;
      return sum + unitCost * qty;
    }, 0);
  }, [usageMovements, priceMap]);

  // Handler to apply calculated cost into project.materials_cost
  const handleApplyMaterialsCost = () => {
    if (!autoMaterialsCost || autoMaterialsCost < 0) return;
    onUpdate({ materials_cost: autoMaterialsCost });
  };



  const handleAddPayment = () => {
    if (!newPayment.payment_name || !newPayment.payment_amount) return;

    const currentPayments = project.payments || [];
    const payment = {
      ...newPayment,
      payment_amount: parseFloat(newPayment.payment_amount),
      paid_date: newPayment.payment_status === "Paid" && !newPayment.paid_date 
        ? new Date().toISOString().split('T')[0] 
        : newPayment.paid_date
    };

    onUpdate({ payments: [...currentPayments, payment] });
    setNewPayment({
      payment_name: "",
      payment_status: "Pending",
      payment_amount: "",
      paid_date: "",
      notes: "",
      attachments: []
    });
    setShowAddPayment(false);
  };

  const handleRemovePayment = (index) => {
    const updatedPayments = project.payments.filter((_, i) => i !== index);
    onUpdate({ payments: updatedPayments });
  };

  const handlePaymentStatusChange = (index, newStatus) => {
    const updatedPayments = [...project.payments];
    updatedPayments[index].payment_status = newStatus;
    
    if (newStatus === "Paid" && !updatedPayments[index].paid_date) {
      updatedPayments[index].paid_date = new Date().toISOString().split('T')[0];
    }
    
    onUpdate({ payments: updatedPayments });
  };

  const handleFileUpload = async (event, paymentIndex) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const updatedPayments = [...project.payments];
      const currentAttachments = updatedPayments[paymentIndex].attachments || [];
      updatedPayments[paymentIndex].attachments = [...currentAttachments, file_url];
      
      onUpdate({ payments: updatedPayments });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const financialStatusOptions = getFinancialStatusOptions(project.project_type);
  const totalPaid = (project.payments || [])
    .filter(p => p.payment_status === "Paid")
    .reduce((sum, p) => sum + (p.payment_amount || 0), 0);

  // 1) Quotes: sum of all accepted quotes (by status)
  const acceptedQuotes = (projectQuotes || []).filter(
    (q) => q.status === "Accepted" || q.status === "Approved"
  );

  const totalAcceptedQuoteValue = acceptedQuotes.reduce(
    (sum, q) => sum + (q.total_ex_gst || 0),
    0
  );

  const fallbackPrimaryQuoteValue = primaryQuote?.total_ex_gst || 0;

  // Auto quote value = sum of accepted quotes, or primary quote if none
  const autoQuoteValue =
    totalAcceptedQuoteValue > 0 ? totalAcceptedQuoteValue : fallbackPrimaryQuoteValue;

  // 2) Xero invoice totals
  const xeroTotalInvoiced = projectXeroInvoices.reduce(
    (sum, inv) => sum + (inv.total_amount || 0),
    0
  );

  const xeroTotalPaid = projectXeroInvoices.reduce(
    (sum, inv) => sum + (inv.amount_paid || 0),
    0
  );

  const xeroTotalDue = projectXeroInvoices.reduce(
    (sum, inv) => sum + (inv.amount_due || 0),
    0
  );

  const xeroFullyPaid = xeroTotalInvoiced > 0 && xeroTotalDue <= 0;

  // 3) Cost / profit / margin
  const materialsCost = project?.materials_cost || 0;
  const labourCost = project?.labour_cost || 0;
  const otherCosts = project?.other_costs || 0;

  const totalCosts = materialsCost + labourCost + otherCosts;
  const totalProjectValue = project?.total_project_value || 0;

  const profit = totalProjectValue - totalCosts;
  const marginPct = totalProjectValue
    ? (profit / totalProjectValue) * 100
    : 0;

  // For future Health strip
  const quotedValue = autoQuoteValue || 0;

  // Use refs to prevent infinite loops
  const hasAppliedQuoteValue = React.useRef(false);
  const hasAppliedXeroStatus = React.useRef(false);
  const hasAppliedSuggestedStatus = React.useRef(false);

  // Auto-apply project value from quotes when not locked
  useEffect(() => {
    if (!project || autoQuoteValue <= 0) return;
    if (project.financial_value_locked) return;

    const currentValue = project.total_project_value || 0;
    if (currentValue === autoQuoteValue) return;
    if (hasAppliedQuoteValue.current) return;

    hasAppliedQuoteValue.current = true;
    base44.entities.Project.update(project.id, {
      total_project_value: autoQuoteValue,
    }).finally(() => {
      setTimeout(() => { hasAppliedQuoteValue.current = false; }, 1000);
    });
  }, [project?.id, project?.financial_value_locked, project?.total_project_value, autoQuoteValue]);

  // Auto-mark financial status if Xero shows fully paid (with guardrails)
  useEffect(() => {
    if (!xeroFullyPaid || !project?.id) return;
    
    const currentStatus = project.financial_status;
    const allowedToAutoUpdate = !currentStatus || 
      currentStatus === "Awaiting Payment" ||
      currentStatus === "Initial Payment Made" ||
      currentStatus === "Second Payment Made";
    
    if (!allowedToAutoUpdate || currentStatus === "Balance Paid in Full") return;
    if (hasAppliedXeroStatus.current) return;

    hasAppliedXeroStatus.current = true;
    onUpdate({ financial_status: "Balance Paid in Full" });
    setTimeout(() => { hasAppliedXeroStatus.current = false; }, 1000);
  }, [xeroFullyPaid, project?.id, project?.financial_status]);

  // Suggest financial status based on % paid
  const baseValue = project.total_project_value || 0;
  const effectivePaid = xeroTotalPaid > 0 ? xeroTotalPaid : totalPaid;
  
  let suggestedStatus = null;
  if (baseValue > 0 && effectivePaid > 0) {
    const ratio = effectivePaid / baseValue;
    if (ratio >= 0.95) {
      suggestedStatus = "Balance Paid in Full";
    } else if (ratio >= 0.8) {
      suggestedStatus = "Second Payment Made";
    } else if (ratio >= 0.5) {
      suggestedStatus = "Initial Payment Made";
    }
  }

  // Auto-apply suggested financial status (unless locked)
  useEffect(() => {
    if (!suggestedStatus || !project?.id) return;
    if (project.financial_status_locked) return;
    
    const currentStatus = project.financial_status;
    if (currentStatus === suggestedStatus) return;
    if (hasAppliedSuggestedStatus.current) return;
    
    hasAppliedSuggestedStatus.current = true;
    onUpdate({ financial_status: suggestedStatus });
    setTimeout(() => { hasAppliedSuggestedStatus.current = false; }, 1000);
  }, [suggestedStatus, project?.id, project?.financial_status_locked, project?.financial_status]);

  // Handler for manual total project value changes - locks the value
  const handleTotalProjectValueChange = (newValue) => {
    onUpdate({
      total_project_value: newValue,
      financial_value_locked: true, // lock once user overrides
    });
  };

  // Handler for manual financial status changes - locks the status
  const handleFinancialStatusChange = (newStatus) => {
    onUpdate({
      financial_status: newStatus,
      financial_status_locked: true, // lock once user overrides
    });
  };

  return (
    <div className="space-y-4">
      {/* Financial Summary Card */}
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2] flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                Total Project Value (ex GST)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">$</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={project.total_project_value || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleTotalProjectValueChange(val === "" ? null : parseFloat(val) || null);
                  }}
                  className="pl-8"
                />
              </div>
              {project.total_project_value && !isNaN(project.total_project_value) && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    GST: ${exToGstAmount(project.total_project_value).toFixed(2)} • Inc: ${exToInc(project.total_project_value).toFixed(2)}
                  </p>
              )}
              {primaryQuote && primaryQuote.value > 0 && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#4B5563] bg-[#F3F4F6] rounded px-2 py-1">
                  <span>
                    From primary quote:{" "}
                    <span className="font-semibold">
                      ${primaryQuote.value.toFixed(2)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-6 text-[11px] px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate({ total_project_value: primaryQuote.value });
                    }}
                  >
                    Apply
                  </Button>
                </div>
              )}
              {primaryQuote && project.total_project_value === primaryQuote.value && (
                <p className="text-[10px] text-[#6B7280] mt-1">Set from primary quote</p>
              )}
            </div>

            <div>
              <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                Financial Status
              </label>
              <div className="flex flex-wrap gap-2">
                {financialStatusOptions.map(option => {
                  const isActive = project.financial_status === option.value;
                  return (
                    <Badge 
                      key={option.value}
                      className={`font-medium px-3 py-1 rounded-lg text-[12px] leading-[1.35] transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]' 
                          : 'bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#E5E7EB] opacity-50'
                      }`}
                      onClick={() => {
                        const newValue = isActive ? null : option.value;
                        handleFinancialStatusChange(newValue);
                      }}
                    >
                      {option.label}
                    </Badge>
                  );
                })}
              </div>
              {suggestedStatus && (
                <p className="mt-2 text-[11px] text-[#6B7280]">
                  Suggested status based on payments:{" "}
                  <span className="font-semibold">{suggestedStatus}</span>
                </p>
              )}
              {xeroFullyPaid && project.financial_status === "Balance Paid in Full" && (
                <p className="mt-2 text-[11px] text-[#16A34A]">
                  ✓ Auto-updated from Xero: all invoices paid in full
                </p>
              )}
            </div>
          </div>

          {canViewCosts && (
            <div className="border-t border-[#E5E7EB] pt-4">
              <h4 className="text-[16px] font-medium text-[#111827] mb-3 leading-[1.4]">Cost Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                  Materials Cost (ex GST)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={project.materials_cost || ""}
                    onChange={(e) => onUpdate({ materials_cost: parseFloat(e.target.value) || null })}
                    className="pl-8 h-9"
                  />
                </div>
                {project.materials_cost && !isNaN(project.materials_cost) && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Inc: ${exToInc(project.materials_cost).toFixed(2)}
                  </p>
                )}
                {autoMaterialsCost > 0 && (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[#4B5563] bg-[#F3F4F6] rounded px-2 py-1">
                    <span>
                      Calculated from item usage:{" "}
                      <span className="font-semibold">
                        ${autoMaterialsCost.toFixed(2)}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="h-6 text-[11px] px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyMaterialsCost();
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                  Labour Cost (ex GST)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={project.labour_cost || ""}
                    onChange={(e) => onUpdate({ labour_cost: parseFloat(e.target.value) || null })}
                    className="pl-8 h-9"
                  />
                </div>
                {project.labour_cost && !isNaN(project.labour_cost) && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Inc: ${exToInc(project.labour_cost).toFixed(2)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                  Other Costs (ex GST)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={project.other_costs || ""}
                    onChange={(e) => onUpdate({ other_costs: parseFloat(e.target.value) || null })}
                    className="pl-8 h-9"
                  />
                </div>
                {project.other_costs && !isNaN(project.other_costs) && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Inc: ${exToInc(project.other_costs).toFixed(2)}
                  </p>
                )}
              </div>
              </div>
            </div>
          )}

          {canViewCosts && (
            <div className="border-t border-[#E5E7EB] pt-4 bg-[#F8F9FA] -mx-4 -mb-4 px-4 py-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[12px] text-[#6B7280] mb-0.5">Total Cost</div>
                <div className="text-[18px] font-bold text-[#111827]">
                  ${totalCosts.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[#6B7280] mb-0.5">Profit</div>
                <div className={`text-[18px] font-bold ${profit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                  ${profit.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[#6B7280] mb-0.5">Margin</div>
                <div className={`text-[18px] font-bold ${marginPct >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                  {marginPct.toFixed(1)}%
                </div>
              </div>
            </div>

            {xeroTotalInvoiced > 0 && (
              <div className="mt-3 pt-3 border-t border-[#E5E7EB] text-[12px] text-[#4B5563]">
                <div className="flex justify-between mb-1">
                  <span>Xero – Total Invoiced</span>
                  <span className="font-semibold">
                    ${xeroTotalInvoiced.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Xero – Paid</span>
                  <span className="font-semibold text-[#16A34A]">
                    ${xeroTotalPaid.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Xero – Outstanding</span>
                  <span className="font-semibold text-[#DC2626]">
                    ${xeroTotalDue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Tracking */}
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
              Payment Tracking
            </CardTitle>
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddPayment(true);
              }}
              size="sm"
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-9"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4 space-y-3">
          {xeroTotalPaid > 0 && (
            <div className="mb-3 flex items-center justify-between text-[11px] text-[#4B5563] bg-[#F3F4F6] rounded px-2 py-1">
              <span>
                Xero payments total:{" "}
                <span className="font-semibold">
                  ${xeroTotalPaid.toFixed(2)}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-6 text-[11px] px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  const syntheticPayment = {
                    payment_name: "Xero Payments",
                    payment_status: xeroTotalDue === 0 ? "Paid" : "Pending",
                    payment_amount: xeroTotalPaid,
                    paid_date: new Date().toISOString().split("T")[0],
                    notes: "Auto-synced summary from Xero invoices",
                    attachments: []
                  };
                  const currentPayments = project.payments || [];
                  onUpdate({ payments: [...currentPayments.filter(p => p.payment_name !== "Xero Payments"), syntheticPayment] });
                }}
              >
                Apply to Payments
              </Button>
            </div>
          )}
          {showAddPayment && (
            <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                    Payment Name
                  </label>
                  <Input
                    placeholder="e.g., Initial Payment"
                    value={newPayment.payment_name}
                    onChange={(e) => setNewPayment({ ...newPayment, payment_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">$</span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newPayment.payment_amount}
                      onChange={(e) => setNewPayment({ ...newPayment, payment_amount: e.target.value })}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                    Status
                  </label>
                  <Select
                    value={newPayment.payment_status}
                    onValueChange={(value) => setNewPayment({ ...newPayment, payment_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                    Paid Date
                  </label>
                  <Input
                    type="date"
                    value={newPayment.paid_date}
                    onChange={(e) => setNewPayment({ ...newPayment, paid_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                  Notes
                </label>
                <Input
                  placeholder="Payment notes..."
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddPayment();
                  }}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Payment
                </Button>
                <Button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddPayment(false);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {project.payments && project.payments.length > 0 ? (
            <div className="space-y-2">
              {project.payments.map((payment, index) => (
                <div key={index} className="bg-white border border-[#E5E7EB] rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-[14px] font-semibold text-[#111827]">{payment.payment_name}</h4>
                        <Badge className={`${payment.payment_status === 'Paid' ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20' : 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'} font-medium px-2.5 py-0.5 rounded-lg text-[12px] border`}>
                          {payment.payment_status}
                        </Badge>
                      </div>
                      <div className="text-[18px] font-bold text-[#111827]">
                        ${(payment.payment_amount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {payment.paid_date && (
                        <div className="text-[12px] text-[#6B7280] mt-1">
                          Paid on {new Date(payment.paid_date).toLocaleDateString('en-AU')}
                        </div>
                      )}
                      {payment.notes && (
                        <div className="text-[12px] text-[#4B5563] mt-1">{payment.notes}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={payment.payment_status}
                        onValueChange={(value) => handlePaymentStatusChange(index, value)}
                      >
                        <SelectTrigger className="h-8 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Remove this payment?')) {
                            handleRemovePayment(index);
                          }
                        }}
                        className="text-red-600 hover:bg-red-50 rounded p-1 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {payment.attachments && payment.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {payment.attachments.map((url, attIdx) => (
                        <a
                          key={attIdx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#6D28D9] hover:underline bg-[#EDE9FE] px-2 py-1 rounded"
                        >
                          Attachment {attIdx + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  <label className="block">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={uploading}
                      asChild
                      className="h-8 text-xs"
                    >
                      <span>
                        <Upload className="w-3 h-3 mr-1" />
                        {uploading ? 'Uploading...' : 'Add Receipt'}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, index)}
                    />
                  </label>
                </div>
              ))}
            </div>
          ) : !showAddPayment && (
            <div className="text-center py-8 text-[#6B7280] text-[14px]">
              No payments tracked yet
            </div>
          )}

          {project.payments && project.payments.length > 0 && (
            <div className="border-t border-[#E5E7EB] pt-3 bg-[#F8F9FA] -mx-4 -mb-4 px-4 py-3">
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-semibold text-[#111827]">Total Paid</span>
                <span className="text-[18px] font-bold text-[#16A34A]">
                  ${totalPaid.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Documents */}
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <div className="flex justify-between items-center">
            <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2] flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Linked Documents
            </CardTitle>
            {((project.legacy_pandadoc_url && !primaryQuote) || (project.legacy_xero_invoice_url && !primaryInvoice)) && (
              <Button 
                type="button"
                variant="outline" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleLinkLegacyDocs();
                }}
                disabled={linkingLegacy}
                className="h-8 text-xs gap-1.5"
              >
                {linkingLegacy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                {linkingLegacy ? "Linking..." : "Import Legacy Links"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4 space-y-4">
          {projectQuotes.length === 0 && projectXeroInvoices.length === 0 && !project.legacy_pandadoc_url && !project.legacy_xero_invoice_url && (
             <div className="text-center py-4 text-[#6B7280] text-[14px]">
               No linked documents
             </div>
          )}

          {/* All Quotes */}
          {projectQuotes.length > 0 && (
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wider">Quotes ({projectQuotes.length})</div>
              {projectQuotes.map((quote) => (
                <div key={quote.id} className="bg-white border border-[#E5E7EB] rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-[#111827]">{quote.name}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[11px]">{quote.status}</Badge>
                        {quote.id === project.primary_quote_id && (
                          <Badge className="bg-[#FAE008] text-[#111827] text-[11px]">Primary</Badge>
                        )}
                        <span className="text-[13px] text-[#4B5563]">
                          ${((quote.value || quote.total_ex_gst || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {quote.pandadoc_public_url && (
                        <a 
                          href={quote.pandadoc_public_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[13px] text-[#2563EB] hover:underline whitespace-nowrap"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {quote.pandadoc_client_link && !quote.pandadoc_public_url && (
                        <a 
                          href={quote.pandadoc_client_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[13px] text-[#2563EB] hover:underline whitespace-nowrap"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legacy Quote */}
          {projectQuotes.length === 0 && project.legacy_pandadoc_url && (
             <div className="bg-white border border-[#E5E7EB] rounded-lg p-3">
               <div className="flex justify-between items-center">
                 <div>
                   <div className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Legacy Quote</div>
                   <div className="text-[13px] text-[#4B5563]">Legacy PandaDoc link available</div>
                 </div>
                 <a 
                    href={project.legacy_pandadoc_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[13px] text-[#2563EB] hover:underline"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
               </div>
             </div>
          )}

          {/* All Invoices */}
          {projectXeroInvoices.length > 0 && (
            <div className="space-y-2">
              <div className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wider">Invoices ({projectXeroInvoices.length})</div>
              {projectXeroInvoices.map((invoice) => (
                <div key={invoice.id} className="bg-white border border-[#E5E7EB] rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-[#111827]">{invoice.xero_invoice_number ? `Invoice #${invoice.xero_invoice_number}` : 'Invoice'}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[11px]">{invoice.status}</Badge>
                        {invoice.id === project.primary_xero_invoice_id && (
                          <Badge className="bg-[#FAE008] text-[#111827] text-[11px]">Primary</Badge>
                        )}
                        <span className="text-[13px] text-[#4B5563]">
                          Due: ${(invoice.amount_due || 0).toLocaleString()} / Total: ${(invoice.total_amount || invoice.total || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {invoice.pdf_url && (
                        <a 
                          href={invoice.pdf_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[13px] text-[#2563EB] hover:underline whitespace-nowrap"
                        >
                          PDF <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {(invoice.online_payment_url || invoice.online_invoice_url) && (
                        <a 
                          href={invoice.online_payment_url || invoice.online_invoice_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[13px] text-[#2563EB] hover:underline whitespace-nowrap"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnlinkInvoice(invoice.id);
                        }}
                        disabled={unlinkingInvoice === invoice.id}
                        className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Unlink invoice from project"
                      >
                        <Unlink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legacy Invoice */}
          {projectXeroInvoices.length === 0 && project.legacy_xero_invoice_url && (
             <div className="bg-white border border-[#E5E7EB] rounded-lg p-3">
               <div className="flex justify-between items-center">
                 <div>
                   <div className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Legacy Invoice</div>
                   <div className="text-[13px] text-[#4B5563]">Legacy Xero link available</div>
                 </div>
                 <a 
                    href={project.legacy_xero_invoice_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[13px] text-[#2563EB] hover:underline"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
               </div>
             </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Notes */}
      {isAdminOrManager && (
        <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2]">
            Financial Notes (Admin Only)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <RichTextField
            value={project.financial_notes || ""}
            onChange={(value) => onUpdate({ financial_notes: value })}
            placeholder="Add private financial notes, payment terms, or other admin-only information..."
          />
        </CardContent>
      </Card>
      )}
    </div>
  );
}
