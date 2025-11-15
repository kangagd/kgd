import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, MapPin, Phone, Mail, Calendar, Clock, User, Briefcase, FileText, Image as ImageIcon, ExternalLink, DollarSign, Sparkles, MessageSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import PriceListModal from "./PriceListModal";
import TechnicianAssistant from "./TechnicianAssistant";
import SMSNotifications from "./SMSNotifications";
import PipedriveIntegration from "./PipedriveIntegration";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
};

const outcomeColors = {
  new_quote: "bg-purple-100 text-purple-800 border-purple-200",
  update_quote: "bg-indigo-100 text-indigo-800 border-indigo-200",
  send_invoice: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  return_visit_required: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function JobDetails({ job, onClose, onEdit, onStatusChange }) {
  const [showPriceList, setShowPriceList] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';

  const handlePipedriveUpdate = async (data) => {
    await base44.entities.Job.update(job.id, data);
    window.location.reload();
  };

  return (
    <>
      <Card className={`border-none shadow-lg ${isTechnician ? 'rounded-none' : ''}`}>
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <CardTitle className="text-xl md:text-2xl font-bold">{job.customer_name}</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Job #{job.job_number}</p>
              </div>
            </div>
            {!isTechnician && (
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setShowAssistant(true)}
                  className="border-orange-200 text-orange-700 hover:bg-orange-50"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span className="hidden md:inline">AI Assistant</span>
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowPriceList(true)}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  <span className="hidden md:inline">Price List</span>
                </Button>
                <Button onClick={() => onEdit(job)} className="bg-orange-600 hover:bg-orange-700">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full grid grid-cols-3 md:grid-cols-4">
              <TabsTrigger value="details" className="text-xs md:text-sm">Details</TabsTrigger>
              {isTechnician ? (
                <>
                  <TabsTrigger value="assistant" className="text-xs md:text-sm">
                    <Sparkles className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Assistant</span>
                  </TabsTrigger>
                  <TabsTrigger value="pricing" className="text-xs md:text-sm">
                    <DollarSign className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Pricing</span>
                  </TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="sms" className="text-xs md:text-sm">SMS</TabsTrigger>
                  <TabsTrigger value="pipedrive" className="text-xs md:text-sm">Pipedrive</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="flex gap-2 flex-wrap">
                <Badge className={statusColors[job.status]}>
                  {job.status.replace('_', ' ')}
                </Badge>
                {job.outcome && (
                  <Badge className={outcomeColors[job.outcome]}>
                    {job.outcome.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>

              <div className="grid gap-4">
                <div className="space-y-3">
                  {job.customer_phone && (
                    <a href={`tel:${job.customer_phone}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <Phone className="w-5 h-5 text-orange-600" />
                      <span className="font-medium">{job.customer_phone}</span>
                    </a>
                  )}
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                    <span className="text-sm">{job.address}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">
                        {job.scheduled_date && format(parseISO(job.scheduled_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    {job.scheduled_time && (
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-sm">{job.scheduled_time}</span>
                      </div>
                    )}
                  </div>
                  {job.job_type_name && (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{job.job_type_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {job.notes && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-2">Notes</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">
                    {job.notes}
                  </p>
                </div>
              )}

              {job.image_urls && job.image_urls.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-2">Photos ({job.image_urls.length})</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {job.image_urls.map((url, index) => (
                      <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={url} 
                          alt={`Job ${index + 1}`} 
                          className="w-full h-24 object-cover rounded border hover:opacity-80"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {job.status === 'scheduled' && (
                  <Button
                    onClick={() => onStatusChange('in_progress')}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    size="lg"
                  >
                    Start Job
                  </Button>
                )}
                {job.status === 'in_progress' && (
                  <Button
                    onClick={() => onStatusChange('completed')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    Complete Job
                  </Button>
                )}
              </div>
            </TabsContent>

            {isTechnician && (
              <>
                <TabsContent value="assistant" className="mt-4">
                  <div className="bg-white rounded-lg">
                    <TechnicianAssistant job={job} open={true} onClose={() => {}} />
                  </div>
                </TabsContent>

                <TabsContent value="pricing" className="mt-4">
                  <PriceListModal open={true} onClose={() => {}} />
                </TabsContent>
              </>
            )}

            {!isTechnician && (
              <>
                <TabsContent value="sms" className="mt-4">
                  <SMSNotifications job={job} />
                </TabsContent>

                <TabsContent value="pipedrive" className="mt-4">
                  <PipedriveIntegration job={job} onUpdate={handlePipedriveUpdate} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {!isTechnician && (
        <>
          <PriceListModal 
            open={showPriceList} 
            onClose={() => setShowPriceList(false)} 
          />

          <TechnicianAssistant
            open={showAssistant}
            onClose={() => setShowAssistant(false)}
            job={job}
          />
        </>
      )}
    </>
  );
}