import React, { useState, useEffect } from "react";
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
import { Settings, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function XeroSettingsModal({ open, onClose }) {
  const queryClient = useQueryClient();
  
  const { data: existingSettings = [] } = useQuery({
    queryKey: ['xeroSettings'],
    queryFn: () => base44.entities.XeroSettings.list(),
    enabled: open
  });

  const [formData, setFormData] = useState({
    default_account_code: "",
    default_tax_type: "OUTPUT2",
    currency: "AUD",
    payment_terms_days: 7,
    is_active: true
  });

  useEffect(() => {
    if (existingSettings.length > 0) {
      setFormData(existingSettings[0]);
    }
  }, [existingSettings]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existingSettings.length > 0) {
        return base44.entities.XeroSettings.update(existingSettings[0].id, data);
      } else {
        return base44.entities.XeroSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xeroSettings'] });
      toast.success('Xero settings saved successfully');
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Xero Invoice Settings
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900">
              These settings will be used when creating invoices in Xero. You can find your account code in Xero under Settings → Chart of Accounts.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="account_code">Default Account Code *</Label>
            <Input
              id="account_code"
              placeholder="e.g., 200"
              value={formData.default_account_code}
              onChange={(e) => setFormData({...formData, default_account_code: e.target.value.trim()})}
              required
            />
            <p className="text-xs text-red-600 mt-1 font-medium">
              Enter only the numeric code (e.g., "200"), not the full name
            </p>
          </div>

          <div>
            <Label htmlFor="tax_type">Default Tax Type *</Label>
            <Input
              id="tax_type"
              placeholder="e.g., OUTPUT2"
              value={formData.default_tax_type}
              onChange={(e) => setFormData({...formData, default_tax_type: e.target.value.trim().toUpperCase()})}
              required
            />
            <p className="text-xs text-red-600 mt-1 font-medium">
              Enter the exact tax code from Xero (e.g., "OUTPUT2" for GST on Income)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                required
              />
            </div>

            <div>
              <Label htmlFor="payment_terms">Payment Terms (days)</Label>
              <Input
                id="payment_terms"
                type="number"
                value={formData.payment_terms_days}
                onChange={(e) => setFormData({...formData, payment_terms_days: parseInt(e.target.value)})}
                required
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={saveMutation.isPending}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}