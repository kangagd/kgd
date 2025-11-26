import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Phone, Briefcase } from "lucide-react";

export default function Team() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const technicians = users.filter(u => u.is_field_technician);
  const admins = users.filter(u => u.role === 'admin');

  return (
    <div className="p-5 md:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="py-3 lg:py-4 mb-4 lg:mb-6">
          <h1 className="text-2xl font-bold text-[#111827] leading-tight">Team</h1>
          <p className="text-sm text-[#4B5563] mt-1">Manage your team members</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
            <CardHeader className="border-b border-[#E5E7EB] bg-[#F9FAFB] p-5">
              <CardTitle className="flex items-center gap-3 text-[18px] font-semibold text-[#111827]">
                <Users className="w-5 h-5 text-[#FAE008]" />
                Field Technicians ({technicians.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {technicians.length === 0 ? (
                <div className="p-12 text-center text-[#6B7280]">
                  <Users className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
                  <p className="font-medium">No field technicians yet</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {technicians.map((tech) => (
                    <div key={tech.id} className="p-4 hover:bg-[#F9FAFB] transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-[#111827]">{tech.full_name}</h3>
                          {tech.job_title && (
                            <p className="text-[13px] text-[#6B7280] mt-0.5">{tech.job_title}</p>
                          )}
                        </div>
                        <Badge variant={tech.status === 'active' ? 'success' : 'secondary'}>
                          {tech.status || 'active'}
                        </Badge>
                      </div>
                      <div className="space-y-1.5 text-[13px] text-[#4B5563]">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[#9CA3AF]" />
                          <a href={`mailto:${tech.email}`} className="hover:text-[#111827] transition-colors">
                            {tech.email}
                          </a>
                        </div>
                        {tech.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-[#9CA3AF]" />
                            <a href={`tel:${tech.phone}`} className="hover:text-[#111827] transition-colors">
                              {tech.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
            <CardHeader className="border-b border-[#E5E7EB] bg-[#F9FAFB] p-5">
              <CardTitle className="flex items-center gap-3 text-[18px] font-semibold text-[#111827]">
                <Briefcase className="w-5 h-5 text-purple-600" />
                Administrators ({admins.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {admins.length === 0 ? (
                <div className="p-12 text-center text-[#6B7280]">
                  <Briefcase className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
                  <p className="font-medium">No administrators</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {admins.map((admin) => (
                    <div key={admin.id} className="p-4 hover:bg-[#F9FAFB] transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-[#111827]">{admin.full_name}</h3>
                          {admin.job_title && (
                            <p className="text-[13px] text-[#6B7280] mt-0.5">{admin.job_title}</p>
                          )}
                        </div>
                        <Badge className="bg-purple-100 text-purple-800">
                          Admin
                        </Badge>
                      </div>
                      <div className="space-y-1.5 text-[13px] text-[#4B5563]">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[#9CA3AF]" />
                          <a href={`mailto:${admin.email}`} className="hover:text-[#111827] transition-colors">
                            {admin.email}
                          </a>
                        </div>
                        {admin.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-[#9CA3AF]" />
                            <a href={`tel:${admin.phone}`} className="hover:text-[#111827] transition-colors">
                              {admin.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 p-4 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl">
          <p className="text-sm text-[hsl(25,10%,12%)] leading-relaxed">
            <strong className="font-bold">Note:</strong> To add or manage team members, use the user management section in your dashboard settings. 
            Mark users as field technicians by updating their profile.
          </p>
        </div>
      </div>
    </div>
  );
}