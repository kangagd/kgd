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
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import moment from "moment";

const outcomeLabels = {
  new_quote: "New Quote",
  update_quote: "Update Quote",
  send_invoice: "Send Invoice",
  completed: "Completed",
  return_visit_required: "Return Visit Required",
  stage_progression: "Stage Progression"
};

const outcomeColors = {
  new_quote: "bg-purple-100 text-purple-800",
  update_quote: "bg-indigo-100 text-indigo-800",
  send_invoice: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  return_visit_required: "bg-amber-100 text-amber-800",
  stage_progression: "bg-cyan-100 text-cyan-800"
};

export default function JobVisitSummary({ job, title, borderColor = "blue" }) {
  const [isMinimized, setIsMinimized] = React.useState(false);

  if (!job) return null;

  const hasMeasurements = job.measurements && Object.keys(job.measurements).length > 0;
  const hasContent = job.overview || job.next_steps || job.communication_with_client || hasMeasurements || (job.image_urls && job.image_urls.length > 0);

  if (!hasContent) return null;

  const borderColorMap = {
    blue: "border-blue-200 bg-blue-50/50",
    green: "border-green-200 bg-green-50/50",
    purple: "border-purple-200 bg-purple-50/50",
    orange: "border-orange-200 bg-orange-50/50",
    cyan: "border-cyan-200 bg-cyan-50/50"
  };

  const headerBgMap = {
    blue: "bg-blue-100/50",
    green: "bg-green-100/50",
    purple: "bg-purple-100/50",
    orange: "bg-orange-100/50",
    cyan: "bg-cyan-100/50"
  };

  const iconColorMap = {
    blue: "text-blue-600",
    green: "text-green-600",
    purple: "text-purple-600",
    orange: "text-orange-600",
    cyan: "text-cyan-600"
  };

  const textColorMap = {
    blue: "text-blue-900",
    green: "text-green-900",
    purple: "text-purple-900",
    orange: "text-orange-900",
    cyan: "text-cyan-900"
  };

  const metaTextMap = {
    blue: "text-blue-700",
    green: "text-green-700",
    purple: "text-purple-700",
    orange: "text-orange-700",
    cyan: "text-cyan-700"
  };

  const contentBorderMap = {
    blue: "border-blue-100",
    green: "border-green-100",
    purple: "border-purple-100",
    orange: "border-orange-100",
    cyan: "border-cyan-100"
  };

  return (
    <Card className={`border-2 ${borderColorMap[borderColor]} shadow-sm rounded-xl overflow-hidden`}>
      <CardHeader className={`${headerBgMap[borderColor]} ${isMinimized ? 'pb-3' : 'pb-3'}`}>
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <CardTitle className={`text-[16px] font-semibold ${textColorMap[borderColor]} flex items-center gap-2`}>
              <ClipboardCheck className={`w-5 h-5 ${iconColorMap[borderColor]}`} />
              {title || job.job_type_name || 'Job Summary'}
              <ChevronDown className={`w-4 h-4 ${iconColorMap[borderColor]} transition-transform ${isMinimized ? '-rotate-90' : ''}`} />
            </CardTitle>
          </button>
          <Link 
            to={`${createPageUrl("Jobs")}?jobId=${job.id}`}
            className={`text-[12px] ${iconColorMap[borderColor]} hover:opacity-80 font-medium flex items-center gap-1`}
          >
            View Job
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        
        {/* Meta info */}
        <div className={`flex items-center gap-4 text-[12px] ${metaTextMap[borderColor]} mt-2`}>
          {job.created_by && (
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {job.assigned_to_name?.[0] || job.created_by}
            </span>
          )}
          {job.updated_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {moment(job.updated_date).format('D MMM YYYY, h:mm A')}
            </span>
          )}
          {job.outcome && (
            <Badge className={`${outcomeColors[job.outcome] || 'bg-gray-100 text-gray-800'} text-[11px]`}>
              {outcomeLabels[job.outcome] || job.outcome}
            </Badge>
          )}
        </div>
      </CardHeader>

      {!isMinimized && <CardContent className="p-4 space-y-4">
        {/* Overview */}
        {job.overview && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#6B7280]" />
              Overview
            </h4>
            <div 
              className={`text-[14px] text-[#4B5563] bg-white rounded-lg p-3 border ${contentBorderMap[borderColor]}`}
              dangerouslySetInnerHTML={{ __html: job.overview }}
            />
          </div>
        )}

        {/* Next Steps */}
        {job.next_steps && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <ArrowRight className="w-4 h-4 text-[#6B7280]" />
              Next Steps
            </h4>
            <div 
              className={`text-[14px] text-[#4B5563] bg-white rounded-lg p-3 border ${contentBorderMap[borderColor]}`}
              dangerouslySetInnerHTML={{ __html: job.next_steps }}
            />
          </div>
        )}

        {/* Customer Communication */}
        {job.communication_with_client && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-[#6B7280]" />
              Customer Communication
            </h4>
            <div 
              className={`text-[14px] text-[#4B5563] bg-white rounded-lg p-3 border ${contentBorderMap[borderColor]}`}
              dangerouslySetInnerHTML={{ __html: job.communication_with_client }}
            />
          </div>
        )}

        {/* Measurements */}
        {job.measurements && Object.keys(job.measurements).length > 0 && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-[#6B7280]" />
              Measurements
            </h4>
            <div className={`bg-white rounded-lg p-3 border ${contentBorderMap[borderColor]} space-y-4`}>
              {/* New Door Measurements */}
              {job.measurements.new_door && Object.keys(job.measurements.new_door).some(k => job.measurements.new_door[k]) && (
                <div>
                  <h5 className="text-[12px] font-semibold text-[#4B5563] mb-2">New Door</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-[13px]">
                    {job.measurements.new_door.height_left && (
                      <div>
                        <span className="text-[#6B7280]">Height L:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.height_left}mm</span>
                      </div>
                    )}
                    {job.measurements.new_door.height_mid && (
                      <div>
                        <span className="text-[#6B7280]">Height M:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.height_mid}mm</span>
                      </div>
                    )}
                    {job.measurements.new_door.height_right && (
                      <div>
                        <span className="text-[#6B7280]">Height R:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.height_right}mm</span>
                      </div>
                    )}
                    {job.measurements.new_door.width_top && (
                      <div>
                        <span className="text-[#6B7280]">Width T:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.width_top}mm</span>
                      </div>
                    )}
                    {job.measurements.new_door.width_mid && (
                      <div>
                        <span className="text-[#6B7280]">Width M:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.width_mid}mm</span>
                      </div>
                    )}
                    {job.measurements.new_door.width_bottom && (
                      <div>
                        <span className="text-[#6B7280]">Width B:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.width_bottom}mm</span>
                      </div>
                    )}
                    {job.measurements.new_door.headroom && (
                      <div>
                        <span className="text-[#6B7280]">Headroom:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.headroom}mm</span>
                      </div>
                    )}
                    {job.measurements.new_door.sideroom_left && (
                      <div>
                        <span className="text-[#6B7280]">Sideroom L:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.sideroom_left}mm</span>
                      </div>
                    )}
                    {job.measurements.new_door.sideroom_right && (
                      <div>
                        <span className="text-[#6B7280]">Sideroom R:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.sideroom_right}mm</span>
                      </div>
                    )}
                    {job.measurements.new_door.type && (
                      <div>
                        <span className="text-[#6B7280]">Type:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.type}</span>
                      </div>
                    )}
                    {job.measurements.new_door.finish && (
                      <div>
                        <span className="text-[#6B7280]">Finish:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.finish}</span>
                      </div>
                    )}
                    {job.measurements.new_door.colour && (
                      <div>
                        <span className="text-[#6B7280]">Colour:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.new_door.colour}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Existing Door Measurements */}
              {job.measurements.existing_door && job.measurements.existing_door.removal_required === "Y" && (
                <div className={`pt-3 border-t ${contentBorderMap[borderColor]}`}>
                  <h5 className="text-[12px] font-semibold text-[#4B5563] mb-2">Existing Door (Removal Required)</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-[13px]">
                    {job.measurements.existing_door.height_left && (
                      <div>
                        <span className="text-[#6B7280]">Height L:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.existing_door.height_left}mm</span>
                      </div>
                    )}
                    {job.measurements.existing_door.height_right && (
                      <div>
                        <span className="text-[#6B7280]">Height R:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.existing_door.height_right}mm</span>
                      </div>
                    )}
                    {job.measurements.existing_door.width && (
                      <div>
                        <span className="text-[#6B7280]">Width:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.existing_door.width}mm</span>
                      </div>
                    )}
                    {job.measurements.existing_door.type && (
                      <div>
                        <span className="text-[#6B7280]">Type:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.existing_door.type}</span>
                      </div>
                    )}
                    {job.measurements.existing_door.finish && (
                      <div>
                        <span className="text-[#6B7280]">Finish:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.existing_door.finish}</span>
                      </div>
                    )}
                    {job.measurements.existing_door.colour && (
                      <div>
                        <span className="text-[#6B7280]">Colour:</span>
                        <span className="ml-1 font-medium text-[#111827]">{job.measurements.existing_door.colour}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Legacy flat measurements */}
              {!job.measurements.new_door && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[13px]">
                  {job.measurements.width && (
                    <div>
                      <span className="text-[#6B7280]">Width:</span>
                      <span className="ml-1 font-medium text-[#111827]">{job.measurements.width}</span>
                    </div>
                  )}
                  {job.measurements.height && (
                    <div>
                      <span className="text-[#6B7280]">Height:</span>
                      <span className="ml-1 font-medium text-[#111827]">{job.measurements.height}</span>
                    </div>
                  )}
                  {job.measurements.headroom && (
                    <div>
                      <span className="text-[#6B7280]">Headroom:</span>
                      <span className="ml-1 font-medium text-[#111827]">{job.measurements.headroom}</span>
                    </div>
                  )}
                  {job.measurements.sideroom_left && (
                    <div>
                      <span className="text-[#6B7280]">Sideroom L:</span>
                      <span className="ml-1 font-medium text-[#111827]">{job.measurements.sideroom_left}</span>
                    </div>
                  )}
                  {job.measurements.sideroom_right && (
                    <div>
                      <span className="text-[#6B7280]">Sideroom R:</span>
                      <span className="ml-1 font-medium text-[#111827]">{job.measurements.sideroom_right}</span>
                    </div>
                  )}
                  {job.measurements.depth && (
                    <div>
                      <span className="text-[#6B7280]">Depth:</span>
                      <span className="ml-1 font-medium text-[#111827]">{job.measurements.depth}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Info */}
              {job.measurements.additional_info && (
                <div className={`pt-3 border-t ${contentBorderMap[borderColor]}`}>
                  <span className="text-[#6B7280] text-[12px]">Additional Info:</span>
                  <p className="text-[13px] text-[#111827] mt-0.5">{job.measurements.additional_info}</p>
                </div>
              )}
              {job.measurements.notes && (
                <div className={`pt-3 border-t ${contentBorderMap[borderColor]}`}>
                  <span className="text-[#6B7280] text-[12px]">Notes:</span>
                  <p className="text-[13px] text-[#111827] mt-0.5">{job.measurements.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Images */}
        {job.image_urls && job.image_urls.length > 0 && (
          <div>
            <h4 className="text-[13px] font-semibold text-[#111827] mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-[#6B7280]" />
              Site Photos ({job.image_urls.length})
            </h4>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {job.image_urls.slice(0, 6).map((url, index) => (
                <a 
                  key={index} 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`aspect-square rounded-lg overflow-hidden border ${contentBorderMap[borderColor]} hover:border-${borderColor}-400 transition-colors`}
                >
                  <img 
                    src={url} 
                    alt={`Site photo ${index + 1}`} 
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
              {job.image_urls.length > 6 && (
                <div className={`aspect-square rounded-lg ${borderColorMap[borderColor]} flex items-center justify-center text-${borderColor}-700 font-medium text-[14px]`}>
                  +{job.image_urls.length - 6} more
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>}
    </Card>
  );
}