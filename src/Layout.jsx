import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Calendar, 
  Briefcase, 
  Users, 
  LayoutDashboard, 
  Wrench, 
  UserCircle, 
  DollarSign, 
  Archive as ArchiveIcon, 
  Building2, 
  FolderKanban,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  TestTube2,
  LogOut,
  Image as ImageIcon,
  TrendingUp,
  Mail,
  ChevronDown,
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  CheckSquare
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NotificationBell from "./components/notifications/NotificationBell";

const primaryNavigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Search", url: createPageUrl("SearchResults"), icon: Search },
  { title: "Inbox", url: createPageUrl("Inbox"), icon: Mail },
  { title: "Tasks", url: createPageUrl("Tasks"), icon: CheckSquare },
  { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "Projects", url: createPageUrl("Projects"), icon: FolderKanban },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Customers", url: createPageUrl("Customers"), icon: UserCircle },
];

const secondaryNavigationItems = [
  { title: "Organisations", url: createPageUrl("Organisations"), icon: Building2 },
  { title: "Photos", url: createPageUrl("Photos"), icon: ImageIcon },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
  { title: "Reports", url: createPageUrl("Reports"), icon: TrendingUp },
  { title: "Team", url: createPageUrl("Team"), icon: Users },
  { title: "Archive", url: createPageUrl("Archive"), icon: ArchiveIcon },
];

const technicianNavigationItems = [
  { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Tasks", url: createPageUrl("Tasks"), icon: CheckSquare },
  { title: "Search", url: createPageUrl("SearchResults"), icon: Search },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => 
    localStorage.getItem('sidebarCollapsed') === 'true'
  );
  
  // Auto-collapse sidebar when on Inbox page with email open
  useEffect(() => {
    const isInboxPage = location.pathname === createPageUrl("Inbox");
    const params = new URLSearchParams(location.search);
    const hasEmailOpen = params.has('threadId') || window.location.href.includes('threadId');
    
    if (isInboxPage && hasEmailOpen && !isCollapsed) {
      setIsCollapsed(true);
    }
  }, [location.pathname, location.search]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [testMode, setTestMode] = useState(() => 
    localStorage.getItem('testMode') || 'off'
  );
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(() => 
    localStorage.getItem('moreMenuOpen') === 'true'
  );
  const [collapsedMoreOpen, setCollapsedMoreOpen] = useState(false);
  const [techMobileMenuOpen, setTechMobileMenuOpen] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = React.useRef(0);
  const touchStartX = React.useRef(0);
  const scrollPosition = React.useRef(0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await base44.auth.me());
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const handleTestModeToggle = () => {
    const modes = ['off', 'admin', 'technician'];
    setTestMode(modes[(modes.indexOf(testMode) + 1) % modes.length]);
  };

  const getTestModeLabel = () => 
    testMode === 'admin' ? 'Admin' : testMode === 'technician' ? 'Tech' : 'Off';

  const isTechnician = testMode === 'technician' 
    ? true 
    : testMode === 'admin' 
      ? false 
      : user?.is_field_technician && user?.role !== 'admin';
  
  const navigationItems = isTechnician ? technicianNavigationItems : primaryNavigationItems;

  // Pull to refresh and swipe to open menu
  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        scrollPosition.current = window.scrollY;
      }
    };

    const handleTouchMove = (e) => {
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const deltaX = touchX - touchStartX.current;
      const deltaY = touchY - touchStartY.current;
      
      // Pull to refresh
      if (isRefreshing) return;
      
      if (deltaY > 0 && window.scrollY === 0 && Math.abs(deltaX) < 30) {
        setIsPulling(true);
        setPullDistance(Math.min(deltaY * 0.5, 80));
        if (deltaY > 80) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = (e) => {
      const touchX = e.changedTouches[0].clientX;
      const deltaX = touchX - touchStartX.current;
      
      // Swipe right from left edge to open menu
      if (touchStartX.current < 30 && deltaX > 80) {
        if (isTechnician) {
          setTechMobileMenuOpen(true);
        } else {
          setIsMobileMenuOpen(true);
        }
      }
      
      // Pull to refresh
      if (pullDistance > 60 && !isRefreshing) {
        setIsRefreshing(true);
        window.location.reload();
      } else {
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, isTechnician, isMobileMenuOpen, techMobileMenuOpen, setIsMobileMenuOpen, setTechMobileMenuOpen]);

  // Admin check-in/out notifications
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const shownNotifications = new Set();
    
    const pollCheckInOuts = async () => {
      try {
        const recentCheckInOuts = await base44.entities.CheckInOut.list('-updated_date', 10);
        const now = Date.now();
        
        recentCheckInOuts.forEach((checkInOut) => {
          const lastUpdate = new Date(checkInOut.updated_date).getTime();
          const isRecent = (now - lastUpdate) < 60000;
          
          if (isRecent && !shownNotifications.has(checkInOut.id)) {
            shownNotifications.add(checkInOut.id);
            
            if (checkInOut.check_out_time) {
              toast.success(`${checkInOut.technician_name} checked out`, {
                description: `Job #${checkInOut.job_id}${checkInOut.check_out_notes ? ` • ${checkInOut.check_out_notes}` : ''}`,
                duration: 5000,
              });
            } else if (checkInOut.check_in_time) {
              toast.info(`${checkInOut.technician_name} checked in`, {
                description: `Job #${checkInOut.job_id}`,
                duration: 4000,
              });
            }
          }
        });
      } catch (error) {
        console.error('Error polling check-ins/outs:', error);
      }
    };

    pollCheckInOuts();
    const interval = setInterval(pollCheckInOuts, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Persist state
  useEffect(() => { localStorage.setItem('testMode', testMode); }, [testMode]);
  useEffect(() => { localStorage.setItem('sidebarCollapsed', isCollapsed); }, [isCollapsed]);
  useEffect(() => { localStorage.setItem('moreMenuOpen', isMoreMenuOpen); }, [isMoreMenuOpen]);

  // Close mobile menu on route change or ESC key
  useEffect(() => { setIsMobileMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    const handleEscape = (e) => e.key === 'Escape' && isMobileMenuOpen && setIsMobileMenuOpen(false);
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  const handleLogout = () => base44.auth.logout();

  // Mobile layout for technicians
  if (isTechnician) {
    return (
      <div className="min-h-screen flex flex-col bg-[#ffffff]">
        {/* Mobile Overlay */}
        {techMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setTechMobileMenuOpen(false)}
          />
        )}

        <header className="bg-white border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-50 shadow-sm safe-area-top">
          <div className="flex items-center justify-between min-h-[44px]">
            <button
              onClick={() => setTechMobileMenuOpen(!techMobileMenuOpen)}
              className="flex items-center gap-2 hover:bg-[#F3F4F6] rounded-lg p-2 transition-colors min-h-[44px] min-w-[44px]"
            >
              <div className="w-8 h-8 bg-[#FAE008] rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-[#111827]" />
              </div>
              <h3 className="font-semibold text-[#111827] text-[14px]">KGD</h3>
            </button>
            <button
              onClick={() => navigate(createPageUrl("UserProfile"))}
              className="flex items-center hover:bg-[#F3F4F6] rounded-lg p-2 transition-colors min-h-[44px] min-w-[44px] justify-center"
            >
              <div className="w-8 h-8 bg-[#F3F4F6] rounded-full flex items-center justify-center">
                <span className="text-[#111827] font-semibold text-sm">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            </button>
          </div>
        </header>

        {/* Dropdown Menu */}
        <div 
          className={`fixed top-[60px] left-0 right-0 bg-white border-b border-[#E5E7EB] shadow-lg z-40 transition-all duration-300 ${
            techMobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
          }`}
        >
          <nav className="p-2">
            {/* Create Buttons */}
            <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-[#E5E7EB]">
              <Button
                onClick={() => {
                  navigate(createPageUrl("Jobs") + "?action=create");
                  setTechMobileMenuOpen(false);
                }}
                className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Job
              </Button>
              <Button
                onClick={() => {
                  navigate(createPageUrl("Projects") + "?action=create");
                  setTechMobileMenuOpen(false);
                }}
                className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Project
              </Button>
            </div>

            {navigationItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <Link
                key={item.title}
                to={item.url}
                onClick={() => setTechMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors no-underline ${
                  isActive
                    ? 'bg-[#FAE008] text-[#111827]'
                    : 'text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6]'
                }`}
              >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[14px] font-medium">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 bg-[#ffffff] relative">
          {/* Pull to Refresh Indicator */}
          {isPulling && (
            <div 
              className="absolute top-0 left-0 right-0 flex justify-center items-center transition-all duration-200 z-40"
              style={{ height: `${pullDistance}px`, opacity: pullDistance / 80 }}
            >
              <div className="flex items-center gap-2 text-[#111827]">
                <svg className={`w-5 h-5 ${pullDistance > 60 ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm font-medium">{pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}</span>
              </div>
            </div>
          )}
          {children}
        </main>

        {user && user.email === 'admin@kangaroogd.com.au' && (
          <button
            onClick={handleTestModeToggle}
            className="fixed bottom-24 right-4 z-50 w-12 h-12 bg-[#D97706] hover:bg-[#B45309] text-white rounded-full shadow-lg flex items-center justify-center transition-all"
            title={`Test Mode: ${getTestModeLabel()}`}
          >
            <TestTube2 className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-[#92400E] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {getTestModeLabel().charAt(0)}
            </span>
          </button>
        )}
      </div>
    );
  }

  // Desktop/Admin layout
  return (
    <div className="min-h-screen flex bg-[#ffffff]">
      <Toaster position="top-right" richColors />
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}



      {/* Sidebar / Mobile Drawer */}
      <aside 
        className={`
          fixed lg:sticky top-0 h-screen bg-white border-r border-[#E5E7EB] z-50
          transition-all duration-300 ease-in-out flex-shrink-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'}
          w-[260px]
        `}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Close button (mobile only) */}
          <div className="lg:hidden p-3 border-b border-[#E5E7EB] flex items-center justify-end">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-[#111827]" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 min-h-0">
            <div className="space-y-1 min-w-0">
              {/* Create Buttons */}
              <div className={`grid ${isCollapsed ? 'grid-cols-1' : 'grid-cols-2'} gap-2 mb-4 pb-4 border-b border-[#E5E7EB]`}>
                <Button
                  onClick={() => navigate(createPageUrl("Jobs") + "?action=create")}
                  className={`bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold shadow-sm ${isCollapsed ? 'w-full px-2' : ''}`}
                  title={isCollapsed ? "Create Job" : ""}
                >
                  {isCollapsed ? (
                    <Briefcase className="w-4 h-4" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Job
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl("Projects") + "?action=create")}
                  className={`bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827] font-semibold shadow-sm ${isCollapsed ? 'w-full px-2' : ''}`}
                  title={isCollapsed ? "Create Project" : ""}
                >
                  {isCollapsed ? (
                    <FolderKanban className="w-4 h-4" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Project
                    </>
                  )}
                </Button>
              </div>

              {/* Primary Navigation */}
              {primaryNavigationItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative
                    ${isActive 
                      ? 'bg-[#FAE008]/10 text-[#111827] font-semibold' 
                      : 'text-[#111827] hover:bg-[#F3F4F6]'
                    }
                    ${isCollapsed ? 'justify-center' : ''}
                  `}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  title={isCollapsed ? item.title : ''}
                >
                  {isActive && <div className="absolute left-0 w-1 h-6 bg-[#FAE008] rounded-r" />}
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#FAE008]' : 'text-[#111827]'}`} />
                  {!isCollapsed && <span className="text-[14px]">{item.title}</span>}
                </Link>
              );
              })}

              {/* More Menu */}
              {!isCollapsed && (
                <div className="mt-2">
                  <button
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#111827] hover:bg-[#F3F4F6] transition-all"
                  >
                    <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
                    <span className="text-[14px] font-medium">More</span>
                  </button>

                  {isMoreMenuOpen && (
                    <div className="mt-1 space-y-1 pl-3">
                      {secondaryNavigationItems.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <Link
                            key={item.title}
                            to={item.url}
                            className={`
                              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative no-underline
                              ${isActive 
                                ? 'bg-[#FAE008]/10 text-[#111827] font-semibold' 
                                : 'text-[#111827] hover:bg-[#F3F4F6]'
                              }
                            `}
                          >
                            {isActive && <div className="absolute left-0 w-1 h-6 bg-[#FAE008] rounded-r" />}
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#FAE008]' : 'text-[#111827]'}`} />
                            <span className="text-[14px]">{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Collapsed More Menu */}
              {isCollapsed && (
                <Popover open={collapsedMoreOpen} onOpenChange={setCollapsedMoreOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all justify-center relative text-[#111827] hover:bg-[#F3F4F6]"
                      title="More"
                    >
                      <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="w-56 p-2">
                    <div className="space-y-1">
                      {secondaryNavigationItems.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <Link
                            key={item.title}
                            to={item.url}
                            onClick={() => setCollapsedMoreOpen(false)}
                            className={`
                              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative no-underline
                              ${isActive 
                                ? 'bg-[#FAE008]/10 text-[#111827] font-semibold' 
                                : 'text-[#111827] hover:bg-[#F3F4F6]'
                              }
                            `}
                          >
                            {isActive && <div className="absolute left-0 w-1 h-6 bg-[#FAE008] rounded-r" />}
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#FAE008]' : 'text-[#111827]'}`} />
                            <span className="text-[14px]">{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </nav>





          {/* Collapse Toggle */}
          <div className={`hidden lg:block p-3 border-b border-[#E5E7EB] flex-shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`flex items-center gap-3 px-3 py-2.5 hover:bg-[#F3F4F6] rounded-lg transition-colors text-[#4B5563] ${isCollapsed ? 'justify-center' : 'w-full'}`}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5 flex-shrink-0" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[14px] font-medium">Collapse Menu</span>
                </>
              )}
            </button>
          </div>

          {/* User Profile & Logout */}
          <div className="p-3 border-t border-[#E5E7EB] flex-shrink-0">
          <button
          onClick={() => navigate(createPageUrl("UserProfile"))}
          className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F3F4F6] rounded-lg transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          >
          <div className="w-8 h-8 bg-[#F3F4F6] rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-[#111827] font-semibold text-sm">
          {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
          </div>
          {!isCollapsed && (
          <div className="flex-1 min-w-0 text-left">
          <p className="font-medium text-[#111827] text-[14px] truncate">
          {user?.full_name || 'User'}
          </p>
          <p className="text-[12px] text-[#4B5563] truncate">{user?.email}</p>
          </div>
          )}
          </button>
          {!isCollapsed && (
          <div className="flex items-center gap-2 mt-2">
          <button
          onClick={handleLogout}
          className="flex-1 flex items-center gap-2 px-3 py-2.5 text-[#4B5563] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors text-[14px]"
          >
          <LogOut className="w-4 h-4" />
          Logout
          </button>
          {user && user.email === 'admin@kangaroogd.com.au' && (
          <button
          onClick={handleTestModeToggle}
          className="p-2.5 hover:bg-[#FEF3C7] rounded-lg transition-colors text-[#D97706] relative"
          title={`Test Mode: ${getTestModeLabel()}`}
          >
          <TestTube2 className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 bg-[#D97706] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {getTestModeLabel().charAt(0)}
          </span>
          </button>
          )}
          </div>
          )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#ffffff]">
        {/* Mobile Top Bar */}
        <header className="lg:hidden bg-white border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-30 safe-area-top">
          <div className="flex items-center justify-between min-h-[44px]">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Open navigation"
            >
              <Menu className="w-6 h-6 text-[#111827]" />
            </button>
            <h1 className="font-semibold text-[#111827] text-[14px] truncate px-2 flex-1 text-center">
              {[...primaryNavigationItems, ...secondaryNavigationItems].find(item => item.url === location.pathname)?.title || 'FieldScheduler'}
            </h1>
            <NotificationBell user={user} />
          </div>
        </header>

        {/* Desktop Sticky Header with Search and Notification */}
        <div className="hidden lg:flex sticky top-0 z-30 bg-[#ffffff] border-b border-[#E5E7EB] px-6 py-3 items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div 
              className="relative cursor-pointer"
              onClick={() => navigate(createPageUrl("SearchResults"))}
            >
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <Input
                placeholder="Search jobs, projects, customers..."
                className="pl-9 pr-3 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full cursor-pointer"
                readOnly
              />
            </div>
          </div>
          <NotificationBell user={user} />
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#ffffff] relative">
          {/* Pull to Refresh Indicator */}
          {isPulling && (
            <div 
              className="absolute top-0 left-0 right-0 flex justify-center items-center transition-all duration-200 z-40"
              style={{ height: `${pullDistance}px`, opacity: pullDistance / 80 }}
            >
              <div className="flex items-center gap-2 text-[#111827]">
                <svg className={`w-5 h-5 ${pullDistance > 60 ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm font-medium">{pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}</span>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Test Mode Toggle */}

    </div>
  );
}