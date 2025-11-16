
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
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#000000] tracking-tight">Team Members</h1>
          <p className="text-slate-600 mt-2">Manage your field team and staff</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
            <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-[#000000] tracking-tight">
                <Users className="w-6 h-6 text-[#fae008]" />
                Field Technicians ({technicians.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {technicians.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-medium">No field technicians yet</p>
                </div>
              ) : (
                <div className="divide-y-2 divide-slate-200">
                  {technicians.map((tech) => (
                    <div key={tech.id} className="p-5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-[#000000]">{tech.full_name}</h3>
                          {tech.job_title && (
                            <p className="text-sm text-slate-600 mt-1">{tech.job_title}</p>
                          )}
                        </div>
                        <Badge className={tech.status === 'active' ? 
                          "bg-green-50 text-green-900 border-green-200 border-2 font-semibold" : 
                          "bg-slate-50 text-slate-900 border-slate-200 border-2 font-semibold"
                        }>
                          {tech.status || 'active'}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <a href={`mailto:${tech.email}`} className="hover:text-[#fae008] font-medium transition-colors">
                            {tech.email}
                          </a>
                        </div>
                        {tech.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-500" />
                            <a href={`tel:${tech.phone}`} className="hover:text-[#fae008] font-medium transition-colors">
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

          <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
            <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-[#000000] tracking-tight">
                <Briefcase className="w-6 h-6 text-purple-600" />
                Administrators ({admins.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {admins.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-medium">No administrators</p>
                </div>
              ) : (
                <div className="divide-y-2 divide-slate-200">
                  {admins.map((admin) => (
                    <div key={admin.id} className="p-5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-[#000000]">{admin.full_name}</h3>
                          {admin.job_title && (
                            <p className="text-sm text-slate-600 mt-1">{admin.job_title}</p>
                          )}
                        </div>
                        <Badge className="bg-purple-50 text-purple-900 border-purple-200 border-2 font-semibold">
                          Admin
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <a href={`mailto:${admin.email}`} className="hover:text-[#fae008] font-medium transition-colors">
                            {admin.email}
                          </a>
                        </div>
                        {admin.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-500" />
                            <a href={`tel:${admin.phone}`} className="hover:text-[#fae008] font-medium transition-colors">
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

        <div className="mt-6 p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl">
          <p className="text-sm text-[#000000] leading-relaxed">
            <strong className="font-bold">Note:</strong> To add or manage team members, use the user management section in your dashboard settings. 
            Mark users as field technicians by updating their profile.
          </p>
        </div>
      </div>
    </div>
  );
}
