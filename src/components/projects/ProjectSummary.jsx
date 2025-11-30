import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ProjectSnapshot from "./summary/ProjectSnapshot";
import JobOverviewSection from "./summary/JobOverviewSection";
import PartsLogisticsSection from "./summary/PartsLogisticsSection";
import ProjectPhotosSection from "./summary/ProjectPhotosSection";
import QuotesInvoicesSection from "./summary/QuotesInvoicesSection";
import WarrantySection from "./summary/WarrantySection";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RichTextField from "../common/RichTextField";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FileText } from "lucide-react";

export default function ProjectSummary({ project, onUpdate }) {
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['projectSummary', project.id],
        queryFn: async () => {
            const res = await base44.functions.invoke('project_getSummary', { projectId: project.id });
            return res.data;
        }
    });

    const handleDescriptionUpdate = async (val) => {
        await base44.entities.Project.update(project.id, { description: val });
        onUpdate?.();
    };

    const handleNotesUpdate = async (val) => {
        await base44.entities.Project.update(project.id, { summary: val }); // Using 'summary' field for Internal Notes based on previous mapping
        onUpdate?.();
    };

    if (isLoading) {
        return <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
        </div>;
    }

    if (!data) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <ProjectSnapshot 
                project={data.project} 
                summary={data.summary} 
                onUpdate={() => {
                    refetch();
                    onUpdate?.();
                }} 
            />



            <JobOverviewSection 
                jobs={data.jobs} 
                summary={data.summary} 
            />

            <PartsLogisticsSection 
                parts={data.parts} 
                logisticsJobs={data.logisticsJobs} 
            />

            <ProjectPhotosSection 
                photosByJob={data.photosByJob} 
                projectPhotos={data.projectPhotos} 
            />

            <QuotesInvoicesSection 
                quotes={data.quotes} 
                invoices={data.invoices} 
            />

            {/* Warranty Section only shows if enabled or if there are issues */}
            {(data.project.warranty_enabled || data.warrantyIssues.length > 0) && (
                <WarrantySection 
                    project={data.project} 
                    warrantyIssues={data.warrantyIssues} 
                    warrantyJobs={data.warrantyJobs}
                    onUpdate={() => {
                        refetch();
                        onUpdate?.();
                    }}
                />
            )}
        </div>
    );
}