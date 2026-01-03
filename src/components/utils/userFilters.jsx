/**
 * Filter out Base44 internal team members from user lists
 * Base44 team should not be assignable to jobs, projects, vehicles, etc.
 */

const BASE44_TEAM_EMAILS = [
  'admin@kangaroogd.com.au',
  'yevhenii@base44.app',
  'yevheniih@base44.app'
];

const BASE44_TEAM_DOMAINS = [
  '@base44.app',
  '@base44.com'
];

/**
 * Check if a user is a Base44 team member
 */
export function isBase44TeamMember(user) {
  if (!user || !user.email) return false;
  
  const email = user.email.toLowerCase();
  
  // Check exact email matches
  if (BASE44_TEAM_EMAILS.some(teamEmail => email === teamEmail.toLowerCase())) {
    return true;
  }
  
  // Check domain matches
  if (BASE44_TEAM_DOMAINS.some(domain => email.includes(domain.toLowerCase()))) {
    return true;
  }
  
  return false;
}

/**
 * Filter Base44 team members from a user list
 */
export function filterBase44TeamMembers(users) {
  if (!Array.isArray(users)) return [];
  return users.filter(user => !isBase44TeamMember(user));
}

/**
 * Filter Base44 team members and get assignable users
 * Also filters out inactive/non-assignable users
 */
export function getAssignableUsers(users) {
  if (!Array.isArray(users)) return [];
  
  return users.filter(user => {
    // Filter out Base44 team
    if (isBase44TeamMember(user)) return false;
    
    // Keep users who are active and assignable
    return user && (
      user.role === 'admin' || 
      user.role === 'manager' || 
      user.is_field_technician === true
    );
  });
}