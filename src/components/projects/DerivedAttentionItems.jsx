import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { computeAttentionItems } from "./computeAttentionItems";

export default function DerivedAttentionItems({
  project,
  quotes = [],
  invoices = [],
  jobs = [],
  parts = [],
  purchaseOrders = [],
  emails = [],
  manualLogs = [],
  tradeRequirements = [],
  onNavigateToTab
}) {
  const items = computeAttentionItems({
    project,
    quotes,
    invoices,
    jobs,
    parts,
    purchaseOrders,
    emails,
    manualLogs,
    tradeRequirements
  });

  if (items.length === 0) {
    return null;
  }

  const getPriorityStyles = (priority) => {
    return priority === 'HIGH' 
      ? 'border-l-red-500 bg-red-50/50 border-red-200' 
      : 'border-l-amber-500 bg-amber-50/50 border-amber-200';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Finance': 'text-red-700',
      'Ops': 'text-orange-700',
      'Requirements': 'text-purple-700',
      'Comms': 'text-blue-700',
      'Sales': 'text-green-700'
    };
    return colors[category] || 'text-slate-700';
  };

  return (
    <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 border border-amber-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <CardTitle className="text-[16px] font-semibold text-amber-900">
            Attention Required ({items.length})
          </CardTitle>
          <span className="text-[12px] text-amber-700 font-medium ml-auto">
            {items.filter(i => i.priority === 'HIGH').length} high • {items.filter(i => i.priority === 'MEDIUM').length} medium
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTab?.(item.deepLinkTab);
            }}
            className={`w-full text-left p-3 rounded-lg border-l-2 transition-all hover:shadow-sm ${getPriorityStyles(item.priority)} hover:bg-opacity-70 cursor-pointer`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {item.priority === 'HIGH' && (
                    <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded uppercase">
                      High
                    </span>
                  )}
                  <span className={`text-[10px] font-medium ${getCategoryColor(item.category)} bg-white/70 px-1.5 py-0.5 rounded`}>
                    {item.category}
                  </span>
                </div>
                <p className="text-[14px] font-medium text-slate-900 leading-relaxed">
                  {item.message}
                </p>
              </div>
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}