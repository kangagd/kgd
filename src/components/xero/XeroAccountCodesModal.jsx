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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Settings } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function XeroAccountCodesModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ['xeroSettings'],
    queryFn: async () => {
      const all = await base44.entities.XeroSettings.list();
      return all[0] || null;
    },
    enabled: open
  });

  const [formData, setFormData] = useState({
    bank_account_code: settings?.bank_account_code || "200",
    income_account_code: settings?.income_account_code || "200",
    invoice_prefix: settings?.invoice_prefix || "INV-",
    payment_terms: settings?.payment_terms || "Due on receipt",
    auto_sync_customers: settings?.auto_sync_customers ?? true,
    auto_push_invoices: settings?.auto_push_invoices ?? false
  });

  React.useEffect(() => {
    if (settings) {
      setFormData({
        bank_account_code: settings.bank_account_code || "200",
        income_account_code: settings.income_account_code || "200",
        invoice_prefix: settings.invoice_prefix || "INV-",
        payment_terms: settings.payment_terms || "Due on receipt",
        auto_sync_customers: settings.auto_sync_customers ?? true,
        auto_push_invoices: settings.auto_push_invoices ?? false
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (settings?.id) {
        return await base44.entities.XeroSettings.update(settings.id, data);
      } else {
        return await base44.entities.XeroSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xeroSettings'] });
      onClose();
    },
    onError: (err) => {
      setError(err.message || 'Failed to update settings');
    }
  });

  const handleSave = () => {
    setError("");
    
    if (!formData.bank_account_code || !formData.income_account_code) {
      setError("Account codes are required");
      return;
    }

    updateSettingsMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl border-2 border-[#E5E7EB]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#FAE008]" />
            <DialogTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
              Xero Settings
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-[14px] text-blue-900">
              Configure account codes and automation settings for Xero integration.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                Bank Account Code
              </Label>
              <Input
                type="text"
                value={formData.bank_account_code}
                onChange={(e) => setFormData({ ...formData, bank_account_code: e.target.value })}
                placeholder="200"
              />
              <p className="text-[12px] text-[#6B7280] mt-1">
                Xero account code for receiving payments (e.g., 200 for Bank Account)
              </p>
            </div>

            <div>
              <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                Income Account Code
              </Label>
              <Input
                type="text"
                value={formData.income_account_code}
                onChange={(e) => setFormData({ ...formData, income_account_code: e.target.value })}
                placeholder="200"
              />
              <p className="text-[12px] text-[#6B7280] mt-1">
                Xero account code for sales/income (e.g., 200 for Sales, 400 for Services)
              </p>
            </div>

            <div>
              <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                Invoice Prefix
              </Label>
              <Input
                type="text"
                value={formData.invoice_prefix}
                onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
                placeholder="INV-"
              />
              <p className="text-[12px] text-[#6B7280] mt-1">
                Prefix for invoice numbers (e.g., INV-1001)
              </p>
            </div>

            <div>
              <Label className="block text-[13px] md:text-[14px] font-medium text-[#4B5563] mb-1.5">
                Payment Terms
              </Label>
              <Input
                type="text"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                placeholder="Due on receipt"
              />
              <p className="text-[12px] text-[#6B7280] mt-1">
                Default payment terms for invoices
              </p>
            </div>

            <div className="border-t border-[#E5E7EB] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[14px] font-medium text-[#111827]">
                    Auto-sync Customers
                  </Label>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">
                    Automatically create/update customers in Xero
                  </p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, auto_sync_customers: !formData.auto_sync_customers })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.auto_sync_customers ? 'bg-[#FAE008]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.auto_sync_customers ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[14px] font-medium text-[#111827]">
                    Auto-push Invoices
                  </Label>
                  <p className="text-[12px] text-[#6B7280] mt-0.5">
                    Automatically send invoices to Xero when created
                  </p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, auto_push_invoices: !formData.auto_push_invoices })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.auto_push_invoices ? 'bg-[#FAE008]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.auto_push_invoices ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
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
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={updateSettingsMutation.isPending}
            className="border-[#E5E7EB] hover:bg-[#F3F4F6] rounded-lg font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateSettingsMutation.isPending || isLoading}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold rounded-lg shadow-sm"
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}