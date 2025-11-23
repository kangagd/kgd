import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function TechBriefCard({ jobId, isAdmin }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const { data: techBrief, isLoading } = useQuery({
    queryKey: ['techBrief', jobId],
    queryFn: async () => {
      const briefs = await base44.entities.JobTechBrief.filter({ job_id: jobId });
      return briefs.length > 0 ? briefs[0] : null;
    },
    enabled: !!jobId
  });

  const generateMutation = useMutation({
    mutationFn: async (forceRegenerate = false) => {
      const response = await base44.functions.invoke('generateJobTechBrief', {
        job_id: jobId,
        force_regenerate: forceRegenerate
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['techBrief', jobId] });
      toast.success('Tech Brief generated successfully');
    },
    onError: (error) => {
      console.error('Failed to generate tech brief:', error);
      toast.error('Failed to generate Tech Brief. Please try again.');
    }
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateMutation.mutateAsync(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      await generateMutation.mutateAsync(true);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#FAE008]/10 to-[#FAE008]/5 border-b border-[#E5E7EB] p-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 bg-[#E5E7EB] rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-[#E5E7EB] rounded animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-[#E5E7EB] rounded animate-pulse"></div>
            <div className="h-3 w-full bg-[#E5E7EB] rounded animate-pulse"></div>
            <div className="h-3 w-4/5 bg-[#E5E7EB] rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!techBrief) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-[#FAE008]/10 to-[#FAE008]/5 border-b border-[#E5E7EB] p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#111827]" />
            <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Tech Brief (AI)</h3>
          </div>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="text-[14px] text-[#6B7280] leading-[1.4] mb-4">
            No Tech Brief yet. Generate one based on this job's information.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Tech Brief
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-[#FAE008]/10 to-[#FAE008]/5 border-b border-[#E5E7EB] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#111827]" />
            <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Tech Brief (AI)</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[12px] text-[#6B7280]">
              <Clock className="w-3 h-3" />
              {techBrief.updated_date ? (
                <span>Updated {formatDistanceToNow(new Date(techBrief.updated_date), { addSuffix: true })}</span>
              ) : (
                <span>Just now</span>
              )}
            </div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="h-8 text-[12px] text-[#4B5563] hover:text-[#111827]"
              >
                {isGenerating ? (
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Regenerate
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {techBrief.summary && (
          <div>
            <h4 className="text-[12px] font-semibold text-[#4B5563] uppercase tracking-wide mb-2">Summary</h4>
            <div 
              className="text-[14px] text-[#111827] leading-[1.4] prose prose-sm max-w-none [&_ul]:my-1 [&_li]:my-0.5"
              dangerouslySetInnerHTML={{ __html: techBrief.summary }}
            />
          </div>
        )}

        {techBrief.key_risks_access && (
          <div>
            <h4 className="text-[12px] font-semibold text-[#4B5563] uppercase tracking-wide mb-2">Key Risks & Access</h4>
            <div 
              className="text-[14px] text-[#111827] leading-[1.4] prose prose-sm max-w-none [&_ul]:my-1 [&_li]:my-0.5"
              dangerouslySetInnerHTML={{ __html: techBrief.key_risks_access }}
            />
          </div>
        )}

        {techBrief.required_parts_tools && (
          <div>
            <h4 className="text-[12px] font-semibold text-[#4B5563] uppercase tracking-wide mb-2">Parts & Tools</h4>
            <div 
              className="text-[14px] text-[#111827] leading-[1.4] prose prose-sm max-w-none [&_ul]:my-1 [&_li]:my-0.5"
              dangerouslySetInnerHTML={{ __html: techBrief.required_parts_tools }}
            />
          </div>
        )}

        {techBrief.customer_expectations && (
          <div>
            <h4 className="text-[12px] font-semibold text-[#4B5563] uppercase tracking-wide mb-2">Customer Expectations</h4>
            <div 
              className="text-[14px] text-[#111827] leading-[1.4] prose prose-sm max-w-none [&_ul]:my-1 [&_li]:my-0.5"
              dangerouslySetInnerHTML={{ __html: techBrief.customer_expectations }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}