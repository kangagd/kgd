import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import CheckIn from './pages/CheckIn';
import Team from './pages/Team';
import Schedule from './pages/Schedule';
import Customers from './pages/Customers';
import PriceList from './pages/PriceList';
import UserProfile from './pages/UserProfile';
import Calendar from './pages/Calendar';
import Archive from './pages/Archive';
import Organisations from './pages/Organisations';
import Projects from './pages/Projects';
import Photos from './pages/Photos';
import Reports from './pages/Reports';
import Inbox from './pages/Inbox';
import SearchResults from './pages/SearchResults';
import Quotes from './pages/Quotes';
import PublicQuote from './pages/PublicQuote';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Jobs": Jobs,
    "CheckIn": CheckIn,
    "Team": Team,
    "Schedule": Schedule,
    "Customers": Customers,
    "PriceList": PriceList,
    "UserProfile": UserProfile,
    "Calendar": Calendar,
    "Archive": Archive,
    "Organisations": Organisations,
    "Projects": Projects,
    "Photos": Photos,
    "Reports": Reports,
    "Inbox": Inbox,
    "SearchResults": SearchResults,
    "Quotes": Quotes,
    "PublicQuote": PublicQuote,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};