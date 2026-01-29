/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminDuplicates from './pages/AdminDuplicates';
import BackfillJobTypeAdmin from './pages/BackfillJobTypeAdmin';
import BaselineStockSeed from './pages/BaselineStockSeed';
import CheckIn from './pages/CheckIn';
import Contracts from './pages/Contracts';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import EmailSettings from './pages/EmailSettings';
import EmailTemplates from './pages/EmailTemplates';
import Fleet from './pages/Fleet';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import InventoryDebugger from './pages/InventoryDebugger';
import Jobs from './pages/Jobs';
import Leads from './pages/Leads';
import Logistics from './pages/Logistics';
import ModelHealth from './pages/ModelHealth';
import MyVehicle from './pages/MyVehicle';
import Notifications from './pages/Notifications';
import Organisations from './pages/Organisations';
import OutstandingBalances from './pages/OutstandingBalances';
import PartsHardwareAdmin from './pages/PartsHardwareAdmin';
import Photos from './pages/Photos';
import PriceList from './pages/PriceList';
import ProjectTags from './pages/ProjectTags';
import Projects from './pages/Projects';
import PurchaseOrders from './pages/PurchaseOrders';
import Reports from './pages/Reports';
import RoleSettings from './pages/RoleSettings';
import RollbackAuditV2 from './pages/RollbackAuditV2';
import SamplesLibrary from './pages/SamplesLibrary';
import Schedule from './pages/Schedule';
import Suppliers from './pages/Suppliers';
import SupplyLogistics from './pages/SupplyLogistics';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import ToolsAdmin from './pages/ToolsAdmin';
import UserProfile from './pages/UserProfile';
import WarehouseInventory from './pages/WarehouseInventory';
import Discovery from './pages/Discovery';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDuplicates": AdminDuplicates,
    "BackfillJobTypeAdmin": BackfillJobTypeAdmin,
    "BaselineStockSeed": BaselineStockSeed,
    "CheckIn": CheckIn,
    "Contracts": Contracts,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "EmailSettings": EmailSettings,
    "EmailTemplates": EmailTemplates,
    "Fleet": Fleet,
    "Home": Home,
    "Inbox": Inbox,
    "InventoryDebugger": InventoryDebugger,
    "Jobs": Jobs,
    "Leads": Leads,
    "Logistics": Logistics,
    "ModelHealth": ModelHealth,
    "MyVehicle": MyVehicle,
    "Notifications": Notifications,
    "Organisations": Organisations,
    "OutstandingBalances": OutstandingBalances,
    "PartsHardwareAdmin": PartsHardwareAdmin,
    "Photos": Photos,
    "PriceList": PriceList,
    "ProjectTags": ProjectTags,
    "Projects": Projects,
    "PurchaseOrders": PurchaseOrders,
    "Reports": Reports,
    "RoleSettings": RoleSettings,
    "RollbackAuditV2": RollbackAuditV2,
    "SamplesLibrary": SamplesLibrary,
    "Schedule": Schedule,
    "Suppliers": Suppliers,
    "SupplyLogistics": SupplyLogistics,
    "Tasks": Tasks,
    "Team": Team,
    "ToolsAdmin": ToolsAdmin,
    "UserProfile": UserProfile,
    "WarehouseInventory": WarehouseInventory,
    "Discovery": Discovery,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};