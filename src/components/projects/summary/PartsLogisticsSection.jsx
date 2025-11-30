import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Package, ArrowRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function PartsLogisticsSection({ parts, logisticsJobs }) {
    return (
        <Collapsible defaultOpen className="border border-slate-200 rounded-lg bg-white shadow-sm">
            <CollapsibleTrigger className="w-full">
                <CardHeader className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Truck className="w-5 h-5 text-slate-500" />
                        <CardTitle className="text-base font-semibold text-slate-800">Parts & Logistics</CardTitle>
                        <div className="flex gap-2">
                            {parts.length > 0 && <Badge variant="secondary" className="bg-white border">{parts.length} Parts</Badge>}
                            {logisticsJobs.length > 0 && <Badge variant="secondary" className="bg-white border">{logisticsJobs.length} Logistic Jobs</Badge>}
                        </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Parts */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-400" /> Parts Ordered
                            </h4>
                            {parts.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No parts added</p>
                            ) : (
                                <div className="space-y-2">
                                    {parts.map(part => (
                                        <div key={part.id} className="p-3 rounded border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-medium text-sm text-slate-900">{part.category}</span>
                                                <Badge variant="outline" className="text-xs">{part.status}</Badge>
                                            </div>
                                            <p className="text-xs text-slate-500">{part.description || 'No description'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Logistics */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                <Truck className="w-4 h-4 text-slate-400" /> Logistics Jobs
                            </h4>
                            {logisticsJobs.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">No logistics jobs</p>
                            ) : (
                                <div className="space-y-2">
                                    {logisticsJobs.map(job => (
                                        <div key={job.id} className="p-3 rounded border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors flex justify-between items-center">
                                            <div>
                                                <div className="font-medium text-sm text-slate-900">{job.logistics_type || 'Logistics'}</div>
                                                <div className="text-xs text-slate-500">{job.status} • {job.assigned_to_name?.[0] || 'Unassigned'}</div>
                                            </div>
                                            <a href={`${createPageUrl("Jobs")}?jobId=${job.id}`} target="_blank" rel="noopener noreferrer">
                                                <ArrowRight className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </CollapsibleContent>
        </Collapsible>
    );
}