import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, User, Mail, Phone, MapPin, ArrowRight } from "lucide-react";

export default function MergeCustomersModal({ 
  open, 
  onClose, 
  primaryCustomer,
  duplicateCustomers,
  onMerge,
  isSubmitting 
}) {
  const [selectedDuplicate, setSelectedDuplicate] = React.useState(null);

  React.useEffect(() => {
    if (duplicateCustomers?.length === 1) {
      setSelectedDuplicate(duplicateCustomers[0]);
    }
  }, [duplicateCustomers]);

  const handleMerge = () => {
    if (selectedDuplicate) {
      onMerge(primaryCustomer.id, selectedDuplicate.id);
    }
  };

  if (!primaryCustomer || !duplicateCustomers || duplicateCustomers.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl border-2 border-orange-200">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <DialogTitle className="text-[20px] font-semibold text-[#111827]">
              Duplicate Customer Detected
            </DialogTitle>
          </div>
          <DialogDescription className="text-[14px] text-[#6B7280]">
            A customer with similar details already exists. You can merge the duplicate with the existing customer to avoid duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Customer (trying to save) */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-blue-600 text-white">Current</Badge>
              <span className="text-[13px] font-semibold text-[#111827]">Customer You're Saving</span>
            </div>
            <div className="space-y-1 text-[13px]">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#6B7280]" />
                <span className="font-medium">{primaryCustomer.name}</span>
              </div>
              {primaryCustomer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[#4B5563]">{primaryCustomer.email}</span>
                </div>
              )}
              {primaryCustomer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[#4B5563]">{primaryCustomer.phone}</span>
                </div>
              )}
              {primaryCustomer.address_full && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[#4B5563]">{primaryCustomer.address_full}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="w-5 h-5 text-[#6B7280]" />
          </div>

          {/* Existing Duplicates */}
          <div className="space-y-2">
            <div className="text-[13px] font-semibold text-[#111827] mb-2">
              Select Existing Customer to Merge With:
            </div>
            {duplicateCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => setSelectedDuplicate(customer)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  selectedDuplicate?.id === customer.id
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-slate-200 hover:border-orange-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-100 text-orange-800">Existing</Badge>
                    {customer.match_reasons && (
                      <span className="text-[11px] text-[#6B7280]">
                        Matches: {customer.match_reasons.join(', ')}
                      </span>
                    )}
                  </div>
                  {selectedDuplicate?.id === customer.id && (
                    <Badge className="bg-orange-600 text-white text-[11px]">Selected</Badge>
                  )}
                </div>
                <div className="space-y-1 text-[13px]">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#6B7280]" />
                    <span className="font-medium">{customer.name}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#6B7280]" />
                      <span className="text-[#4B5563]">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[#6B7280]" />
                      <span className="text-[#4B5563]">{customer.phone}</span>
                    </div>
                  )}
                  {customer.address_full && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#6B7280]" />
                      <span className="text-[#4B5563]">{customer.address_full}</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[12px] text-amber-800">
            <strong>What happens when you merge?</strong>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>All projects, jobs, and records will be linked to the existing customer</li>
              <li>The duplicate customer will be archived</li>
              <li>Missing contact details will be merged into the existing customer</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-[#E5E7EB] hover:bg-[#F3F4F6] font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedDuplicate || isSubmitting}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
          >
            {isSubmitting ? 'Merging...' : 'Merge Customers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}