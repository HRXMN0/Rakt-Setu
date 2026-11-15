/**
 * RAKT-SETU ROUTE & SESSION GUARD (DATABASE-FIRST MIGRATION)
 * Strictly enforces role isolation and server-verified authentication against MongoDB.
 * Verifies HttpOnly session cookies via /api/auth/me on page load and refresh.
 */

const Guard = {
  /**
   * Enforces that an authenticated session exists in MongoDB and matches the required role.
   * @param {string} requiredRole - "DONOR", "HOSPITAL", or "BLOOD_BANK"
   * @param {string} loginRedirectPath - Relative path to the role's login page
   * @returns {Promise<Object|null>} Active verified session object if authorized
   */
  async requireAuth(requiredRole, loginRedirectPath = "login.html") {
    // 1. Retrieve session verified directly against MongoDB
    const session = await Auth.getAuthenticatedSession();

    // 2. Check if authenticated
    if (!session || !session.userId) {
      console.warn(`[Guard] Unauthenticated access attempt. Redirecting to ${loginRedirectPath}`);
      document.querySelectorAll("#sidebar-mount, #topbar-mount, .app-main, main").forEach(el => el.innerHTML = "");
      window.location.replace(`${loginRedirectPath}?auth_redirect=true`);
      return null;
    }

    // 3. Enforce strict role isolation (SUPER_ADMIN has universal oversight)
    const isSuperAdmin = session.role === "SUPER_ADMIN" || session.actualRole === "SUPER_ADMIN";
    if (requiredRole && session.role !== requiredRole && !isSuperAdmin) {
      console.warn(`[Guard] Role mismatch. Session is ${session.role}, page requires ${requiredRole}.`);
      document.querySelectorAll("#sidebar-mount, #topbar-mount, .app-main, main").forEach(el => el.innerHTML = "");

      let targetDashboard = "../index.html";
      if (session.role === "DONOR") targetDashboard = "../donor/dashboard.html";
      else if (session.role === "HOSPITAL") targetDashboard = "../hospital/dashboard.html";
      else if (session.role === "BLOOD_BANK") targetDashboard = "../blood-bank/dashboard.html";

      alert(`Access Restricted: You are authenticated as a ${session.role}. Redirecting to your designated dashboard.`);
      window.location.replace(targetDashboard);
      return null;
    }

    return session;
  },

  /**
   * Redirects already-authenticated users away from login/signup pages to their assigned dashboard.
   */
  async redirectIfAuthenticated() {
    try {
      const session = await Auth.getAuthenticatedSession();
      if (session && session.role) {
        if (session.role === "DONOR") window.location.replace("dashboard.html");
        else if (session.role === "HOSPITAL") window.location.replace("dashboard.html");
        else if (session.role === "BLOOD_BANK" || session.role === "SUPER_ADMIN") window.location.replace("dashboard.html");
      }
    } catch (e) {}
  }
};
