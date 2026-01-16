import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import OutstandingBalanceTile from "./OutstandingBalanceTile";

export default function OutstandingBalancesCard() {
  const navigate = useNavigate();

  const { data: completedProjects = [], isLoading } = useQuery({
    queryKey: ['projects', 'completed', 'outstanding'],
    queryFn: async () => {
      const projects = await base44.entities.Project.filter({ status: 'Completed', deleted_at: null });
      return projects.filter(p => p.total_project_value > 0);
    },
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  // Fetch invoices for completed projects
  const { data: xeroInvoices = [] } = useQuery({
    queryKey: ['xeroInvoices', 'outstanding'],
    queryFn: () => base44.entities.XeroInvoice.list(),
    enabled: completedProjects.length > 0,
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  // Calculate outstanding balance for each project
  const projectsWithBalance = completedProjects.map(project => {
    // Skip if financial status indicates full payment
    if (project.financial_status === 'Balance Paid in Full' || project.financial_status === 'Written Off' || project.financial_status === 'Cancelled') {
      return null;
    }

    // Check if ANY invoice exists (regardless of status)
    const allProjectInvoices = xeroInvoices.filter(inv => inv.project_id === project.id);
    
    // Count unpaid invoices (SUBMITTED, AUTHORISED, or OVERDUE status with amount_due > 0)
    const unpaidInvoices = allProjectInvoices.filter(inv => 
      ['SUBMITTED', 'AUTHORISED', 'OVERDUE'].includes(inv.status) && 
      (inv.amount_due || 0) > 0
    );
    
    const totalInvoiced = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount_due || 0), 0);
    
    // Calculate outstanding balance
    let outstandingBalance = 0;
    if (unpaidInvoices.length > 0) {
      // If there are unpaid invoices, use their total
      outstandingBalance = totalInvoiced;
    } else if (
      allProjectInvoices.length === 0 && // No invoices linked at all
      (
        project.financial_status === 'Awaiting Payment' ||
        project.financial_status === 'Initial Payment Made' ||
        project.financial_status === 'Second Payment Made' ||
        !project.financial_status
      )
    ) {
      // If no invoices exist and financial status indicates pending payment, use project value
      outstandingBalance = project.total_project_value || 0;
    }
    // Otherwise (invoices exist but all paid, or financial_status is 'Balance Paid in Full'), balance is 0

    return {
      ...project,
      outstandingBalance,
      hasInvoices: allProjectInvoices.length > 0
    };
  }).filter(p => p && p.outstandingBalance > 0)
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
    .slice(0, 5);

  const totalOutstanding = projectsWithBalance.reduce((sum, p) => sum + p.outstandingBalance, 0);

  if (isLoading) {
    return (
      <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
        <CardHeader className="p-7">
          <CardTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
            Outstanding Balances
          </CardTitle>
        </CardHeader>
        <CardContent className="p-7 pt-0">
          <div className="text-center py-8">
            <p className="text-[14px] text-[#6B7280] leading-[1.4]">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
      <CardHeader className="p-7">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
            Outstanding Balances
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(createPageUrl("OutstandingBalances"))}
            className="text-[#6B7280] hover:text-[#111827] text-sm"
          >
            View All →
          </Button>
        </div>
        {totalOutstanding > 0 && (
          <div className="mt-4 p-4 bg-[#FEF3C7] rounded-lg border border-[#D97706]/20">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#D97706]" />
              <div>
                <p className="text-[12px] text-[#92400E] leading-[1.35] font-medium">Total Outstanding</p>
                <p className="text-[20px] font-bold text-[#92400E] leading-[1.2]">
                  ${totalOutstanding.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-7 pt-0">
        {projectsWithBalance.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
            <p className="text-[14px] text-[#4B5563] leading-[1.4] font-normal">
              No outstanding balances
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projectsWithBalance.map(project => (
              <OutstandingBalanceTile key={project.id} project={project} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}