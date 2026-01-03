import React from "react";
import { Calendar, Briefcase, DollarSign, Car, Package, Truck } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export const techSteps = [
  {
    id: "schedule",
    icon: Calendar,
    title: "Your Schedule",
    description: "View your daily schedule and upcoming jobs all in one place.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">What you can do:</h3>
          <ul className="space-y-2 text-[#4B5563]">
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span>View all jobs assigned to you by day, week, or month</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span>See job details including customer info, address, and special requirements</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span>Check in and out of jobs directly from the schedule</span>
            </li>
          </ul>
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
    id: "jobs",
    icon: Briefcase,
    title: "Managing Jobs",
    description: "Learn how to navigate job details, check in/out, and complete jobs.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Job Workflow:</h3>
          <ol className="space-y-2 text-[#4B5563] list-decimal list-inside">
            <li><strong>Check In:</strong> Start your job when you arrive on site</li>
            <li><strong>Review Details:</strong> View customer info, job notes, and requirements</li>
            <li><strong>Add Photos:</strong> Document your work with before/after photos</li>
            <li><strong>Record Items Used:</strong> Log materials and parts from the price list</li>
            <li><strong>Add Notes:</strong> Document work performed and any issues</li>
            <li><strong>Check Out:</strong> Complete the job and set the outcome</li>
          </ol>
        </div>
        <div className="bg-[#FEF3C7] rounded-lg p-4">
          <p className="text-sm text-[#92400E]">
            <strong>Tip:</strong> Use the Check In/Out feature to track your time on each job automatically.
          </p>
        </div>
      </div>
    )
  },
  {
    id: "pricelist",
    icon: DollarSign,
    title: "Price List & Inventory",
    description: "Access pricing and track materials used on jobs.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Using the Price List:</h3>
          <ul className="space-y-2 text-[#4B5563]">
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span>Search for parts, motors, accessories, and more</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span>View pricing and check vehicle stock availability</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span>Add items to jobs to track materials used</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span>Request restocks when running low</span>
            </li>
          </ul>
        </div>
        <Link 
          to={createPageUrl("PriceList")} 
          className="block text-center py-2 px-4 bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#111827] no-underline"
        >
          View Price List →
        </Link>
      </div>
    )
  },
  {
    id: "vehicle",
    icon: Car,
    title: "My Vehicle & Tools",
    description: "Manage your vehicle stock and conduct tools audits.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Vehicle Management:</h3>
          <ul className="space-y-2 text-[#4B5563]">
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Check Stock:</strong> View all items currently in your vehicle</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Tools Audit:</strong> Verify all tools are present and in good condition</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Add Inventory:</strong> Record items when restocking your vehicle</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FAE008] mt-1">•</span>
              <span><strong>Use Stock:</strong> Log items used on jobs to keep inventory accurate</span>
            </li>
          </ul>
        </div>
        <div className="bg-[#FEF3C7] rounded-lg p-4">
          <p className="text-sm text-[#92400E]">
            <strong>Tip:</strong> Conduct tools audits regularly to ensure everything is accounted for.
          </p>
        </div>
        <Link 
          to={createPageUrl("MyVehicle")} 
          className="block text-center py-2 px-4 bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#111827] no-underline"
        >
          View My Vehicle →
        </Link>
      </div>
    )
  },
  {
    id: "inventory",
    icon: Package,
    title: "Using Inventory",
    description: "Learn how to track and use materials from your vehicle stock.",
    content: (
      <div className="space-y-4">
        <div className="bg-[#F3F4F6] rounded-lg p-4">
          <h3 className="font-semibold text-[#111827] mb-2">Inventory Workflow:</h3>
          <ol className="space-y-2 text-[#4B5563] list-decimal list-inside">
            <li>When you use an item on a job, record it immediately</li>
            <li>This keeps your vehicle stock accurate in real-time</li>
            <li>When stock runs low, request a restock from the office</li>
            <li>Office will schedule a logistics job to replenish your vehicle</li>
          </ol>
        </div>
        <div className="bg-[#EFF6FF] rounded-lg p-4">
          <p className="text-sm text-[#1E40AF]">
            <strong>Why it matters:</strong> Accurate inventory tracking ensures you always have the parts you need and helps the office manage stock levels.
          </p>
        </div>
      </div>
    )
  },
  {
    id: "logistics",
    icon: Truck,
    title: "Logistics Jobs",
    description: "Understand the difference between standard jobs and logistics jobs.",
    content: (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#F3F4F6] rounded-lg p-4">
            <h3 className="font-semibold text-[#111827] mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Standard Jobs
            </h3>
            <ul className="space-y-1 text-sm text-[#4B5563]">
              <li>• Customer-facing work</li>
              <li>• Installations, repairs, service</li>
              <li>• Require check in/out</li>
              <li>• Bill to customer</li>
            </ul>
          </div>
          <div className="bg-[#FEF3C7] rounded-lg p-4">
            <h3 className="font-semibold text-[#111827] mb-2 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Logistics Jobs
            </h3>
            <ul className="space-y-1 text-sm text-[#4B5563]">
              <li>• Internal operations</li>
              <li>• Pick up parts, samples</li>
              <li>• Restock your vehicle</li>
              <li>• Move inventory</li>
            </ul>
          </div>
        </div>
        <div className="bg-[#EFF6FF] rounded-lg p-4">
          <p className="text-sm text-[#1E40AF]">
            <strong>Key Difference:</strong> Logistics jobs are for moving materials and samples between locations, while standard jobs are customer work.
          </p>
        </div>
        <Link 
          to={createPageUrl("Logistics")} 
          className="block text-center py-2 px-4 bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#111827] no-underline"
        >
          View Logistics →
        </Link>
      </div>
    )
  }
];