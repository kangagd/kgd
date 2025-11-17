import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Briefcase, Users, LayoutDashboard, Wrench, UserCircle, DollarSign, Archive as ArchiveIcon, Building2, FolderKanban } from "lucide-react";
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

  const isTechnician = user?.is_field_technician && user?.role !== 'admin';
  const navigationItems = isTechnician ? technicianNavigationItems : adminNavigationItems;

  if (isTechnician) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f5f3e4]">
        <header className="bg-white border-b border-slate-200 px-3 py-2 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#fae008] rounded-lg flex items-center justify-center shadow-md">
                <Wrench className="w-4 h-4 text-slate-900" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-sm">KGD</h1>
              </div>
            </div>
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
        </header>

        <main className="flex-1 overflow-auto pb-16">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-1 py-2 shadow-lg">
          <div className="flex justify-around items-center max-w-screen-sm mx-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-[#fae008] bg-[#fae008]/10'
                      : 'text-slate-600 hover:text-[#fae008] hover:bg-slate-50'
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
      <div className="min-h-screen flex w-full bg-[#f5f3e4]">
        <Sidebar className="border-r border-slate-200 bg-white">
          <SidebarHeader className="border-b border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#fae008] rounded-xl flex items-center justify-center shadow-md">
                <Wrench className="w-6 h-6 text-slate-900" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">FieldScheduler</h2>
                <p className="text-xs text-slate-500">Garage Door Services</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`hover:bg-[#fae008]/10 hover:text-[#fae008] transition-all duration-200 rounded-lg mb-1 relative ${
                            isActive ? 'bg-[#fae008]/10 text-[#fae008]' : ''
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#fae008] rounded-r-full"></div>
                            )}
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

          <SidebarFooter className="border-t border-slate-200 p-4">
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
          <header className="bg-white border-b border-slate-200 px-6 py-4 lg:hidden shadow-sm">
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