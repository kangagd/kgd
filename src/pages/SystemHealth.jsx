import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Activity, 
    AlertTriangle, 
    Link as LinkIcon, 
    Archive, 
    Clock, 
    FileText, 
    Wrench,
    RefreshCw,
    ArrowRight,
    Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import AccessDenied from "@/components/common/AccessDenied";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";

export default function SystemHealth() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedMetric, setSelectedMetric] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const { data: user, isLoading: userLoading } = useQuery({
        queryKey: ['me'],
        queryFn: () => base44.auth.me()
    });

    const { data: health, isLoading: healthLoading, refetch } = useQuery({
        queryKey: ['systemHealth'],
        queryFn: async () => {
            const res = await base44.functions.invoke('getSystemHealth');
            return res.data;
        },
        enabled: !!user && (user.role === 'admin' || user.role === 'manager')
    });

    // Mutations for quick fixes
    const archiveProjectMutation = useMutation({
        mutationFn: (id) => base44.entities.Project.update(id, { status: 'Lost', lost_reason: 'No longer required' }), // Or custom 'Archived' status if exists
        onSuccess: () => {
            toast.success("Project archived");
            refetch();
            setDetailsOpen(false);
        }
    });

    const deleteOrphanJobMutation = useMutation({
        mutationFn: (id) => base44.entities.Job.delete(id),
        onSuccess: () => {
            toast.success("Job deleted");
            refetch();
            setDetailsOpen(false);
        }
    });

    if (userLoading || healthLoading) {
        return <div className="p-10 text-center">Loading system health...</div>;
    }

    if (user?.role !== 'admin' && user?.role !== 'manager') {
        return <AccessDenied message="Only admins can view system health." />;
    }

    const handleViewDetails = (metricType, data) => {
        setSelectedMetric({ type: metricType, data });
        setDetailsOpen(true);
    };

    return (
        <div className="p-4 md:p-10 max-w-7xl mx-auto bg-[#f8f9fa] min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
                    <p className="text-gray-500 mt-1">Monitor data integrity and operational issues</p>
                </div>
                <Button onClick={() => refetch()} variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Stale Projects */}
                <Card className={health.staleProjects?.length > 0 ? "border-amber-200 bg-amber-50" : "border-gray-200"}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Clock className="w-5 h-5 text-amber-600" />
                            Stale Projects
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-900">{health.staleProjects?.length || 0}</div>
                        <p className="text-sm text-amber-700 mt-1">Projects inactive for > 60 days</p>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full text-amber-800 hover:bg-amber-100"
                            onClick={() => handleViewDetails('staleProjects', health.staleProjects)}
                            disabled={!health.staleProjects?.length}
                        >
                            View & Fix <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardFooter>
                </Card>

                {/* Orphaned Jobs */}
                <Card className={health.orphanedJobs?.length > 0 ? "border-red-200 bg-red-50" : "border-gray-200"}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            Orphaned Jobs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-900">{health.orphanedJobs?.length || 0}</div>
                        <p className="text-sm text-red-700 mt-1">Jobs with no project link</p>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full text-red-800 hover:bg-red-100"
                            onClick={() => handleViewDetails('orphanedJobs', health.orphanedJobs)}
                            disabled={!health.orphanedJobs?.length}
                        >
                            View Orphans <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardFooter>
                </Card>

                {/* Orphaned Quotes */}
                <Card className={health.orphanedQuotes?.length > 0 ? "border-orange-200 bg-orange-50" : "border-gray-200"}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <FileText className="w-5 h-5 text-orange-600" />
                            Orphaned Quotes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-900">{health.orphanedQuotes?.length || 0}</div>
                        <p className="text-sm text-orange-700 mt-1">Quotes not linked to Project/Job</p>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full text-orange-800 hover:bg-orange-100"
                            onClick={() => handleViewDetails('orphanedQuotes', health.orphanedQuotes)}
                            disabled={!health.orphanedQuotes?.length}
                        >
                            View Quotes <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardFooter>
                </Card>

                {/* Expiring Contracts */}
                <Card className={health.expiringContracts?.length > 0 ? "border-blue-200 bg-blue-50" : "border-gray-200"}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Activity className="w-5 h-5 text-blue-600" />
                            Expiring Contracts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-900">{health.expiringContracts?.length || 0}</div>
                        <p className="text-sm text-blue-700 mt-1">Expiring in next 30 days</p>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full text-blue-800 hover:bg-blue-100"
                            onClick={() => handleViewDetails('expiringContracts', health.expiringContracts)}
                            disabled={!health.expiringContracts?.length}
                        >
                            View Contracts <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardFooter>
                </Card>

                {/* Unlinked Parts */}
                <Card className={health.unlinkedParts?.length > 0 ? "border-gray-300 bg-gray-50" : "border-gray-200"}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Wrench className="w-5 h-5 text-gray-600" />
                            Unlinked Parts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">{health.unlinkedParts?.length || 0}</div>
                        <p className="text-sm text-gray-600 mt-1">Parts not assigned to Project/Vehicle</p>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full text-gray-800 hover:bg-gray-200"
                            onClick={() => handleViewDetails('unlinkedParts', health.unlinkedParts)}
                            disabled={!health.unlinkedParts?.length}
                        >
                            View Parts <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardFooter>
                </Card>

                {/* Failed Reports */}
                <Card className={health.failedReports?.length > 0 ? "border-red-200 bg-red-50" : "border-gray-200"}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            Failed Reports
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-900">{health.failedReports?.length || 0}</div>
                        <p className="text-sm text-red-700 mt-1">Report generation failures</p>
                    </CardContent>
                    <CardFooter>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="w-full text-red-800 hover:bg-red-100"
                            onClick={() => handleViewDetails('failedReports', health.failedReports)}
                            disabled={!health.failedReports?.length}
                        >
                            View Errors <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            {/* Details Dialog */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedMetric?.type === 'staleProjects' && 'Stale Projects'}
                            {selectedMetric?.type === 'orphanedJobs' && 'Orphaned Jobs'}
                            {selectedMetric?.type === 'orphanedQuotes' && 'Orphaned Quotes'}
                            {selectedMetric?.type === 'expiringContracts' && 'Expiring Contracts'}
                            {selectedMetric?.type === 'unlinkedParts' && 'Unlinked Parts'}
                            {selectedMetric?.type === 'failedReports' && 'Failed Reports'}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name/ID</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedMetric?.data?.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">
                                            {item.title || item.name || item.job_number || item.id}
                                        </TableCell>
                                        <TableCell>
                                            {item.date && <span className="text-xs text-gray-500">Updated: {format(parseISO(item.date), 'MMM d, yyyy')}</span>}
                                            {item.end_date && <span className="text-xs text-blue-600">Expires: {format(parseISO(item.end_date), 'MMM d, yyyy')}</span>}
                                            {item.error && <span className="text-xs text-red-600 line-clamp-1" title={item.error}>{item.error}</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {selectedMetric.type === 'staleProjects' && (
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => window.open(createPageUrl('Projects') + `?projectId=${item.id}`, '_blank')}>View</Button>
                                                    <Button variant="destructive" size="sm" onClick={() => {
                                                        if(confirm('Archive project?')) archiveProjectMutation.mutate(item.id);
                                                    }}>Archive</Button>
                                                </div>
                                            )}
                                            {selectedMetric.type === 'orphanedJobs' && (
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => window.open(createPageUrl('Jobs') + `?jobId=${item.id}`, '_blank')}>View</Button>
                                                    <Button variant="destructive" size="sm" onClick={() => {
                                                        if(confirm('Delete job?')) deleteOrphanJobMutation.mutate(item.id);
                                                    }}>Delete</Button>
                                                </div>
                                            )}
                                            {(selectedMetric.type === 'expiringContracts' || selectedMetric.type === 'orphanedQuotes') && (
                                                <Button variant="outline" size="sm" onClick={() => {
                                                    const url = selectedMetric.type === 'expiringContracts' 
                                                        ? createPageUrl('Contracts') + `?contractId=${item.id}`
                                                        : createPageUrl('Quotes') + `?quoteId=${item.id}`; // assuming quotes page supports this
                                                    window.open(url, '_blank');
                                                }}>View</Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}