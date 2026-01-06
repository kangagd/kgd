import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FolderKanban, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";

export default function OutstandingBalancesCard() {
  const navigate = useNavigate();

  const { data: completedProjects = [], isLoading } = useQuery({
    queryKey: ['projects', 'completed', 'outstanding'],
    queryFn: async () => {
      const projects = await base44.entities.Project.filter({ status: 'Completed' });
      return projects.filter(p => 
        !p.deleted_at && 
        p.total_project_value > 0 &&
        (
          p.financial_status === 'Awaiting Payment' ||
          p.financial_status === 'Initial Payment Made' ||
          p.financial_status === 'Second Payment Made' ||
          !p.financial_status
        )
      );
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
    const projectInvoices = xeroInvoices.filter(inv => inv.project_id === project.id);
    const totalInvoiced = projectInvoices.reduce((sum, inv) => sum + (inv.amount_due || 0), 0);
    
    const outstandingBalance = totalInvoiced > 0 
      ? totalInvoiced 
      : project.total_project_value || 0;

    return {
      ...project,
      outstandingBalance,
      hasInvoices: projectInvoices.length > 0
    };
  }).filter(p => p.outstandingBalance > 0)
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
            onClick={() => navigate(createPageUrl("Projects") + '?status=Completed')}
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
              <div
                key={project.id}
                className="p-4 rounded-xl border border-[#E5E7EB] hover:bg-[#FEF3C7] hover:border-[#D97706] transition-all cursor-pointer"
                onClick={() => navigate(createPageUrl("Projects") + `?projectId=${project.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FolderKanban className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                      <h4 className="text-[14px] font-medium text-[#111827] leading-[1.4] truncate">
                        #{project.project_number} - {project.title}
                      </h4>
                    </div>
                    <p className="text-[12px] text-[#6B7280] leading-[1.35] mb-1">
                      {project.customer_name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="warning" className="text-[10px]">
                        {project.financial_status || 'Awaiting Payment'}
                      </Badge>
                      {!project.hasInvoices && (
                        <Badge variant="error" className="text-[10px] flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          No Invoice
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p className="text-[16px] font-bold text-[#D97706] leading-[1.2]">
                      ${project.outstandingBalance.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {project.completed_date && (
                      <p className="text-[11px] text-[#6B7280] leading-[1.35] mt-1">
                        {format(parseISO(project.completed_date), 'MMM d')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}