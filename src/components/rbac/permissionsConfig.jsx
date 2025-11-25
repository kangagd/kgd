// Default role permissions configuration
export const DEFAULT_PERMISSIONS = {
  // Administrator - Full access to everything
  administrator: {
    projects: { view: true, create: true, edit: true, delete: true, view_financials: true },
    jobs: { view: true, view_assigned_only: false, create: true, edit: true, delete: true, assign: true },
    customers: { view: true, create: true, edit: true, delete: true },
    quotes: { view: true, create: true, edit: true, send: true, delete: true },
    invoices: { view: true, create: true, edit: true, delete: true },
    schedule: { view: true, view_own_only: false, manage: true },
    inbox: { view: true, reply: true, link_to_project: true, create_from_email: true },
    reports: { view: true, export: true },
    team: { view: true, manage_roles: true },
    settings: { view: true, manage: true },
    price_list: { view: true, edit: true },
    photos: { view: true, upload: true, delete: true, approve_marketing: true },
    organisations: { view: true, create: true, edit: true, delete: true }
  },

  // Manager - Most access but no team/settings management
  manager: {
    projects: { view: true, create: true, edit: true, delete: false, view_financials: true },
    jobs: { view: true, view_assigned_only: false, create: true, edit: true, delete: false, assign: true },
    customers: { view: true, create: true, edit: true, delete: false },
    quotes: { view: true, create: true, edit: true, send: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false },
    schedule: { view: true, view_own_only: false, manage: true },
    inbox: { view: true, reply: true, link_to_project: true, create_from_email: true },
    reports: { view: true, export: true },
    team: { view: true, manage_roles: false },
    settings: { view: true, manage: false },
    price_list: { view: true, edit: false },
    photos: { view: true, upload: true, delete: false, approve_marketing: true },
    organisations: { view: true, create: true, edit: true, delete: false }
  },

  // Technician - Limited access, mainly their own jobs
  technician: {
    projects: { view: true, create: false, edit: false, delete: false, view_financials: false },
    jobs: { view: true, view_assigned_only: true, create: false, edit: true, delete: false, assign: false },
    customers: { view: true, create: false, edit: false, delete: false },
    quotes: { view: false, create: false, edit: false, send: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false },
    schedule: { view: true, view_own_only: true, manage: false },
    inbox: { view: false, reply: false, link_to_project: false, create_from_email: false },
    reports: { view: false, export: false },
    team: { view: true, manage_roles: false },
    settings: { view: false, manage: false },
    price_list: { view: true, edit: false },
    photos: { view: true, upload: true, delete: false, approve_marketing: false },
    organisations: { view: false, create: false, edit: false, delete: false }
  },

  // Office Staff - View most things, limited editing
  office_staff: {
    projects: { view: true, create: true, edit: true, delete: false, view_financials: false },
    jobs: { view: true, view_assigned_only: false, create: true, edit: true, delete: false, assign: true },
    customers: { view: true, create: true, edit: true, delete: false },
    quotes: { view: true, create: true, edit: true, send: true, delete: false },
    invoices: { view: true, create: true, edit: false, delete: false },
    schedule: { view: true, view_own_only: false, manage: true },
    inbox: { view: true, reply: true, link_to_project: true, create_from_email: true },
    reports: { view: true, export: false },
    team: { view: true, manage_roles: false },
    settings: { view: false, manage: false },
    price_list: { view: true, edit: false },
    photos: { view: true, upload: true, delete: false, approve_marketing: false },
    organisations: { view: true, create: true, edit: true, delete: false }
  },

  // Read Only - Can only view
  read_only: {
    projects: { view: true, create: false, edit: false, delete: false, view_financials: false },
    jobs: { view: true, view_assigned_only: false, create: false, edit: false, delete: false, assign: false },
    customers: { view: true, create: false, edit: false, delete: false },
    quotes: { view: true, create: false, edit: false, send: false, delete: false },
    invoices: { view: true, create: false, edit: false, delete: false },
    schedule: { view: true, view_own_only: false, manage: false },
    inbox: { view: true, reply: false, link_to_project: false, create_from_email: false },
    reports: { view: true, export: false },
    team: { view: true, manage_roles: false },
    settings: { view: false, manage: false },
    price_list: { view: true, edit: false },
    photos: { view: true, upload: false, delete: false, approve_marketing: false },
    organisations: { view: true, create: false, edit: false, delete: false }
  }
};

// Permission categories for UI display
export const PERMISSION_CATEGORIES = [
  {
    key: 'projects',
    label: 'Projects',
    permissions: [
      { key: 'view', label: 'View projects' },
      { key: 'create', label: 'Create projects' },
      { key: 'edit', label: 'Edit projects' },
      { key: 'delete', label: 'Delete projects' },
      { key: 'view_financials', label: 'View financial data' }
    ]
  },
  {
    key: 'jobs',
    label: 'Jobs',
    permissions: [
      { key: 'view', label: 'View all jobs' },
      { key: 'view_assigned_only', label: 'View only assigned jobs' },
      { key: 'create', label: 'Create jobs' },
      { key: 'edit', label: 'Edit jobs' },
      { key: 'delete', label: 'Delete jobs' },
      { key: 'assign', label: 'Assign technicians' }
    ]
  },
  {
    key: 'customers',
    label: 'Customers',
    permissions: [
      { key: 'view', label: 'View customers' },
      { key: 'create', label: 'Create customers' },
      { key: 'edit', label: 'Edit customers' },
      { key: 'delete', label: 'Delete customers' }
    ]
  },
  {
    key: 'quotes',
    label: 'Quotes',
    permissions: [
      { key: 'view', label: 'View quotes' },
      { key: 'create', label: 'Create quotes' },
      { key: 'edit', label: 'Edit quotes' },
      { key: 'send', label: 'Send quotes' },
      { key: 'delete', label: 'Delete quotes' }
    ]
  },
  {
    key: 'invoices',
    label: 'Invoices',
    permissions: [
      { key: 'view', label: 'View invoices' },
      { key: 'create', label: 'Create invoices' },
      { key: 'edit', label: 'Edit invoices' },
      { key: 'delete', label: 'Delete invoices' }
    ]
  },
  {
    key: 'schedule',
    label: 'Schedule',
    permissions: [
      { key: 'view', label: 'View full schedule' },
      { key: 'view_own_only', label: 'View own schedule only' },
      { key: 'manage', label: 'Manage schedule' }
    ]
  },
  {
    key: 'inbox',
    label: 'Inbox',
    permissions: [
      { key: 'view', label: 'View inbox' },
      { key: 'reply', label: 'Reply to emails' },
      { key: 'link_to_project', label: 'Link emails to projects' },
      { key: 'create_from_email', label: 'Create projects from emails' }
    ]
  },
  {
    key: 'reports',
    label: 'Reports',
    permissions: [
      { key: 'view', label: 'View reports' },
      { key: 'export', label: 'Export reports' }
    ]
  },
  {
    key: 'team',
    label: 'Team',
    permissions: [
      { key: 'view', label: 'View team' },
      { key: 'manage_roles', label: 'Manage roles & permissions' }
    ]
  },
  {
    key: 'settings',
    label: 'Settings',
    permissions: [
      { key: 'view', label: 'View settings' },
      { key: 'manage', label: 'Manage settings' }
    ]
  },
  {
    key: 'price_list',
    label: 'Price List',
    permissions: [
      { key: 'view', label: 'View price list' },
      { key: 'edit', label: 'Edit price list' }
    ]
  },
  {
    key: 'photos',
    label: 'Photos',
    permissions: [
      { key: 'view', label: 'View photos' },
      { key: 'upload', label: 'Upload photos' },
      { key: 'delete', label: 'Delete photos' },
      { key: 'approve_marketing', label: 'Approve for marketing' }
    ]
  },
  {
    key: 'organisations',
    label: 'Organisations',
    permissions: [
      { key: 'view', label: 'View organisations' },
      { key: 'create', label: 'Create organisations' },
      { key: 'edit', label: 'Edit organisations' },
      { key: 'delete', label: 'Delete organisations' }
    ]
  }
];

// Role templates for quick setup
export const ROLE_TEMPLATES = [
  { key: 'administrator', name: 'Administrator', description: 'Full access to all features', color: '#7C3AED' },
  { key: 'manager', name: 'Manager', description: 'Manage projects, jobs, and team without admin settings', color: '#2563EB' },
  { key: 'technician', name: 'Technician', description: 'Field technician with access to assigned jobs', color: '#16A34A' },
  { key: 'office_staff', name: 'Office Staff', description: 'Handle scheduling, quotes, and customer communications', color: '#D97706' },
  { key: 'read_only', name: 'Read Only', description: 'View-only access to most data', color: '#6B7280' }
];