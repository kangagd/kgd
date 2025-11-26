import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardCheck, 
  User, 
  Calendar, 
  Image as ImageIcon, 
  Ruler, 
  MessageCircle,
  ArrowRight,
  FileText,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import moment from "moment";

const outcomeLabels = {
  new_quote: "New Quote",
  update_quote: "Update Quote",
  send_invoice: "Send Invoice",
  completed: "Completed",
  return_visit_required: "Return Visit Required"
};

const outcomeColors = {
  new_quote: "bg-purple-100 text-purple-800",
  update_quote: "bg-indigo-100 text-indigo-800",
  send_invoice: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  return_visit_required: "bg-amber-100 text-amber-800"
};

export default function InitialVisitSummary({ project, onViewJob }) {
  const [isMinimized, setIsMinimized] = React.useState(false);

  if (!project.initial_visit_job_id) {
    return null;
  }

  const hasContent = project.initial_visit_overview || 
                     project.initial_visit_next_steps || 
                     project.initial_visit_customer_communication ||
                     project.initial_visit_measurements ||
                     (project.initial_visit_image_urls && project.initial_visit_image_urls.length > 0);

  if (!hasContent) {
    return null;
  }

  return (
    <Card className="border-2 border-blue-200 bg-blue-50/50 shadow-sm rounded-xl overflow-hidden">
      <CardHeader className={`bg-blue-100/50 ${isMinimized ? 'pb-3' : 'pb-3'}`}>
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <CardTitle className="text-[16px] font-semibold text-blue-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Initial Site Visit Summary
              <ChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${isMinimized ? '-rotate-90' : ''}`} />
            </CardTitle>
          </button>
          <Link 
            to={`${createPageUrl("Jobs")}?jobId=${project.initial_visit_job_id}`}
            className="text-[12px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            View Job
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        
        {/* Meta info */}
        <div className="flex items-center gap-4 text-[12px] text-blue-700 mt-2">
          {project.initial_visit_technician_name && (
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {project.initial_visit_technician_name}
            </span>
          )}
          {project.initial_visit_completed_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {moment(project.initial_visit_completed_at).format('D MMM YYYY, h:mm A')}
            </span>
          )}
          {project.initial_visit_outcome && (
            <Badge className={`${outcomeColors[project.initial_visit_outcome] || 'bg-gray-100 text-gray-800'} text-[11px]`}>
              {outcomeLabels[project.initial_visit_outcome] || project.initial_visit_outcome}
            </Badge>
          )}
        </div>
      </CardHeader>

      {!isMinimized && <CardContent className="p-4 space-y-4">
        {/* Overview */}
        {project.initial_visit_overview && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#6B7280]" />
              Overview
            </h4>
            <div 
              className="text-[14px] text-[#4B5563] bg-white rounded-lg p-3 border border-blue-100"
              dangerouslySetInnerHTML={{ __html: project.initial_visit_overview }}
            />
          </div>
        )}

        {/* Next Steps */}
        {project.initial_visit_next_steps && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <ArrowRight className="w-4 h-4 text-[#6B7280]" />
              Next Steps
            </h4>
            <div 
              className="text-[14px] text-[#4B5563] bg-white rounded-lg p-3 border border-blue-100"
              dangerouslySetInnerHTML={{ __html: project.initial_visit_next_steps }}
            />
          </div>
        )}

        {/* Customer Communication */}
        {project.initial_visit_customer_communication && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-[#6B7280]" />
              Customer Communication
            </h4>
            <div 
              className="text-[14px] text-[#4B5563] bg-white rounded-lg p-3 border border-blue-100"
              dangerouslySetInnerHTML={{ __html: project.initial_visit_customer_communication }}
            />
          </div>
        )}

        {/* Measurements */}
        {project.initial_visit_measurements && Object.keys(project.initial_visit_measurements).length > 0 && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-[#6B7280]" />
              Measurements
            </h4>
            <div className="bg-white rounded-lg p-3 border border-blue-100 space-y-4">
              {/* New Door Measurements */}
              {project.initial_visit_measurements.new_door && Object.keys(project.initial_visit_measurements.new_door).some(k => project.initial_visit_measurements.new_door[k]) && (
                <div>
                  <h5 className="text-[12px] font-semibold text-[#4B5563] mb-2">New Door</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-[13px]">
                    {project.initial_visit_measurements.new_door.height_left && (
                      <div>
                        <span className="text-[#6B7280]">Height L:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.height_left}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.height_mid && (
                      <div>
                        <span className="text-[#6B7280]">Height M:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.height_mid}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.height_right && (
                      <div>
                        <span className="text-[#6B7280]">Height R:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.height_right}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.width_top && (
                      <div>
                        <span className="text-[#6B7280]">Width T:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.width_top}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.width_mid && (
                      <div>
                        <span className="text-[#6B7280]">Width M:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.width_mid}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.width_bottom && (
                      <div>
                        <span className="text-[#6B7280]">Width B:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.width_bottom}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.headroom && (
                      <div>
                        <span className="text-[#6B7280]">Headroom:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.headroom}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.sideroom_left && (
                      <div>
                        <span className="text-[#6B7280]">Sideroom L:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.sideroom_left}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.sideroom_right && (
                      <div>
                        <span className="text-[#6B7280]">Sideroom R:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.sideroom_right}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.type && (
                      <div>
                        <span className="text-[#6B7280]">Type:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.type}</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.finish && (
                      <div>
                        <span className="text-[#6B7280]">Finish:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.finish}</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.new_door.colour && (
                      <div>
                        <span className="text-[#6B7280]">Colour:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.new_door.colour}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Existing Door Measurements */}
              {project.initial_visit_measurements.existing_door && project.initial_visit_measurements.existing_door.removal_required === "Y" && (
                <div className="pt-3 border-t border-blue-100">
                  <h5 className="text-[12px] font-semibold text-[#4B5563] mb-2">Existing Door (Removal Required)</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-[13px]">
                    {project.initial_visit_measurements.existing_door.height_left && (
                      <div>
                        <span className="text-[#6B7280]">Height L:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.existing_door.height_left}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.existing_door.height_right && (
                      <div>
                        <span className="text-[#6B7280]">Height R:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.existing_door.height_right}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.existing_door.width && (
                      <div>
                        <span className="text-[#6B7280]">Width:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.existing_door.width}mm</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.existing_door.type && (
                      <div>
                        <span className="text-[#6B7280]">Type:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.existing_door.type}</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.existing_door.finish && (
                      <div>
                        <span className="text-[#6B7280]">Finish:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.existing_door.finish}</span>
                      </div>
                    )}
                    {project.initial_visit_measurements.existing_door.colour && (
                      <div>
                        <span className="text-[#6B7280]">Colour:</span>
                        <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.existing_door.colour}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Legacy flat measurements (backward compatibility) */}
              {!project.initial_visit_measurements.new_door && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[13px]">
                  {project.initial_visit_measurements.width && (
                    <div>
                      <span className="text-[#6B7280]">Width:</span>
                      <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.width}</span>
                    </div>
                  )}
                  {project.initial_visit_measurements.height && (
                    <div>
                      <span className="text-[#6B7280]">Height:</span>
                      <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.height}</span>
                    </div>
                  )}
                  {project.initial_visit_measurements.headroom && (
                    <div>
                      <span className="text-[#6B7280]">Headroom:</span>
                      <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.headroom}</span>
                    </div>
                  )}
                  {project.initial_visit_measurements.sideroom_left && (
                    <div>
                      <span className="text-[#6B7280]">Sideroom L:</span>
                      <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.sideroom_left}</span>
                    </div>
                  )}
                  {project.initial_visit_measurements.sideroom_right && (
                    <div>
                      <span className="text-[#6B7280]">Sideroom R:</span>
                      <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.sideroom_right}</span>
                    </div>
                  )}
                  {project.initial_visit_measurements.depth && (
                    <div>
                      <span className="text-[#6B7280]">Depth:</span>
                      <span className="ml-1 font-medium text-[#111827]">{project.initial_visit_measurements.depth}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Info */}
              {project.initial_visit_measurements.additional_info && (
                <div className="pt-3 border-t border-blue-100">
                  <span className="text-[#6B7280] text-[12px]">Additional Info:</span>
                  <p className="text-[13px] text-[#111827] mt-0.5">{project.initial_visit_measurements.additional_info}</p>
                </div>
              )}
              {project.initial_visit_measurements.notes && (
                <div className="pt-3 border-t border-blue-100">
                  <span className="text-[#6B7280] text-[12px]">Notes:</span>
                  <p className="text-[13px] text-[#111827] mt-0.5">{project.initial_visit_measurements.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Images */}
        {project.initial_visit_image_urls && project.initial_visit_image_urls.length > 0 && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-[#6B7280]" />
              Site Photos ({project.initial_visit_image_urls.length})
            </h4>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {project.initial_visit_image_urls.slice(0, 6).map((url, index) => (
                <a 
                  key={index} 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden border border-blue-200 hover:border-blue-400 transition-colors"
                >
                  <img 
                    src={url} 
                    alt={`Site photo ${index + 1}`} 
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
              {project.initial_visit_image_urls.length > 6 && (
                <div className="aspect-square rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-[14px]">
                  +{project.initial_visit_image_urls.length - 6} more
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>}
    </Card>
  );
}