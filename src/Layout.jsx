import React, { useState, useEffect, useRef } from "react";
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
    CheckSquare,
    History,
    Clock,
    Shield,
    Truck,
    Car,
    Package
    } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import GlobalSearchDropdown from "./components/common/GlobalSearchDropdown";
import { RoleBadge, PermissionsProvider } from "./components/common/PermissionsContext";
import NotificationBell from "./components/notifications/NotificationBell";
import CommandPalette from "@/components/common/CommandPalette";
import ActiveCheckInBanner from "@/components/common/ActiveCheckInBanner";
import PullToRefresh from "@/components/common/PullToRefresh";

const adminNavigationGroups = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
      { title: "Inbox", url: createPageUrl("Inbox"), icon: Mail },
      { title: "Tasks", url: createPageUrl("Tasks"), icon: CheckSquare },
      { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
    ]
  },
  {
    title: "Work",
    items: [
      { title: "Projects", url: createPageUrl("Projects"), icon: FolderKanban },
      { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
      { title: "Customers", url: createPageUrl("Customers"), icon: UserCircle },
      { title: "Contracts", url: createPageUrl("Contracts"), icon: FileText },
    ]
  },
  {
    title: "Resources",
    items: [
      { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
      { title: "Suppliers", url: createPageUrl("Suppliers"), icon: Package },
      { title: "Logistics", url: createPageUrl("Logistics"), icon: Truck },
      { title: "Fleet", url: createPageUrl("Fleet"), icon: Car },
      { title: "Tools", url: createPageUrl("ToolsAdmin"), icon: Wrench },
    ]
  },
  {
    title: "Organization",
    items: [
      { title: "Team", url: createPageUrl("Team"), icon: Users },
      { title: "Organisations", url: createPageUrl("Organisations"), icon: Building2 },
      { title: "Reports", url: createPageUrl("Reports"), icon: TrendingUp },
      { title: "Photos", url: createPageUrl("Photos"), icon: ImageIcon },
      { title: "Role Settings", url: createPageUrl("RoleSettings"), icon: Shield },
      { title: "Archive", url: createPageUrl("Archive"), icon: ArchiveIcon },
    ]
  }
];

const technicianNavigationItems = [
  { title: "My Vehicle", url: createPageUrl("MyVehicle"), icon: Car },
  { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Tasks", url: createPageUrl("Tasks"), icon: CheckSquare },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
];

const viewerNavigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "Projects", url: createPageUrl("Projects"), icon: FolderKanban },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Customers", url: createPageUrl("Customers"), icon: UserCircle },
];

// Get effective role for user
const getEffectiveRole = (user) => {
  if (!user) return 'viewer';
  if (user.role === 'admin') return 'admin';
  if (user.role === 'manager') return 'manager';
  if (user.is_field_technician) return 'technician';
  if (user.role === 'viewer') return 'viewer';
  return 'user';
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => 
    localStorage.getItem('sidebarCollapsed') === 'true'
  );
  
  // Auto-collapse sidebar when on Inbox page with email open
  useEffect(() => {
    const isInboxPage = (currentPageName === "Inbox") || location.pathname.includes("Inbox");
    const params = new URLSearchParams(location.search);
    const hasEmailOpen = params.has('threadId');

    if (isInboxPage && hasEmailOpen && !isCollapsed) {
      setIsCollapsed(true);
    }
  }, [location.pathname, location.search, currentPageName, isCollapsed]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [testMode, setTestMode] = useState(() => 
    localStorage.getItem('testMode') || 'off'
  );
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(() => 
    localStorage.getItem('moreMenuOpen') === 'true'
  );
  const [collapsedMoreOpen, setCollapsedMoreOpen] = useState(false);
  const [techMobileMenuOpen, setTechMobileMenuOpen] = useState(false);
  const [recentPages, setRecentPages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('recentPages') || '[]');
    } catch {
      return [];
    }
  });
  const [recentPagesOpen, setRecentPagesOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [activeCheckIn, setActiveCheckIn] = useState(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);

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

  useEffect(() => {
    let isCancelled = false;

    const fetchActiveCheckIn = async () => {
      if (!user?.email) {
        if (!isCancelled) setActiveCheckIn(null);
        return;
      }
      try {
        // Fetch check-ins for user
        const checkIns = await base44.entities.CheckInOut.filter({ 
            technician_email: user.email 
        });
        
        if (isCancelled) return;

        // Find active one (no check_out_time)
        const active = checkIns.find(c => !c.check_out_time);
        
        if (active) {
            // Fetch job details
            try {
              const job = await base44.entities.Job.get(active.job_id);
              if (!isCancelled) setActiveCheckIn({ ...active, job });
            } catch (err) {
              console.error("Error fetching job for active check-in", err);
              // Still show banner but maybe without job details if fail
              if (!isCancelled) setActiveCheckIn({ ...active, job: null });
            }
        } else {
            if (!isCancelled) setActiveCheckIn(null);
        }
      } catch (e) {
        if (!isCancelled) console.error("Error fetching active check-in", e);
      }
    };

    if (user) {
      fetchActiveCheckIn();
      // Poll every minute
      const interval = setInterval(fetchActiveCheckIn, 60000);
      return () => {
        isCancelled = true;
        clearInterval(interval);
      };
    }
  }, [user]);

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleTestModeToggle = () => {
    const modes = ['off', 'admin', 'technician'];
    setTestMode(modes[(modes.indexOf(testMode) + 1) % modes.length]);
  };

  const getTestModeLabel = () => 
    testMode === 'admin' ? 'Admin' : testMode === 'technician' ? 'Tech' : 'Off';

  const effectiveRole = testMode === 'technician' 
    ? 'technician' 
    : testMode === 'admin' 
      ? 'admin' 
      : getEffectiveRole(user);

  const isTechnician = effectiveRole === 'technician';
  const isViewer = effectiveRole === 'viewer';
  const isAdminOrManager = effectiveRole === 'admin' || effectiveRole === 'manager';

  const navigationItems = isTechnician 
    ? technicianNavigationItems 
    : isViewer 
      ? viewerNavigationItems 
      : null; // Admin/Manager uses groups

  // Swipe to open menu
  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
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
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isTechnician, setIsMobileMenuOpen, setTechMobileMenuOpen]);

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

  // Track recent pages
  useEffect(() => {
    const trackRecentPage = async () => {
      const allAdminItems = adminNavigationGroups.flatMap(g => g.items);
      const allNavItems = [...allAdminItems, ...technicianNavigationItems, ...viewerNavigationItems];
      const currentItem = allNavItems.find(item => item.url === location.pathname);
      const params = new URLSearchParams(location.search);

      let pageEntry = null;
      const fullUrl = location.pathname + location.search;

      // Check for specific entity pages
      const projectId = params.get('projectId');
      if (location.pathname === createPageUrl("Projects") && projectId) {
        try {
          const project = await base44.entities.Project.get(projectId);
          pageEntry = { 
            title: project?.title || 'Project', 
            url: fullUrl, 
            timestamp: Date.now(),
            type: 'project'
          };
        } catch (err) {
          console.error('Error fetching project for recent pages:', err);
          pageEntry = { title: 'Project', url: fullUrl, timestamp: Date.now(), type: 'project' };
        }
      } else if (location.pathname === createPageUrl("Jobs") && params.get('jobId')) {
        try {
          const job = await base44.entities.Job.get(params.get('jobId'));
          pageEntry = { 
            title: `#${job?.job_number || ''} ${job?.customer_name || 'Job'}`.trim(), 
            url: fullUrl, 
            timestamp: Date.now(),
            type: 'job'
          };
        } catch {
          pageEntry = { title: 'Job', url: fullUrl, timestamp: Date.now(), type: 'job' };
        }
      } else if (location.pathname === createPageUrl("Jobs") && params.get('action') === 'create') {
        pageEntry = { 
          title: `New Job`, 
          url: fullUrl, 
          timestamp: Date.now(),
          type: 'form'
        };
      } else if (location.pathname === createPageUrl("Projects") && params.get('action') === 'create') {
        pageEntry = { 
          title: `New Project`, 
          url: fullUrl, 
          timestamp: Date.now(),
          type: 'form'
        };
      } else if (location.pathname === createPageUrl("Customers") && params.get('customerId')) {
        try {
          const customer = await base44.entities.Customer.get(params.get('customerId'));
          pageEntry = { 
            title: customer?.name || 'Customer', 
            url: fullUrl, 
            timestamp: Date.now(),
            type: 'customer'
          };
        } catch {
          pageEntry = { title: 'Customer', url: fullUrl, timestamp: Date.now(), type: 'customer' };
        }
      } else if (location.pathname === createPageUrl("Inbox") && params.get('threadId')) {
        pageEntry = { 
          title: `Email Thread`, 
          url: fullUrl, 
          timestamp: Date.now(),
          type: 'email'
        };
      } else if (currentItem) {
        pageEntry = { 
          title: currentItem.title, 
          url: location.pathname, 
          timestamp: Date.now(),
          type: 'page'
        };
      }

      if (pageEntry) {
        setRecentPages(prev => {
          const filtered = prev.filter(p => p.url !== pageEntry.url);
          const updated = [pageEntry, ...filtered].slice(0, 8);
          localStorage.setItem('recentPages', JSON.stringify(updated));
          return updated;
        });
      }
    };

    trackRecentPage();
  }, [location.pathname, location.search]);

  const handleLogout = () => base44.auth.logout();
  const handleRefresh = () => window.location.reload();

  return (
    <PermissionsProvider>
      <div className="min-h-screen flex bg-[#ffffff]">
        <Toaster position="top-right" richColors />

        {/* Mobile Overlay - Handles both tech and admin mobile menus */}
        {(isMobileMenuOpen || techMobileMenuOpen) && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => {
              setIsMobileMenuOpen(false);
              setTechMobileMenuOpen(false);
            }}
          />
        )}

        {/* Sidebar - Desktop Admin/Manager/Viewer */}
        {!isTechnician && (
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
                  {/* Create Buttons - Only for admin/manager */}
                  {isAdminOrManager && (
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
                  )}

                  {/* Navigation Groups */}
                  {(navigationItems ? [{ title: "", items: navigationItems }] : adminNavigationGroups).map((group, groupIdx) => (
                    <div key={groupIdx} className="mb-2">
                      {!isCollapsed && group.title && (
                        <div className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          {group.title}
                        </div>
                      )}
                      {isCollapsed && group.title && <div className="h-px bg-gray-100 mx-3 my-2" />}
                      
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const isActive = location.pathname === item.url;
                          return (
                            <Link
                              key={item.title}
                              to={item.url}
                              className={`
                                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative
                                ${isActive 
                                  ? 'bg-[#FAE008]/10 text-[#111827] font-semibold' 
                                  : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]'
                                }
                                ${isCollapsed ? 'justify-center' : ''}
                              `}
                              style={{ textDecoration: 'none', color: 'inherit' }}
                              title={isCollapsed ? item.title : ''}
                            >
                              {isActive && <div className="absolute left-0 w-1 h-6 bg-[#FAE008] rounded-r" />}
                              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#FAE008]' : 'currentColor'}`} />
                              {!isCollapsed && <span className="text-[14px]">{item.title}</span>}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
                {/* Role Badge */}
                {!isCollapsed && (
                  <div className="mb-2 px-3">
                    <RoleBadge role={effectiveRole} className="text-[11px]" />
                  </div>
                )}
                <button
                  onClick={() => navigate(createPageUrl("UserProfile"))}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F3F4F6] rounded-lg transition-colors ${isCollapsed ? 'justify-center' : ''}`}
                >
                  <div className="w-8 h-8 bg-[#F3F4F6] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[#111827] font-semibold text-sm">
                      {(user?.display_name || user?.full_name)?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-[#111827] text-[14px] truncate">
                        {user?.display_name || user?.full_name || 'User'}
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
        )}

        {/* Tech Mobile Menu Dropdown */}
        {isTechnician && (
          <div 
            className={`fixed top-[60px] left-0 right-0 bg-white border-b border-[#E5E7EB] shadow-lg z-40 transition-all duration-300 ${
              techMobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            <nav className="p-2">
              {/* Create Buttons - Only for non-viewers */}
              {!isViewer && (
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
              )}

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
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#ffffff] relative">
          
          {/* Tech Header */}
          {isTechnician && (
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
                  <div className="flex items-center gap-2">
                      <NotificationBell isMobile={true} />
                      <RoleBadge role={effectiveRole} />
                      <button
                        onClick={() => navigate(createPageUrl("UserProfile"))}
                        className="flex items-center hover:bg-[#F3F4F6] rounded-lg p-2 transition-colors min-h-[44px] min-w-[44px] justify-center"
                      >
                        <div className="w-8 h-8 bg-[#F3F4F6] rounded-full flex items-center justify-center">
                                <span className="text-[#111827] font-semibold text-sm">
                                  {(user?.display_name || user?.full_name)?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                      </button>
                    </div>
                </div>
              </header>
          )}

          {/* Admin Mobile Header */}
          {!isTechnician && (
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
                  {adminNavigationGroups.flatMap(g => g.items).find(item => item.url === location.pathname)?.title || 'KangarooGD'}
                </h1>
              </div>
            </header>
          )}

          {/* Admin Desktop Sticky Header */}
          {!isTechnician && (
             <div className="hidden lg:flex sticky top-0 z-30 bg-[#ffffff] border-b border-[#E5E7EB] px-6 py-3 items-center justify-between gap-4">
                 <GlobalSearchDropdown />
                 <div className="flex items-center gap-1">
                   <button
                     onClick={() => setIsCommandOpen(true)}
                     className="p-2 rounded-lg transition-colors text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                     title="Search (Ctrl+K)"
                   >
                     <Search className="w-5 h-5" />
                   </button>
                   {/* Notifications */}
                   <NotificationBell />
                   {/* Recent Pages Dropdown */}
                   <Popover open={recentPagesOpen} onOpenChange={setRecentPagesOpen}>
                     <PopoverTrigger asChild>
                       <button
                         className={`p-2 rounded-lg transition-colors ${recentPagesOpen ? 'bg-[#FAE008]/20 text-[#111827]' : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'}`}
                         title="Recent Pages"
                       >
                         <History className="w-5 h-5" />
                       </button>
                     </PopoverTrigger>
                     <PopoverContent align="end" className="w-64 p-2">
                       <div className="text-[12px] font-medium text-[#6B7280] px-2 py-1 mb-1">Recent Pages</div>
                       {recentPages.length === 0 ? (
                         <div className="text-[13px] text-[#9CA3AF] px-2 py-2">No recent pages</div>
                       ) : (
                         <div className="space-y-0.5">
                           {recentPages.map((page, idx) => {
                             const getIcon = () => {
                               switch(page.type) {
                                 case 'project': return <FolderKanban className="w-3.5 h-3.5 text-[#6D28D9]" />;
                                 case 'job': return <Briefcase className="w-3.5 h-3.5 text-[#2563EB]" />;
                                 case 'customer': return <UserCircle className="w-3.5 h-3.5 text-[#16A34A]" />;
                                 case 'email': return <Mail className="w-3.5 h-3.5 text-[#D97706]" />;
                                 case 'form': return <Plus className="w-3.5 h-3.5 text-[#111827]" />;
                                 default: return <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />;
                               }
                             };
                             return (
                               <Link
                                 key={idx}
                                 to={page.url}
                                 onClick={() => setRecentPagesOpen(false)}
                                 className="flex items-center gap-2 px-2 py-2 rounded-lg text-[#111827] hover:bg-[#F3F4F6] transition-colors no-underline"
                               >
                                 {getIcon()}
                                 <span className="text-[13px] truncate">{page.title}</span>
                               </Link>
                             );
                           })}
                         </div>
                       )}
                     </PopoverContent>
                   </Popover>
                   <Link
                     to={createPageUrl("Tasks")}
                     className={`p-2 rounded-lg transition-colors ${location.pathname === createPageUrl("Tasks") ? 'bg-[#FAE008]/20 text-[#111827]' : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'}`}
                     title="Tasks"
                   >
                     <CheckSquare className="w-5 h-5" />
                   </Link>
                   <Link
                     to={createPageUrl("Inbox")}
                     className={`p-2 rounded-lg transition-colors ${location.pathname === createPageUrl("Inbox") ? 'bg-[#FAE008]/20 text-[#111827]' : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'}`}
                     title="Inbox"
                   >
                     <Mail className="w-5 h-5" />
                   </Link>
                   <Link
                     to={createPageUrl("Schedule")}
                     className={`p-2 rounded-lg transition-colors ${location.pathname === createPageUrl("Schedule") ? 'bg-[#FAE008]/20 text-[#111827]' : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'}`}
                     title="Schedule"
                   >
                     <Calendar className="w-5 h-5" />
                   </Link>
                 </div>
             </div>
          )}

          {/* Consolidated Main Wrapper */}
          <main className="flex-1 overflow-y-auto pb-24 bg-[#ffffff] relative">
            <PullToRefresh onRefresh={handleRefresh}>
              <div className="relative">
                {activeCheckIn && (
                  <ActiveCheckInBanner 
                    job={activeCheckIn.job} 
                    onClick={() => navigate(`${createPageUrl("CheckIn")}?jobId=${activeCheckIn.job_id}`)}
                  />
                )}
                {children}
              </div>
            </PullToRefresh>
          </main>

          {/* Tech Test Mode Button */}
          {isTechnician && user && user.email === 'admin@kangaroogd.com.au' && (
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

        <CommandPalette open={isCommandOpen} onOpenChange={setIsCommandOpen} />
      </div>
    </PermissionsProvider>
  );
}