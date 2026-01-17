import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Calendar, User, Clock, CheckCircle, Ruler, Camera, Paperclip, FileText, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { normalizeDoors } from '../utils/normalizeDoors';
import { TechnicianAvatarGroup } from '../common/TechnicianAvatar';

const outcomeColors = {
  send_invoice: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  return_visit_required: "bg-amber-100 text-amber-800",
};

export default function VisitCard({ visit, job, index }) {
  const [isOpen, setIsOpen] = useState(false);

  const measurements = normalizeDoors(job?.measurements);
  const photoCount = job?.image_urls?.length || 0;
  const docsCount = job?.other_documents?.length || 0;
  
  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg flex items-center gap-3">
                  <span>Visit #{index + 1}</span>
                  <Badge variant="secondary">{job?.job_type_name || 'Visit'}</Badge>
                </CardTitle>
                <div className="text-sm text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {format(parseISO(visit.check_out_time || visit.created_date), 'MMM d, yyyy')}</div>
                  <div className="flex items-center gap-1.5"><User className="w-4 h-4" /> {visit.technician_name}</div>
                  {visit.duration_hours && <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {visit.duration_hours.toFixed(1)}h</div>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {visit.outcome && <Badge className={outcomeColors[visit.outcome] || 'bg-gray-100'}>{visit.outcome.replace(/_/g, ' ')}</Badge>}
                <div className="flex items-center gap-2 text-muted-foreground">
                  {measurements.length > 0 && <div className="flex items-center gap-1 text-sm"><Ruler className="w-4 h-4" /> {measurements.length}</div>}
                  {photoCount > 0 && <div className="flex items-center gap-1 text-sm"><Camera className="w-4 h-4" /> {photoCount}</div>}
                  <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 p-4 space-y-4">
            {/* Outcome & Summary */}
            <section>
              <h4 className="font-semibold mb-2">Outcome & Summary</h4>
              {visit.overview && <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{__html: visit.overview}} />}
            </section>
            
            {/* Measurements */}
            {measurements.length > 0 && (
              <section>
                <h4 className="font-semibold mb-2">Measurements</h4>
                {measurements.map((door, i) => (
                  <div key={i} className="border p-3 rounded-lg mb-2">
                    <p className="font-medium mb-2">Door {i + 1}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                      {Object.entries(door).map(([key, value]) => value && (
                        <div key={key}>
                          <span className="text-muted-foreground">{key.replace(/_/g, ' ')}: </span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Findings */}
            {visit.issues_found && (
              <section>
                <h4 className="font-semibold mb-2">Findings / Issues</h4>
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{__html: visit.issues_found}} />
              </section>
            )}
            
            {/* Next Steps */}
            {visit.next_steps && (
              <section>
                <h4 className="font-semibold mb-2">Next Steps</h4>
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{__html: visit.next_steps}} />
              </section>
            )}

            {/* Photos & Attachments */}
            {photoCount + docsCount > 0 && (
              <section>
                <h4 className="font-semibold mb-2">Photos & Attachments</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {job.image_urls?.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} className="rounded-md aspect-square object-cover" /></a>)}
                </div>
              </section>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}