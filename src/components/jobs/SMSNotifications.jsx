import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Check } from "lucide-react";
import { format } from "date-fns";

const SMS_TEMPLATES = {
  dispatch: (job) => `Hi ${job.customer_name?.split(' ')[0]}, ${job.assigned_to_name} from KangarooGD will be arriving between ${job.scheduled_time || '[time]'} for your garage door ${job.job_type_name?.toLowerCase()}. Our team will text or call when enroute. Job #${job.job_number}`,
  
  enroute: (job, eta) => `Hi ${job.customer_name?.split(' ')[0]}, ${job.assigned_to_name} from KangarooGD is on the way and will arrive in approximately ${eta} minutes. Job #${job.job_number}`,
  
  confirmation: (job) => `Hi ${job.customer_name?.split(' ')[0]}, confirming your booking with KangarooGD ${format(new Date(job.scheduled_date), 'MMM d')} between ${job.scheduled_time || '[time]'} arrival time for your garage door ${job.job_type_name?.toLowerCase()}. Please reply Y to confirm. Job #${job.job_number}`,
  
  reminder: (job) => `Hi ${job.customer_name?.split(' ')[0]}, reminder that your appointment with KangarooGD is scheduled for ${format(new Date(job.scheduled_date), 'MMM d')} between ${job.scheduled_time || '[time]'} arrival time. Please reply Y to confirm. Job #${job.job_number}`,
  
  reschedule: (job, newDate, newTime) => `Hi ${job.customer_name?.split(' ')[0]}, unfortunately we need to reschedule your appointment. We can rebook you for ${newDate} between ${newTime} arrival time. Please reply with confirmation. Apologies for the inconvenience. Job #${job.job_number}`,
  
  completed: (job) => `Thanks for choosing KangarooGD! We hope you're happy with the service. If you have a moment, we'd appreciate a review: https://g.page/r/CbZ5HufKYDMCEBE/review Job #${job.job_number}`,
};

export default function SMSNotifications({ job, onSend }) {
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentMessages, setSentMessages] = useState([]);

  const loadTemplate = (templateKey, customData = {}) => {
    setSelectedTemplate(templateKey);
    const template = SMS_TEMPLATES[templateKey];
    setMessage(template ? template(job, ...Object.values(customData)) : "");
  };

  const handleSend = async () => {
    if (!message.trim() || !job.customer_phone) return;
    
    setIsSending(true);
    try {
      // TODO: Implement actual SMS sending via your SMS provider
      // Example: await sendSMS(job.customer_phone, message);
      
      // For now, simulate sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newMessage = {
        timestamp: new Date().toISOString(),
        message: message,
        recipient: job.customer_phone,
        type: selectedTemplate
      };
      
      setSentMessages([newMessage, ...sentMessages]);
      
      if (onSend) {
        onSend(newMessage);
      }
      
      setMessage("");
      setSelectedTemplate("");
    } catch (error) {
      console.error("Error sending SMS:", error);
    } finally {
      setIsSending(false);
    }
  };

  if (!job.customer_phone) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <p className="text-sm text-orange-800">
            No phone number available for this customer. Add a phone number to send SMS notifications.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="w-5 h-5 text-orange-600" />
          SMS Notifications
        </CardTitle>
        <p className="text-sm text-slate-500">Send to: {job.customer_phone}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Quick Templates
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplate("dispatch")}
              className={selectedTemplate === "dispatch" ? "border-orange-500 bg-orange-50" : ""}
            >
              Technician Dispatch
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplate("enroute", { eta: "15" })}
              className={selectedTemplate === "enroute" ? "border-orange-500 bg-orange-50" : ""}
            >
              En Route (15 min)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplate("confirmation")}
              className={selectedTemplate === "confirmation" ? "border-orange-500 bg-orange-50" : ""}
            >
              Booking Confirmation
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplate("reminder")}
              className={selectedTemplate === "reminder" ? "border-orange-500 bg-orange-50" : ""}
            >
              Day Before Reminder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTemplate("completed")}
              className={selectedTemplate === "completed" ? "border-orange-500 bg-orange-50" : ""}
            >
              Job Complete
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Message
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message or select a template above..."
            rows={5}
            className="resize-none"
          />
          <p className="text-xs text-slate-500 mt-1">
            {message.length} characters
          </p>
        </div>

        <Button
          onClick={handleSend}
          disabled={!message.trim() || isSending}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          <Send className="w-4 h-4 mr-2" />
          {isSending ? "Sending..." : "Send SMS"}
        </Button>

        {sentMessages.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Message History</h4>
            <div className="space-y-2">
              {sentMessages.map((msg, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-xs">
                      {msg.type || "custom"}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {format(new Date(msg.timestamp), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs">{msg.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> SMS sending requires configuration of an SMS provider (Twilio, AWS SNS, etc.). 
            Contact your administrator to set up SMS integration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}