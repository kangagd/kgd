import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Link as LinkIcon, Copy, CheckCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function PipedriveIntegration({ job, onUpdate }) {
  const [dealId, setDealId] = useState(job.pipedrive_deal_id || "");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLinkDeal = async () => {
    setIsSaving(true);
    try {
      await onUpdate({ pipedrive_deal_id: dealId });
    } catch (error) {
      console.error("Error linking deal:", error);
    }
    setIsSaving(false);
  };

  const handleUnlink = async () => {
    setDealId("");
    setIsSaving(true);
    try {
      await onUpdate({ pipedrive_deal_id: "" });
    } catch (error) {
      console.error("Error unlinking deal:", error);
    }
    setIsSaving(false);
  };

  const copyDealData = () => {
    const dealData = {
      title: `${job.customer_name} - ${job.job_type_name || 'Service'}`,
      person_name: job.customer_name,
      phone: job.customer_phone,
      email: job.customer_email,
      address: job.address,
      value: 0, // Add price if available
      status: job.status,
      expected_close_date: job.scheduled_date,
      notes: job.notes,
      custom_fields: {
        job_number: job.job_number,
        customer_type: job.customer_type,
        scheduled_time: job.scheduled_time,
      }
    };

    navigator.clipboard.writeText(JSON.stringify(dealData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusStage = () => {
    const stageMap = {
      'scheduled': 'Qualified',
      'in_progress': 'In Progress',
      'completed': 'Won',
      'cancelled': 'Lost'
    };
    return stageMap[job.status] || 'Qualified';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.5 3h-17C2.67 3 2 3.67 2 4.5v15c0 .83.67 1.5 1.5 1.5h17c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5zM12 17.5c-3.03 0-5.5-2.47-5.5-5.5S8.97 6.5 12 6.5s5.5 2.47 5.5 5.5-2.47 5.5-5.5 5.5z"/>
          </svg>
          Pipedrive Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {job.pipedrive_deal_id ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Deal Linked</p>
                  <p className="text-sm text-green-700">ID: {job.pipedrive_deal_id}</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-700">
                {getStatusStage()}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(`https://app.pipedrive.com/deal/${job.pipedrive_deal_id}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Pipedrive
              </Button>
              <Button
                variant="outline"
                onClick={handleUnlink}
                disabled={isSaving}
              >
                Unlink
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link Existing Deal</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Pipedrive Deal ID"
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                />
                <Button
                  onClick={handleLinkDeal}
                  disabled={!dealId || isSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Link
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="mb-2 block">Create New Deal</Label>
              <p className="text-sm text-slate-600 mb-3">
                Copy the job data below and create a deal in Pipedrive, then link it back here.
              </p>
              
              <div className="bg-slate-50 p-3 rounded-lg mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Deal Information</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyDealData}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-sm space-y-1 text-slate-600">
                  <p><strong>Title:</strong> {job.customer_name} - {job.job_type_name || 'Service'}</p>
                  <p><strong>Contact:</strong> {job.customer_name}</p>
                  <p><strong>Phone:</strong> {job.customer_phone}</p>
                  <p><strong>Email:</strong> {job.customer_email}</p>
                  <p><strong>Stage:</strong> {getStatusStage()}</p>
                  <p><strong>Expected Close:</strong> {job.scheduled_date}</p>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open('https://app.pipedrive.com/deal/add', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Create Deal in Pipedrive
              </Button>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> For automatic two-way sync with Pipedrive, enable backend functions in your app settings. 
            This will allow automatic deal creation and status updates.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}