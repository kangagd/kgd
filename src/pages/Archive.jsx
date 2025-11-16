import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Archive as ArchiveIcon, RotateCcw, Trash2, Calendar, MapPin, User, Phone, Mail } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Archive() {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data: deletedJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['deletedJobs'],
    queryFn: async () => {
      const allJobs = await base44.entities.Job.list('-deleted_at');
      return allJobs.filter(job => job.deleted_at);
    }
  });

  const { data: deletedCustomers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['deletedCustomers'],
    queryFn: async () => {
      const allCustomers = await base44.entities.Customer.list('-deleted_at');
      return allCustomers.filter(customer => customer.deleted_at);
    }
  });

  const restoreJobMutation = useMutation({
    mutationFn: (jobId) => base44.entities.Job.update(jobId, { deleted_at: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedJobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const restoreCustomerMutation = useMutation({
    mutationFn: (customerId) => base44.entities.Customer.update(customerId, { deleted_at: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedCustomers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });

  const permanentDeleteJobMutation = useMutation({
    mutationFn: (jobId) => base44.entities.Job.delete(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedJobs'] });
      setConfirmDelete(null);
    }
  });

  const permanentDeleteCustomerMutation = useMutation({
    mutationFn: (customerId) => base44.entities.Customer.delete(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedCustomers'] });
      setConfirmDelete(null);
    }
  });

  const getDaysRemaining = (deletedAt) => {
    const deletedDate = new Date(deletedAt);
    const expiryDate = new Date(deletedDate);
    expiryDate.setDate(expiryDate.getDate() + 30);
    return differenceInDays(expiryDate, new Date());
  };

  const renderJobCard = (job) => {
    const daysRemaining = getDaysRemaining(job.deleted_at);
    const isExpiringSoon = daysRemaining <= 7;

    return (
      <Card key={job.id} className="border-2 border-slate-200 rounded-xl hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-[#000000] text-lg tracking-tight">{job.customer_name}</h3>
                <Badge variant="outline" className="text-xs font-medium border-slate-300">
                  #{job.job_number}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{job.address}</span>
              </div>
              {job.scheduled_date && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{format(new Date(job.scheduled_date), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
            <Badge 
              variant="outline" 
              className={`${isExpiringSoon ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'} font-semibold border-2`}
            >
              {daysRemaining} days left
            </Badge>
          </div>

          <div className="flex gap-2 pt-3 border-t-2 border-slate-200">
            <Button
              onClick={() => restoreJobMutation.mutate(job.id)}
              disabled={restoreJobMutation.isPending}
              className="flex-1 bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-semibold rounded-xl"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restore
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete({ type: 'job', id: job.id, name: job.customer_name })}
              className="rounded-xl font-semibold"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCustomerCard = (customer) => {
    const daysRemaining = getDaysRemaining(customer.deleted_at);
    const isExpiringSoon = daysRemaining <= 7;

    return (
      <Card key={customer.id} className="border-2 border-slate-200 rounded-xl hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[#000000] text-lg tracking-tight mb-2">{customer.name}</h3>
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
            </div>
            <Badge 
              variant="outline" 
              className={`${isExpiringSoon ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'} font-semibold border-2`}
            >
              {daysRemaining} days left
            </Badge>
          </div>

          <div className="flex gap-2 pt-3 border-t-2 border-slate-200">
            <Button
              onClick={() => restoreCustomerMutation.mutate(customer.id)}
              disabled={restoreCustomerMutation.isPending}
              className="flex-1 bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-semibold rounded-xl"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restore
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete({ type: 'customer', id: customer.id, name: customer.name })}
              className="rounded-xl font-semibold"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
              <ArchiveIcon className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#000000] tracking-tight">Archive</h1>
              <p className="text-slate-600 mt-1">Items deleted in the last 30 days</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="jobs" className="w-full">
          <TabsList className="w-full md:w-auto mb-6 h-11 bg-slate-100 p-1">
            <TabsTrigger value="jobs" className="font-semibold">
              Jobs ({deletedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="customers" className="font-semibold">
              Customers ({deletedCustomers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            {jobsLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse rounded-xl">
                    <CardContent className="p-6">
                      <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                      <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : deletedJobs.length === 0 ? (
              <Card className="p-12 text-center rounded-2xl border-2 border-slate-200">
                <ArchiveIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-[#000000] mb-2">No archived jobs</h3>
                <p className="text-slate-600">Deleted jobs will appear here for 30 days</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {deletedJobs.map(renderJobCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="customers">
            {customersLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse rounded-xl">
                    <CardContent className="p-6">
                      <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                      <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : deletedCustomers.length === 0 ? (
              <Card className="p-12 text-center rounded-2xl border-2 border-slate-200">
                <ArchiveIcon className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-[#000000] mb-2">No archived customers</h3>
                <p className="text-slate-600">Deleted customers will appear here for 30 days</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {deletedCustomers.map(renderCustomerCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-2 border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-[#000000]">
              Permanently Delete {confirmDelete?.type === 'job' ? 'Job' : 'Customer'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              This will permanently delete <span className="font-semibold">{confirmDelete?.name}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-semibold border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete?.type === 'job') {
                  permanentDeleteJobMutation.mutate(confirmDelete.id);
                } else {
                  permanentDeleteCustomerMutation.mutate(confirmDelete.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700 rounded-xl font-semibold"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}