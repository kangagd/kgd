import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import OutstandingBalanceTile from "@/components/dashboard/OutstandingBalanceTile";

export default function OutstandingBalances() {
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

  const { data: xeroInvoices = [] } = useQuery({
    queryKey: ['xeroInvoices', 'outstanding'],
    queryFn: () => base44.entities.XeroInvoice.list(),
    enabled: completedProjects.length > 0,
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  const projectsWithBalance = completedProjects.map(project => {
    if (project.financial_status === 'Balance Paid in Full' || project.financial_status === 'Written Off' || project.financial_status === 'Cancelled') {
      return null;
    }

    const allProjectInvoices = xeroInvoices.filter(inv => inv.project_id === project.id);
    
    const unpaidInvoices = allProjectInvoices.filter(inv => 
      ['SUBMITTED', 'AUTHORISED', 'OVERDUE'].includes(inv.status) && 
      (inv.amount_due || 0) > 0
    );
    
    const totalInvoiced = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount_due || 0), 0);
    
    let outstandingBalance = 0;
    if (unpaidInvoices.length > 0) {
      outstandingBalance = totalInvoiced;
    } else if (
      allProjectInvoices.length === 0 &&
      (
        project.financial_status === 'Awaiting Payment' ||
        project.financial_status === 'Initial Payment Made' ||
        project.financial_status === 'Second Payment Made' ||
        !project.financial_status
      )
    ) {
      outstandingBalance = project.total_project_value || 0;
    }

    return {
      ...project,
      outstandingBalance,
      hasInvoices: allProjectInvoices.length > 0
    };
  }).filter(p => p && p.outstandingBalance > 0)
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  const totalOutstanding = projectsWithBalance.reduce((sum, p) => sum + p.outstandingBalance, 0);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-8">
          <p className="text-[14px] text-[#6B7280] leading-[1.4]">Loading outstanding balances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(createPageUrl("Dashboard"))}
          className="mb-4 text-[#6B7280] hover:text-[#111827]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-[28px] font-bold text-[#111827] leading-[1.2] mb-2">
          Outstanding Balances
        </h1>
        <p className="text-[14px] text-[#6B7280] leading-[1.4]">
          All completed projects with outstanding payments
        </p>
      </div>

      {totalOutstanding > 0 && (
        <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#D97706]" />
              </div>
              <div>
                <p className="text-[12px] text-[#6B7280] leading-[1.35] font-medium">Total Outstanding</p>
                <p className="text-[24px] font-bold text-[#D97706] leading-[1.2]">
                  ${totalOutstanding.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="ml-auto">
                <p className="text-[14px] text-[#6B7280] leading-[1.4]">
                  {projectsWithBalance.length} {projectsWithBalance.length === 1 ? 'project' : 'projects'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {projectsWithBalance.length === 0 ? (
        <Card className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
          <CardContent className="p-12">
            <div className="text-center">
              <DollarSign className="w-14 h-14 mx-auto text-[#D1D5DB] mb-4" />
              <p className="text-[16px] text-[#4B5563] leading-[1.4] font-medium">
                No outstanding balances
              </p>
              <p className="text-[14px] text-[#6B7280] leading-[1.4] mt-2">
                All completed projects have been fully paid
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projectsWithBalance.map(project => (
            <OutstandingBalanceTile key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}