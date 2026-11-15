/**
 * RAKT-SETU UNIFIED REST API CLIENT (EVALUATION 2)
 * Full-stack HTTP client with JWT interceptors, Multer multipart/form-data support,
 * error handling, and role-based session synchronization.
 */

/**
 * Environment-aware API Base URL resolver:
 * 1. Checks if an explicit custom base URL was configured via window.RAKTSETU_API_URL
 * 2. In local multi-port development (e.g. VS Code Live Server on 5500, 8080), targets http://localhost:5000/api
 * 3. In production, Docker, or same-origin deployments, uses relative path "/api"
 */
const getApiBaseUrl = () => {
  if (typeof window !== "undefined" && window.RAKTSETU_API_URL) {
    return window.RAKTSETU_API_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location) {
    const { hostname, port } = window.location;
    if ((hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "5000" && port !== "") {
      return `http://${hostname}:5000/api`;
    }
  }
  return "/api";
};

const API_BASE_URL = getApiBaseUrl();

// Ephemeral in-memory token cache (used only for CLI/script fallbacks; browser uses HttpOnly cookies)
let _inMemoryAuthToken = null;
const TOKEN_STORAGE_KEY = "rs_jwt_token";

const ApiClient = {
  /**
   * Returns in-memory bearer token if set.
   * Authentication in browser environments relies strictly on HttpOnly cookies.
   */
  getToken() {
    return _inMemoryAuthToken;
  },

  /**
   * Sets ephemeral in-memory token. Never writes sensitive JWTs to browser localStorage or sessionStorage.
   */
  setToken(token) {
    _inMemoryAuthToken = token || null;
  },

  /**
   * Purges in-memory token and cleanses any legacy browser storage tokens.
   */
  clearToken() {
    _inMemoryAuthToken = null;
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(TOKEN_STORAGE_KEY);
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (e) {}
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = options.headers || {};
    headers["X-Requested-With"] = "XMLHttpRequest";

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Do NOT set Content-Type if body is FormData (browser will set multipart/form-data with boundary)
    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const config = {
      credentials: "include", // Enables automatic transmission of HttpOnly cookies across requests
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const isJson = (response.headers.get("content-type") || "").includes("application/json");
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          console.warn("[ApiClient]: 401 Unauthorized. Clearing local auth token.");
          this.clearToken();
          if (typeof Storage !== "undefined" && Storage.clearSession) {
            Storage.clearSession();
          }
        }
        const errorMsg = data && data.message ? data.message : `HTTP ${response.status}: ${response.statusText}`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`[API Request Error] ${options.method || 'GET'} ${endpoint}:`, err.message);
      throw err;
    }
  },

  /* --- Authentication Endpoints --- */
  auth: {
    async register(details) {
      return await ApiClient.request("/auth/register", {
        method: "POST",
        body: JSON.stringify(details)
      });
    },

    async login(email, password, expectedRole) {
      return await ApiClient.request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, expectedRole })
      });
    },

    async getMe() {
      return await ApiClient.request("/auth/me", { method: "GET" });
    },

    async logout() {
      try {
        await ApiClient.request("/auth/logout", { method: "POST" });
      } catch (e) {}
      ApiClient.clearToken();
    }
  },

  /* --- Donor Endpoints --- */
  donor: {
    async getProfile() {
      return await ApiClient.request("/donors/profile", { method: "GET" });
    },

    async updateProfile(details) {
      return await ApiClient.request("/donors/profile", {
        method: "PUT",
        body: JSON.stringify(details)
      });
    },

    async getHistory() {
      return await ApiClient.request("/donors/history", { method: "GET" });
    },

    async getAppointments() {
      return await ApiClient.request("/donors/appointments", { method: "GET" });
    },

    async bookAppointment(data) {
      return await ApiClient.request("/donors/appointments", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },

    async cancelAppointment(appointmentId) {
      return await ApiClient.request(`/donors/appointments/${appointmentId}/cancel`, {
        method: "PUT"
      });
    },

    /* --- Multer File Upload Integrations --- */
    async uploadPhoto(file) {
      const formData = new FormData();
      formData.append("photo", file);
      return await ApiClient.request("/donors/profile/photo", {
        method: "POST",
        body: formData
      });
    },

    async uploadDocument(file, documentType = "DONOR_ID", description = "") {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);
      formData.append("description", description);
      return await ApiClient.request("/donors/documents", {
        method: "POST",
        body: formData
      });
    },

    async getDocuments() {
      return await ApiClient.request("/donors/documents", { method: "GET" });
    },

    async deleteDocument(docId) {
      return await ApiClient.request(`/donors/documents/${docId}`, { method: "DELETE" });
    }
  },

  /* --- Inventory Endpoints --- */
  inventory: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      return await ApiClient.request(`/inventory?${query}`, { method: "GET" });
    },

    async addUnit(unitData) {
      return await ApiClient.request("/inventory", {
        method: "POST",
        body: JSON.stringify(unitData)
      });
    },

    async updateUnit(id, updateData) {
      return await ApiClient.request(`/inventory/${id}`, {
        method: "PUT",
        body: JSON.stringify(updateData)
      });
    },

    async deleteUnit(id) {
      return await ApiClient.request(`/inventory/${id}`, { method: "DELETE" });
    },

    async reserveUnit(id, requestId) {
      return await ApiClient.request(`/inventory/${id}/reserve`, {
        method: "POST",
        body: JSON.stringify({ requestId })
      });
    }
  },

  /* --- Requests Endpoints --- */
  requests: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      return await ApiClient.request(`/requests?${query}`, { method: "GET" });
    },

    async create(requestData) {
      return await ApiClient.request("/requests", {
        method: "POST",
        body: JSON.stringify(requestData)
      });
    },

    async match(requestId) {
      return await ApiClient.request(`/requests/${requestId}/match`, { method: "GET" });
    },

    async updateStatus(requestId, status, note, courier) {
      return await ApiClient.request(`/requests/${requestId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status, note, courier })
      });
    }
  },

  /* --- Hospital / Blood Bank Facilities --- */
  hospitals: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      return await ApiClient.request(`/hospitals?${query}`, { method: "GET" });
    },

    async getById(id) {
      return await ApiClient.request(`/hospitals/${id}`, { method: "GET" });
    },

    async updateProfile(id, details) {
      return await ApiClient.request(`/hospitals/${id}`, {
        method: "PUT",
        body: JSON.stringify(details)
      });
    },

    async getEmergencyStock() {
      return await ApiClient.request("/hospitals/network/emergency", { method: "GET" });
    },

    async uploadDocument(file, documentType = "FACILITY_LICENSE", description = "") {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);
      formData.append("description", description);
      return await ApiClient.request("/hospitals/documents", {
        method: "POST",
        body: formData
      });
    },

    async getDocuments() {
      return await ApiClient.request("/hospitals/documents", { method: "GET" });
    },

    async deleteDocument(docId) {
      return await ApiClient.request(`/hospitals/documents/${docId}`, { method: "DELETE" });
    }
  },

  /* --- Universal Document Management (Donor, Hospital, Blood Bank, Super Admin) --- */
  documents: {
    async upload(file, documentType = "FACILITY_LICENSE", description = "") {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);
      formData.append("description", description);
      return await ApiClient.request("/documents", {
        method: "POST",
        body: formData
      });
    },

    async getMyDocuments() {
      return await ApiClient.request("/documents", { method: "GET" });
    },

    async delete(docId) {
      return await ApiClient.request(`/documents/${docId}`, { method: "DELETE" });
    },

    async uploadPhoto(file) {
      const formData = new FormData();
      formData.append("photo", file);
      return await ApiClient.request("/documents/photo", {
        method: "POST",
        body: formData
      });
    }
  },

  /* --- Blood Bank Portal Facility Management --- */
  bloodBank: {
    async uploadDocument(file, documentType = "FACILITY_LICENSE", description = "") {
      return await ApiClient.documents.upload(file, documentType, description);
    },

    async getDocuments() {
      return await ApiClient.documents.getMyDocuments();
    },

    async deleteDocument(docId) {
      return await ApiClient.documents.delete(docId);
    }
  },

  /* --- Donors Directory (Hospital & Blood Bank Access) --- */
  donors: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      return await ApiClient.request(`/donors?${query}`, { method: "GET" });
    },
    async getById(id) {
      return await ApiClient.request(`/donors/${id}`, { method: "GET" });
    }
  }
};

