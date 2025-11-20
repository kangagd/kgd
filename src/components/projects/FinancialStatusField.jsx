import React from "react";
import { Badge } from "@/components/ui/badge";
import EditableField from "../jobs/EditableField";

const financialStatusColors = {
  "50% payment made": "bg-amber-100 text-amber-700",
  "30% payment made (install)": "bg-orange-100 text-orange-700",
  "Balance paid in full": "bg-emerald-100 text-emerald-700"
};

export default function FinancialStatusField({ project, onSave }) {
  return (
    <EditableField
      value={project.financial_status}
      onSave={(val) => onSave('financial_status', project.financial_status, val)}
      type="select"
      options={[
        { value: "", label: "No payment status" },
        { value: "50% payment made", label: "50% payment made" },
        { value: "30% payment made (install)", label: "30% payment made (install)" },
        { value: "Balance paid in full", label: "Balance paid in full" }
      ]}
      displayFormat={(val) => 
        val ? (
          <Badge className={`${financialStatusColors[val]} font-semibold border-0 px-3 py-1 rounded-lg text-xs`}>
            {val}
          </Badge>
        ) : (
          <span className="text-xs text-[#6B7280]">Set financial status</span>
        )
      }
    />
  );
}