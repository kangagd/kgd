import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Upload } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import FilePreviewModal from "../../common/FilePreviewModal";
import { useState } from "react";

export default function ProjectPhotosSection({ photosByJob, projectPhotos }) {
    const [previewFile, setPreviewFile] = useState(null);

    return (
        <Collapsible defaultOpen className="border border-slate-200 rounded-lg bg-white shadow-sm">
            <CollapsibleTrigger className="w-full">
                <CardHeader className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="w-5 h-5 text-slate-500" />
                        <CardTitle className="text-base font-semibold text-slate-800">Photos</CardTitle>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <CardContent className="p-4 space-y-6">
                    {/* Project Level Photos */}
                    {projectPhotos.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-3">General Project Photos</h4>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {projectPhotos.map((url, idx) => (
                                    <img 
                                        key={idx}
                                        src={url}
                                        alt="Project"
                                        className="h-24 w-24 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90"
                                        onClick={() => setPreviewFile({ url, type: 'image', name: `Project Photo ${idx+1}` })}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Job Photos */}
                    {photosByJob.length === 0 && projectPhotos.length === 0 ? (
                         <p className="text-sm text-slate-400 italic text-center py-4">No photos uploaded yet.</p>
                    ) : (
                        photosByJob.map(group => (
                            <div key={group.jobId}>
                                <h4 className="text-sm font-medium text-slate-700 mb-2 flex justify-between">
                                    <span>{group.jobName} <span className="text-slate-400 font-normal text-xs ml-2">{new Date(group.date).toLocaleDateString()}</span></span>
                                    <span className="text-xs text-slate-400 font-normal">{group.technicians?.join(', ')}</span>
                                </h4>
                                <div className="flex gap-3 overflow-x-auto pb-2">
                                    {group.photos.map((url, idx) => (
                                        <img 
                                            key={idx}
                                            src={url}
                                            alt="Job"
                                            className="h-24 w-24 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90"
                                            onClick={() => setPreviewFile({ url, type: 'image', name: `${group.jobNumber} Photo ${idx+1}` })}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </CollapsibleContent>

            <FilePreviewModal
                isOpen={!!previewFile}
                onClose={() => setPreviewFile(null)}
                file={previewFile}
            />
        </Collapsible>
    );
}