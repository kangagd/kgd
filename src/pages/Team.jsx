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
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Team Members</h1>
          <p className="text-slate-500 mt-1">Manage your field team and staff</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Field Technicians ({technicians.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {technicians.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No field technicians yet
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {technicians.map((tech) => (
                    <div key={tech.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{tech.full_name}</h3>
                          {tech.job_title && (
                            <p className="text-sm text-slate-500">{tech.job_title}</p>
                          )}
                        </div>
                        <Badge className={tech.status === 'active' ? 
                          "bg-green-100 text-green-700" : 
                          "bg-slate-100 text-slate-700"
                        }>
                          {tech.status || 'active'}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <a href={`mailto:${tech.email}`} className="hover:text-orange-600">
                            {tech.email}
                          </a>
                        </div>
                        {tech.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <a href={`tel:${tech.phone}`} className="hover:text-orange-600">
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

          <Card className="border-none shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Administrators ({admins.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {admins.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No administrators
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {admins.map((admin) => (
                    <div key={admin.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{admin.full_name}</h3>
                          {admin.job_title && (
                            <p className="text-sm text-slate-500">{admin.job_title}</p>
                          )}
                        </div>
                        <Badge className="bg-purple-100 text-purple-700">
                          Admin
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <a href={`mailto:${admin.email}`} className="hover:text-orange-600">
                            {admin.email}
                          </a>
                        </div>
                        {admin.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <a href={`tel:${admin.phone}`} className="hover:text-orange-600">
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

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-slate-700">
            <strong>Note:</strong> To add or manage team members, use the user management section in your dashboard settings. 
            Mark users as field technicians by updating their profile.
          </p>
        </div>
      </div>
    </div>
  );
}