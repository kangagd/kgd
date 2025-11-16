import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Briefcase, Users, Clock, LayoutDashboard, Wrench, UserCircle, DollarSign } from "lucide-react";
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
  { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Customers", url: createPageUrl("Customers"), icon: UserCircle },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
  { title: "Check In/Out", url: createPageUrl("CheckIn"), icon: Clock },
  { title: "Team", url: createPageUrl("Team"), icon: Users },
];

const technicianNavigationItems = [
  { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
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

  // Mobile-first layout for technicians
  if (isTechnician) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <style>{`
          :root {
            --primary: 45 100% 51%;
            --primary-foreground: 0 0% 0%;
            --accent: 45 100% 51%;
            --accent-foreground: 0 0% 0%;
            --border: 45 100% 51%;
            --input: 45 100% 51%;
            --ring: 45 100% 51%;
          }
          
          input:not([type="checkbox"]):not([type="radio"]),
          textarea,
          select,
          .border-slate-200,
          .border-slate-300,
          .border-slate-100,
          .border-amber-200,
          .border-amber-300 {
            border-color: #FAE008 !important;
          }
          
          button:not(.text-red-500):not(.text-red-600):not(.hover\\:text-red-700):not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-blue"]):not([class*="bg-slate"]):not([class*="bg-purple"]):not([class*="bg-indigo"]):not([class*="bg-amber"]):not([class*="bg-pink"]):not([class*="bg-orange"]):not([class*="text-slate"]):not(.ghost) {
            background-color: #FAE008 !important;
            color: #000 !important;
          }
          
          button:not(.text-red-500):not(.text-red-600):not(.hover\\:text-red-700):not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-blue"]):not([class*="bg-slate"]):not([class*="bg-purple"]):not([class*="bg-indigo"]):not([class*="bg-amber"]):not([class*="bg-pink"]):not([class*="bg-orange"]):not([class*="text-slate"]):not(.ghost):hover {
            background-color: #e6cd07 !important;
          }
          
          .bg-orange-50,
          .hover\\:bg-orange-50:hover {
            background-color: #fffacc !important;
          }
          
          .text-orange-600,
          .text-orange-700,
          .hover\\:text-orange-600:hover,
          .hover\\:text-orange-700:hover {
            color: #000 !important;
          }
        `}</style>
        <header className="bg-white border-b px-3 py-2 sticky top-0 z-50" style={{ borderColor: '#FAE008' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FAE008' }}>
                <Wrench className="w-3.5 h-3.5 text-black" />
              </div>
              <div>
                <h1 className="font-bold text-black text-sm">KGD</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FAE008' }}>
                <span className="text-black font-medium text-xs">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-16 bg-white">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white px-1 py-1.5" style={{ borderTop: '1px solid #FAE008' }}>
          <div className="flex justify-around items-center max-w-screen-sm mx-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                    isActive 
                      ? 'text-black' 
                      : 'text-black hover:text-black'
                  }`}
                  style={isActive ? { backgroundColor: '#fffacc' } : {}}
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

  // Desktop layout for admins
  return (
    <SidebarProvider>
      <style>{`
        :root {
          --primary: 45 100% 51%;
          --primary-foreground: 0 0% 0%;
          --accent: 45 100% 51%;
          --accent-foreground: 0 0% 0%;
          --border: 45 100% 51%;
          --input: 45 100% 51%;
          --ring: 45 100% 51%;
        }
        
        input:not([type="checkbox"]):not([type="radio"]),
        textarea,
        select,
        .border-slate-200,
        .border-slate-300,
        .border-slate-100,
        .border-amber-200,
        .border-amber-300 {
          border-color: #FAE008 !important;
        }
        
        button:not(.text-red-500):not(.text-red-600):not(.hover\\:text-red-700):not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-blue"]):not([class*="bg-slate"]):not([class*="bg-purple"]):not([class*="bg-indigo"]):not([class*="bg-amber"]):not([class*="bg-pink"]):not([class*="bg-orange"]):not([class*="text-slate"]):not(.ghost) {
          background-color: #FAE008 !important;
          color: #000 !important;
        }
        
        button:not(.text-red-500):not(.text-red-600):not(.hover\\:text-red-700):not([class*="bg-red"]):not([class*="bg-green"]):not([class*="bg-blue"]):not([class*="bg-slate"]):not([class*="bg-purple"]):not([class*="bg-indigo"]):not([class*="bg-amber"]):not([class*="bg-pink"]):not([class*="bg-orange"]):not([class*="text-slate"]):not(.ghost):hover {
          background-color: #e6cd07 !important;
        }
        
        .bg-orange-50,
        .hover\\:bg-orange-50:hover {
          background-color: #fffacc !important;
        }
        
        .text-orange-600,
        .text-orange-700,
        .hover\\:text-orange-600:hover,
        .hover\\:text-orange-700:hover {
          color: #000 !important;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-white">
        <Sidebar style={{ borderRight: '1px solid #FAE008' }}>
          <SidebarHeader className="p-4" style={{ borderBottom: '1px solid #FAE008' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#FAE008' }}>
                <Wrench className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="font-bold text-black">FieldScheduler</h2>
                <p className="text-xs text-black">Garage Door Services</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-2">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-black uppercase tracking-wider px-2 py-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`transition-colors duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'text-black' : ''
                        }`}
                        style={location.pathname === item.url ? { backgroundColor: '#fffacc' } : {}}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2 text-black hover:text-black">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4" style={{ borderTop: '1px solid #FAE008' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FAE008' }}>
                <span className="text-black font-medium text-sm">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-black text-sm truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-black truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-black hover:text-black"
              >
                Logout
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col bg-white">
          <header className="bg-white px-6 py-4 lg:hidden" style={{ borderBottom: '1px solid #FAE008' }}>
            <div className="flex items-center gap-4">
              <SidebarTrigger className="p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-semibold text-black">FieldScheduler</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-white">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}