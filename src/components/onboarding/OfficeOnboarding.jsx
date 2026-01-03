import React from "react";
import { FolderKanban, Mail, Truck, CheckSquare, Calendar, TrendingUp } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export const officeSteps = [
  {
    id: "projects",
    icon: FolderKanban,
    title: "Creating Projects",
    description: "Learn how to create projects manually or from emails using AI.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Two Ways to Create Projects:</h3>
          <div className="space-y-3">
            <div>
              <p className="font-medium text-[#111827] mb-1">1. Manual Creation</p>
              <ul className="space-y-1 text-[#4B5563] text-sm ml-4">
                <li>• Click the "New Project" button</li>
                <li>• Fill in customer details, address, and requirements</li>
                <li>• Set the project type and initial status</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-[#111827] mb-1">2. From Email (AI-Powered)</p>
              <ul className="space-y-1 text-[#4B5563] text-sm ml-4">
                <li>• Go to Inbox and select an email thread</li>
                <li>• AI analyzes the email and extracts key details</li>
                <li>• Review and confirm the suggested project information</li>
                <li>• Project is created with all details pre-filled</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="bg-[#FEF3C7] rounded-lg p-4">
          <p className="text-sm text-[#92400E]">
            <strong>Tip:</strong> The AI email flow saves time by automatically extracting customer names, addresses, and project requirements from email conversations.
          </p>
        </div>
      </div>
    )
  },
  {
    id: "stages",
    icon: TrendingUp,
    title: "Project Stages",
    description: "Understand the step-by-step progression of projects through their lifecycle.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Project Stage Flow:</h3>
          <ol className="space-y-2 text-[#4B5563] list-decimal list-inside">
            <li><strong>Lead:</strong> Initial inquiry or contact</li>
            <li><strong>Initial Site Visit:</strong> Schedule tech to assess the site</li>
            <li><strong>Create Quote:</strong> Prepare pricing and scope</li>
            <li><strong>Quote Sent:</strong> Quote delivered to customer</li>
            <li><strong>Quote Approved:</strong> Customer accepts the quote</li>
            <li><strong>Final Measure:</strong> Precise measurements before ordering</li>
            <li><strong>Parts Ordered:</strong> Materials on order from suppliers</li>
            <li><strong>Scheduled:</strong> Installation job scheduled</li>
            <li><strong>Completed:</strong> Work finished and signed off</li>
          </ol>
        </div>
        <div className="bg-[#EFF6FF] rounded-lg p-4">
          <p className="text-sm text-[#1E40AF]">
            <strong>Key Insight:</strong> Moving projects through stages triggers automated workflows like creating jobs, ordering parts, and generating invoices.
          </p>
        </div>
        <Link 
          to={createPageUrl("Projects")} 
          className="block text-center py-2 px-4 bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#111827] no-underline"
        >
          View Projects →
        </Link>
      </div>
    )
  },
  {
    id: "logistics",
    icon: Truck,
    title: "Logistics & Suppliers",
    description: "Manage purchase orders, parts tracking, and sample logistics.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Logistics Workflow:</h3>
          <div className="space-y-3">
            <div>
              <p className="font-medium text-[#111827] mb-1">Purchase Orders (POs):</p>
              <ul className="space-y-1 text-[#4B5563] text-sm ml-4">
                <li>• Create POs for parts needed on projects</li>
                <li>• Track PO status: Draft → Sent → In Transit → Received</li>
                <li>• Link POs to projects automatically</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-[#111827] mb-1">Sample Management:</p>
              <ul className="space-y-1 text-[#4B5563] text-sm ml-4">
                <li>• Schedule sample drop-off to customer sites</li>
                <li>• Track sample locations in real-time</li>
                <li>• Schedule sample pick-up when ready</li>
                <li>• Creates logistics jobs for technicians</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-[#111827] mb-1">Logistics Jobs:</p>
              <ul className="space-y-1 text-[#4B5563] text-sm ml-4">
                <li>• Assigned to techs for parts pickup/delivery</li>
                <li>• Track parts from supplier to vehicle to project</li>
              </ul>
            </div>
          </div>
        </div>
        <Link 
          to={createPageUrl("SupplyLogistics")} 
          className="block text-center py-2 px-4 bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#111827] no-underline"
        >
          View Supply & Logistics →
        </Link>
      </div>
    )
  },
  {
    id: "tasks",
    icon: CheckSquare,
    title: "Task Management",
    description: "Create, assign, and track tasks to keep work organized.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Using Tasks:</h3>
          <ul className="space-y-2 text-[#4B5563]">
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Create Tasks:</strong> Quick to-dos or follow-ups</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Assign:</strong> Delegate tasks to team members</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Link to Entities:</strong> Connect tasks to projects, jobs, or customers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Set Priorities:</strong> Mark urgent tasks for visibility</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Track Progress:</strong> Mark complete when done</span>
            </li>
          </ul>
        </div>
        <div className="bg-[#FEF3C7] rounded-lg p-4">
          <p className="text-sm text-[#92400E]">
            <strong>Tip:</strong> Use tasks for anything that doesn't require a full job, like "Call customer for approval" or "Order missing part."
          </p>
        </div>
        <Link 
          to={createPageUrl("Tasks")} 
          className="block text-center py-2 px-4 bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#111827] no-underline"
        >
          View Tasks →
        </Link>
      </div>
    )
  },
  {
    id: "scheduling",
    icon: Calendar,
    title: "Scheduling Jobs",
    description: "Assign jobs to technicians and manage the team schedule.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Scheduling Workflow:</h3>
          <ol className="space-y-2 text-[#4B5563] list-decimal list-inside">
            <li>View team availability in calendar view (day, week, or month)</li>
            <li>Select a job to schedule from the sidebar</li>
            <li>Assign technician(s) based on skills and location</li>
            <li>Set date, time, and expected duration</li>
            <li>Job appears on technician's schedule automatically</li>
          </ol>
        </div>
        <div className="bg-[#EFF6FF] rounded-lg p-4">
          <p className="text-sm text-[#1E40AF]">
            <strong>Scheduling Tips:</strong> Consider travel time between jobs, technician skills, and part availability when scheduling.
          </p>
        </div>
        <Link 
          to={createPageUrl("Schedule")} 
          className="block text-center py-2 px-4 bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#111827] no-underline"
        >
          View Schedule →
        </Link>
      </div>
    )
  },
  {
    id: "inbox",
    icon: Mail,
    title: "Email Management",
    description: "Manage customer emails and convert them into projects or jobs.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Email Features:</h3>
          <ul className="space-y-2 text-[#4B5563]">
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>AI Analysis:</strong> Emails are automatically analyzed for key information</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Quick Actions:</strong> Create projects or jobs directly from emails</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Link to Existing:</strong> Connect emails to existing projects/jobs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Reply In-App:</strong> Respond to customers without leaving the platform</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Status Tracking:</strong> Mark emails as open, in progress, or closed</span>
            </li>
          </ul>
        </div>
        <div className="bg-[#FEF3C7] rounded-lg p-4">
          <p className="text-sm text-[#92400E]">
            <strong>Tip:</strong> The AI extracts customer details, addresses, and requirements automatically - saving you time on data entry.
          </p>
        </div>
        <Link 
          to={createPageUrl("Inbox")} 
          className="block text-center py-2 px-4 bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#111827] no-underline"
        >
          View Inbox →
        </Link>
      </div>
    )
  }
];