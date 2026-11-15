/**
 * RAKT-SETU CLIENT AUTHENTICATION ENGINE (DATABASE-FIRST MIGRATION)
 * Full-stack integration with Node.js/Express JWT backend and MongoDB.
 * Passwords and JWT tokens are NEVER stored in localStorage or sessionStorage.
 * Client sessions are authenticated via HttpOnly cookies and verified via /api/auth/me.
 * No client-side fallback storage: MongoDB is the single source of truth.
 */

const Auth = {
  /**
   * Validates password strength (minimum 6 characters)
   */
  validatePasswordStrength(password) {
    if (!password || password.length < 6) {
      return { valid: false, message: "Password must be at least 6 characters long." };
    }
    return { valid: true };
  },

  /**
   * User Registration with Backend JWT & MongoDB Integration
   */
  async register(details) {
    const { name, email, password, confirmPassword, role, ...extra } = details;

    if (!name || !email || !password || !role) {
      return { success: false, message: "Please fill in all mandatory fields." };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, message: "Please provide a valid email address." };
    }

    if (password !== confirmPassword) {
      return { success: false, message: "Passwords do not match." };
    }

    const strength = this.validatePasswordStrength(password);
    if (!strength.valid) {
      return { success: false, message: strength.message };
    }

    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.auth.register({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          confirmPassword,
          role,
          ...extra
        });

        if (res && res.success && res.data) {
          if (res.data.token) {
            ApiClient.setToken(res.data.token);
          }
          const u = res.data.user;
          const isDonorOrSuper = u.role === "DONOR" || u.role === "SUPER_ADMIN";
          const session = {
            userId: u._id || u.id,
            email: u.email,
            role: u.role === "HOSPITAL_STAFF" ? "HOSPITAL" : u.role === "ADMIN" ? "BLOOD_BANK" : u.role,
            actualRole: u.role,
            name: u.name,
            facilityId: isDonorOrSuper ? null : (u.hospitalId || u.bloodBankId || null),
            facilityName: isDonorOrSuper ? null : (u.hospitalName || u.bloodBankName || null),
            bloodGroup: u.bloodGroup || null,
            profilePhoto: u.profilePhoto || null,
            loginTimestamp: new Date().toISOString()
          };
          Storage.setSession(session);
          return { success: true, user: u, session };
        }
      }
      return { success: false, message: "ApiClient service unavailable." };
    } catch (apiErr) {
      console.error("[Auth]: Backend registration failed:", apiErr.message);
      return { success: false, message: apiErr.message || "Registration failed. Server unreachable." };
    }
  },

  /**
   * User Login & Verification with Real JWT Authentication against MongoDB
   */
  async login(email, password, expectedRole) {
    if (!email || !password) {
      return { success: false, message: "Please enter your email and password." };
    }

    // Map portal aliases
    let serverRole = expectedRole;
    if (expectedRole === "HOSPITAL") serverRole = "HOSPITAL_STAFF";
    if (expectedRole === "BLOOD_BANK") serverRole = "ADMIN";

    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.auth.login(email.trim(), password, serverRole);
        if (res && res.success && res.data) {
          if (res.data.token) {
            ApiClient.setToken(res.data.token);
          }
          const u = res.data.user;
          const isDonorOrSuper = u.role === "DONOR" || u.role === "SUPER_ADMIN";
          const session = {
            userId: u._id || u.id,
            email: u.email,
            role: u.role === "HOSPITAL_STAFF" ? "HOSPITAL" : u.role === "ADMIN" ? "BLOOD_BANK" : u.role,
            actualRole: u.role,
            name: u.name,
            facilityId: isDonorOrSuper ? null : (u.hospitalId || u.bloodBankId || null),
            facilityName: isDonorOrSuper ? null : (u.hospitalName || u.bloodBankName || null),
            bloodGroup: u.bloodGroup || null,
            profilePhoto: u.profilePhoto || null,
            loginTimestamp: new Date().toISOString()
          };
          Storage.setSession(session);
          return { success: true, session };
        }
      }
      return { success: false, message: "Authentication service unavailable." };
    } catch (apiErr) {
      console.error("[Auth]: Backend login failed:", apiErr.message);
      return { success: false, message: apiErr.message || "Invalid credentials or server unreachable." };
    }
  },

  /**
   * Retrieves active authenticated session verified directly against MongoDB /api/auth/me.
   * Ensures page refresh never logs out an authenticated user.
   */
  async getAuthenticatedSession() {
    const memorySession = Storage.getSession();
    if (memorySession && memorySession.userId) {
      return memorySession;
    }

    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.auth.getMe();
        if (res && res.success && res.data && res.data.user) {
          const u = res.data.user;
          const isDonorOrSuper = u.role === "DONOR" || u.role === "SUPER_ADMIN";
          const session = {
            userId: u._id || u.id,
            email: u.email,
            role: u.role === "HOSPITAL_STAFF" ? "HOSPITAL" : u.role === "ADMIN" ? "BLOOD_BANK" : u.role,
            actualRole: u.role,
            name: u.name,
            facilityId: isDonorOrSuper ? null : (u.hospitalId || u.bloodBankId || null),
            facilityName: isDonorOrSuper ? null : (u.hospitalName || u.bloodBankName || null),
            bloodGroup: u.bloodGroup || null,
            profilePhoto: u.profilePhoto || null,
            loginTimestamp: new Date().toISOString()
          };
          Storage.setSession(session);
          return session;
        }
      }
    } catch (err) {
      Storage.clearSession();
    }
    return null;
  },

  /**
   * Logout user, clear server-side HttpOnly cookie, and purge in-memory session
   */
  async logout(redirectUrl) {
    try {
      if (typeof ApiClient !== "undefined") {
        await ApiClient.auth.logout();
      }
    } catch (e) {}

    if (typeof ApiClient !== "undefined" && ApiClient.clearToken) {
      ApiClient.clearToken();
    }
    Storage.clearSession();

    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  /**
   * Helper to fill demo account in form (for placement interview showcase & evaluation)
   */
  fillDemoCredentials(role, emailInput, passwordInput) {
    const demoAccounts = {
      DONOR: { email: "donor@raktsetu.org", pass: "Password@123" },
      HOSPITAL: { email: "staff@cityhospital.org", pass: "Password@123" },
      BLOOD_BANK: { email: "admin@raktsetu.org", pass: "Password@123" },
      SUPER_ADMIN: { email: "superadmin@raktsetu.org", pass: "Password@123" }
    };

    const cred = demoAccounts[role];
    if (cred && emailInput && passwordInput) {
      emailInput.value = cred.email;
      passwordInput.value = cred.pass;
    }
  }
};
