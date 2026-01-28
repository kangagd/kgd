import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function LogisticsV2Page() {
  const [user, setUser] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [isAdminOnly, setIsAdminOnly] = useState(true);

  // Check feature flag on mount
  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        // Fetch feature flag
        const flags = await base44.entities.FeatureFlags.filter({ flag_name: 'logistics_v2_enabled' });
        if (flags.length > 0) {
          setFeatureEnabled(flags[0].enabled);
          setIsAdminOnly(flags[0].admin_only !== false);
        }
      } catch (error) {
        console.error('Error checking feature flag:', error);
        setFeatureEnabled(false);
      }
    };

    checkFeatureFlag();
  }, []);

  // Fetch logistics jobs (read-only)
  const { data: logisticsJobs = [], isLoading } = useQuery({
    queryKey: ['logisticsJobs'],
    queryFn: () => base44.entities.LogisticsJob.list('-scheduled_start', 100),
    enabled: featureEnabled && (!isAdminOnly || user?.role === 'admin'),
    staleTime: 30000,
  });

  // Access control
  if (!featureEnabled) {
    return null; // Feature is off, hide all UI
  }

  if (isAdminOnly && user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">Access denied. Logistics V2 is restricted to admins.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Logistics (V2 – Read Only)</h1>
        <p className="text-sm text-gray-600 mt-1">View upcoming and historical logistics jobs</p>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Logistics Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : logisticsJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No logistics jobs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Job #</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Purpose</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Scheduled Start</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Assigned To</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Vehicle</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Project</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {logisticsJobs.map((job) => (
                    <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">{job.logistics_job_number}</td>
                      <td className="py-3 px-4 text-gray-700">{job.purpose}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {job.scheduled_start ? format(new Date(job.scheduled_start), 'MMM d, yyyy HH:mm') : '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-700">{job.assigned_to_name || '—'}</td>
                      <td className="py-3 px-4 text-gray-700">{job.vehicle_id ? 'Vehicle' : '—'}</td>
                      <td className="py-3 px-4 text-gray-700">{job.project_id ? 'Linked' : '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedJob(job)}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Job Details</h2>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Detail Fields */}
            <div className="space-y-4">
              <DetailField label="Job Number" value={selectedJob.logistics_job_number} />
              <DetailField label="Purpose" value={selectedJob.purpose} />
              <DetailField label="Status" value={selectedJob.status} />
              <DetailField 
                label="Scheduled Start" 
                value={selectedJob.scheduled_start ? format(new Date(selectedJob.scheduled_start), 'PPP p') : '—'} 
              />
              <DetailField 
                label="Scheduled End" 
                value={selectedJob.scheduled_end ? format(new Date(selectedJob.scheduled_end), 'PPP p') : '—'} 
              />
              <DetailField label="Assigned To" value={selectedJob.assigned_to_name || '—'} />
              <DetailField label="Vehicle ID" value={selectedJob.vehicle_id || '—'} />
              <DetailField label="Project ID" value={selectedJob.project_id || '—'} />
              <DetailField label="Purchase Order ID" value={selectedJob.purchase_order_id || '—'} />
              <DetailField label="Source Location ID" value={selectedJob.source_location_id || '—'} />
              <DetailField label="Destination Location ID" value={selectedJob.destination_location_id || '—'} />
              <DetailField label="Creates Stock Movement" value={selectedJob.creates_stock_movement ? 'Yes' : 'No'} />
              <DetailField label="Legacy Job ID" value={selectedJob.legacy_job_id || '—'} />
              <DetailField label="Notes" value={selectedJob.notes || '—'} />
            </div>

            <div className="pt-4 border-t border-gray-200 text-xs text-gray-500">
              <p>Created: {format(new Date(selectedJob.created_date), 'PPP p')}</p>
              <p>Updated: {format(new Date(selectedJob.updated_date), 'PPP p')}</p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSelectedJob(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

function getStatusColor(status) {
  const colors = {
    'Draft': 'bg-gray-100 text-gray-800',
    'Scheduled': 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-amber-100 text-amber-800',
    'Completed': 'bg-green-100 text-green-800',
    'Cancelled': 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}