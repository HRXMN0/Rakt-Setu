/**
 * RAKT-SETU STORAGE & STATE PERSISTENCE ENGINE (DATABASE-FIRST MIGRATION)
 * MongoDB is the authoritative single source of truth for all persistent business data.
 * Browser localStorage and sessionStorage are completely eliminated for:
 *   - User accounts, identities, passwords, and JWT tokens.
 *   - Donors, health vitals, appointments, and donation records.
 *   - Hospitals, blood banks, and live inventory records.
 *   - Blood requests, emergency requisitions, and transfer logs.
 * Active session identity is managed in-memory during page lifecycle and verified against /api/auth/me.
 */

// Legacy keys slated for mandatory purge
const LEGACY_STORAGE_KEYS = [
  "rs_users_store",
  "rs_donors_store",
  "rs_hospitals_store",
  "rs_blood_banks_store",
  "rs_requests_store",
  "rs_appointments_store",
  "rs_transfers_store",
  "rs_active_session_token",
  "rs_jwt_token",
  "rs_data_version"
];

// Ephemeral in-memory session (never persisted to localStorage or sessionStorage)
let _activeSession = null;

const Storage = {
  /**
   * Initializes storage subsystem:
   * Performs an immediate, safe purge of legacy client-side storage keys
   * to guarantee MongoDB remains the authoritative source of truth.
   */
  init() {
    try {
      if (typeof localStorage !== "undefined") {
        LEGACY_STORAGE_KEYS.forEach(key => {
          localStorage.removeItem(key);
        });
      }
      if (typeof sessionStorage !== "undefined") {
        LEGACY_STORAGE_KEYS.forEach(key => {
          sessionStorage.removeItem(key);
        });
      }
    } catch (e) {
      console.warn("[Storage]: Storage cleanup error:", e);
    }
  },

  /* --- Safe Non-Sensitive Client Preferences (e.g. Dark Mode Theme) --- */
  getPreference(key, defaultValue = null) {
    try {
      if (typeof localStorage !== "undefined") {
        const item = localStorage.getItem(`rs_pref_${key}`);
        return item ? JSON.parse(item) : defaultValue;
      }
    } catch (e) {}
    return defaultValue;
  },

  setPreference(key, value) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`rs_pref_${key}`, JSON.stringify(value));
        return true;
      }
    } catch (e) {}
    return false;
  },

  /* --- In-Memory Session Management --- */
  getSession() {
    return _activeSession;
  },

  setSession(sessionData) {
    _activeSession = sessionData ? { ...sessionData } : null;
    return true;
  },

  setSessionInMemory(sessionData) {
    _activeSession = sessionData ? { ...sessionData } : null;
    return true;
  },

  clearSession() {
    _activeSession = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("rs_active_session_token");
        sessionStorage.removeItem("rs_jwt_token");
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("rs_active_session_token");
        localStorage.removeItem("rs_jwt_token");
      }
    } catch (e) {}
  },

  /* --- Backward Compatibility Stubs (Data sourced exclusively from MongoDB) --- */
  getUsers() { return []; },
  saveUser(user) { return user; },
  getDonors() { return []; },
  getDonor() { return _activeSession || {}; },
  getDonorByUserId(userId) {
    if (_activeSession && (_activeSession.userId === userId || _activeSession.id === userId)) {
      return _activeSession;
    }
    return null;
  },
  updateDonor(donor) { return donor; },
  addAppointment(donorId, appt) { return appt; },
  getHospitals() { return []; },
  getHospital() { return _activeSession || {}; },
  getHospitalById(hospitalId) {
    if (_activeSession && _activeSession.facilityId === hospitalId) {
      return _activeSession;
    }
    return null;
  },
  updateHospital(hospital) { return hospital; },
  updateHospitalInventory(hospitalId, bg, comp, delta) { return null; },
  getBloodBanks() { return []; },
  getBloodBank() { return _activeSession || {}; },
  getBloodBankById(bankId) {
    if (_activeSession && _activeSession.facilityId === bankId) {
      return _activeSession;
    }
    return null;
  },
  updateBloodBank(bank) { return bank; }
};

// Execute purge on script load
Storage.init();
