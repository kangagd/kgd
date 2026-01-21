import { DollarSign, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PricingChecklistBadges({ project }) {
  if (!project?.quote_checklist || !Array.isArray(project.quote_checklist)) {
    return null;
  }

  const pricingRequested = project.quote_checklist.find(
    (item) => item.item === "Pricing Requested" && item.checked === true
  );

  const pricingReceived = project.quote_checklist.find(
    (item) => item.item === "Pricing Received" && item.checked === true
  );

  // If both checked, show only Pricing Received
  if (pricingReceived) {
    return (
      <Badge className="bg-green-100 text-green-700 flex items-center gap-1.5 px-2 py-0.5 text-[12px]">
        <BadgeCheck className="w-3 h-3" />
        Pricing Received
      </Badge>
    );
  }

  // Otherwise show Pricing Requested if checked
  if (pricingRequested) {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 flex items-center gap-1.5 px-2 py-0.5 text-[12px]">
        <DollarSign className="w-3 h-3" />
        Pricing Requested
      </Badge>
    );
  }

  // Show nothing if neither checked
  return null;
}