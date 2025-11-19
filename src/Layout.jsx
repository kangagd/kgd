import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Briefcase, Users, LayoutDashboard, Wrench, UserCircle, DollarSign, Archive as ArchiveIcon, Building2, FolderKanban, RefreshCw } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { base44 } from "@/api/base44Client";

const adminNavigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Schedule", url: createPageUrl("Calendar"), icon: Calendar },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Projects", url: createPageUrl("Projects"), icon: FolderKanban },
  { title: "Customers", url: createPageUrl("Customers"), icon: UserCircle },
  { title: "Organisations", url: createPageUrl("Organisations"), icon: Building2 },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
  { title: "Team", url: createPageUrl("Team"), icon: Users },
  { title: "Archive", url: createPageUrl("Archive"), icon: ArchiveIcon },
];

const technicianNavigationItems = [
  { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [viewMode, setViewMode] = React.useState(() => {
    return localStorage.getItem('viewMode') || 'auto';
  });

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'technician' ? 'admin' : 'technician';
    setViewMode(newMode);
    localStorage.setItem('viewMode', newMode);
  };

  const actualIsTechnician = user?.is_field_technician && user?.role !== 'admin';
  const isTechnician = viewMode === 'technician' ? true : viewMode === 'admin' ? false : actualIsTechnician;
  const navigationItems = isTechnician ? technicianNavigationItems : adminNavigationItems;

  if (isTechnician) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="bg-white border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#111827] rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <h1 className="font-semibold text-[#111827] text-sm">KGD</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleViewMode}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-all duration-200"
                title="Toggle view mode"
              >
                <RefreshCw className={`w-4 h-4 ${viewMode !== 'auto' ? 'text-[#FAE008]' : 'text-slate-500'}`} />
              </button>
              <button
                onClick={() => navigate(createPageUrl("UserProfile"))}
                className="flex items-center gap-2 hover:bg-slate-100 rounded-lg p-1.5 transition-all duration-200"
              >
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                  <span className="text-slate-700 font-medium text-xs">
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-16">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-2 py-2">
          <div className="flex justify-around items-center max-w-screen-sm mx-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'text-[#111827]'
                      : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F8F9FA]'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.title}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-white">
        <Sidebar className="border-r border-[#E2E3E5] bg-white">
          <SidebarHeader className="border-b border-[#E5E7EB] p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-[#111827] text-base">FieldScheduler</h2>
                <p className="text-xs text-[#6B7280]">Garage Door Services</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`hover:bg-[#F8F9FA] transition-all rounded-lg mb-1 ${
                            isActive ? 'bg-[#F8F9FA] text-[#111827] font-medium' : 'text-[#6B7280]'
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-[#E5E7EB] p-4 space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs text-[#6B7280] font-medium">View Mode</span>
              <button
                onClick={toggleViewMode}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[#F8F9FA] transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${viewMode !== 'auto' ? 'text-[#111827]' : 'text-[#9CA3AF]'}`} />
                <span className="text-xs font-medium text-[#111827] capitalize">
                  {viewMode === 'auto' ? (isTechnician ? 'Technician' : 'Admin') : viewMode}
                </span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(createPageUrl("UserProfile"))}
                className="flex items-center gap-3 flex-1 min-w-0 hover:bg-slate-50 rounded-lg p-2 transition-all duration-200"
              >
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-700 font-semibold text-sm">
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-slate-900 text-sm truncate">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 font-medium transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-[#E2E3E5] px-6 py-4 lg:hidden shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-all duration-200" />
              <h1 className="text-xl font-semibold text-slate-900">FieldScheduler</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}