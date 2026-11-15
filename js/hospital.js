/**
 * RAKT-SETU HOSPITAL PORTAL ENGINE (DATABASE-FIRST MIGRATION)
 * Business logic for Hospital Dashboard, 8-Group Component Inventory,
 * Emergency STAT Requisitions, Regional Radar Network, Authorized Donors, and History.
 * Authoritative single source of truth: MongoDB via ApiClient.
 */

const HospitalEngine = {
  _cachedHospital: null,

  getHospital() {
    const session = Storage.getSession();
    if (this._cachedHospital) return this._cachedHospital;
    this._cachedHospital = {
      facilityId: session && session.facilityId ? session.facilityId : "hosp_01",
      name: session && session.facilityName ? session.facilityName : "Government Rajindra Hospital, Patiala",
      license: "PB-NABH-2024-8841",
      city: "Patiala",
      inventory: {}
    };
    return this._cachedHospital;
  },

  async syncHospitalFromApi() {
    const session = Storage.getSession();
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.hospitals.getAll();
        if (res && res.success && res.data && res.data.facilities) {
          const facilities = res.data.facilities;
          let hosp = null;
          if (session && session.facilityId) {
            hosp = facilities.find(f => f.facilityId === session.facilityId || f._id === session.facilityId);
          }
          if (!hosp && session && session.facilityName) {
            hosp = facilities.find(f => f.name && f.name.toLowerCase() === session.facilityName.toLowerCase());
          }
          this._cachedHospital = hosp || facilities[0];
          return this._cachedHospital;
        }
      }
    } catch (e) {
      console.warn("[HospitalEngine] Facility fetch error:", e.message);
    }
    return this.getHospital();
  },

  /* ------------------------------------------------------------------------
     1. DASHBOARD
     ------------------------------------------------------------------------ */
  async renderDashboard() {
    const hosp = await this.syncHospitalFromApi();
    if (!hosp) return;

    // Header & Titles
    const nameEl = document.getElementById("hosp-name-title");
    if (nameEl) nameEl.textContent = hosp.name;

    const licenseEl = document.getElementById("hosp-license-badge");
    if (licenseEl) licenseEl.textContent = hosp.license || "PB-NABH-Verified";

    // Fetch live emergency requests from MongoDB
    let activeRequests = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.requests.getAll();
        if (res && res.success && res.data && res.data.requests) {
          activeRequests = res.data.requests.filter(r => r.status !== "Completed" && r.status !== "Fulfilled" && r.status !== "Cancelled");
        }
      }
    } catch (e) {
      console.warn("[HospitalEngine] Error fetching requests:", e.message);
    }

    // Fetch live inventory from MongoDB
    let totalUnits = 0;
    let lowStockGroups = [];
    const minThresholds = { "A+": 10, "A-": 4, "B+": 12, "B-": 4, "AB+": 6, "AB-": 3, "O+": 15, "O-": 6 };

    try {
      if (typeof ApiClient !== "undefined") {
        const invRes = await ApiClient.inventory.getAll();
        if (invRes && invRes.success && invRes.data && invRes.data.summary) {
          const stock = invRes.data.summary.stockByGroup || {};
          Object.entries(stock).forEach(([bg, count]) => {
            totalUnits += count;
            if (count < (minThresholds[bg] || 5)) {
              lowStockGroups.push({ group: bg, count });
            }
          });
        }
      }
    } catch (e) {
      console.warn("[HospitalEngine] Error fetching inventory summary:", e.message);
    }

    const totalStockEl = document.getElementById("stat-total-stock");
    if (totalStockEl) totalStockEl.textContent = `${totalUnits} Units`;

    const lowStockCountEl = document.getElementById("stat-low-stock-count");
    if (lowStockCountEl) lowStockCountEl.textContent = `${lowStockGroups.length} Types Alert`;

    const activeEmgCountEl = document.getElementById("stat-active-emergencies");
    if (activeEmgCountEl) activeEmgCountEl.textContent = `${activeRequests.length} Active`;

    // Low Stock Alert Banners
    const lowStockContainer = document.getElementById("dashboard-low-stock-box");
    if (lowStockContainer) {
      if (lowStockGroups.length === 0) {
        lowStockContainer.innerHTML = `<div class="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded border border-emerald-200">✓ All blood group reserves are currently monitored in MongoDB.</div>`;
      } else {
        lowStockContainer.innerHTML = lowStockGroups.map(item => `
          <div class="flex justify-between items-center p-2 mb-2 bg-red-50 text-xs rounded border border-red-200">
            <div class="flex items-center gap-2">
              <span class="blood-badge">${item.group}</span>
              <span class="text-slate-800 font-semibold">Low Reserve (${item.count} units remaining)</span>
            </div>
            <a href="request-blood.html?group=${encodeURIComponent(item.group)}" class="btn btn-danger btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;">+ Request Stock</a>
          </div>
        `).join("");
      }
    }

    // Emergency Feed
    const emgFeed = document.getElementById("dashboard-emergency-feed");
    if (emgFeed) {
      if (activeRequests.length === 0) {
        emgFeed.innerHTML = UIComponents.getEmptyStateHtml(ICONS.emergency, "No Active Emergency Requisitions", "All STAT orders have been fulfilled.", "Create STAT Request", "onclick=\"location.href='request-blood.html'\"");
      } else {
        emgFeed.innerHTML = activeRequests.map(r => `
          <div class="emergency-stat-card animate-fade-in">
            <div class="flex justify-between items-start">
              <div>
                <span class="badge badge-crimson">${r.urgency}</span>
                <h4 class="font-bold text-base mt-2">${r.bloodGroup} ${r.component} (${r.unitsRequired} Units)</h4>
                <p class="text-xs text-muted mt-1">Case ID: <strong>${r.patientCaseId}</strong> &bull; Dept: ${r.department}</p>
                <div class="text-xs text-slate-700 mt-2 font-medium flex items-center gap-1.5">${ICONS.building} <span>Depot: ${r.targetBloodBank}</span></div>
              </div>
              <div class="text-right">
                <span class="badge ${r.status === 'Dispatched' ? 'badge-sky' : 'badge-amber'}">${r.status}</span>
                <div class="text-xs font-semibold text-slate-600 mt-2">${r.courier || 'In Transit'}</div>
              </div>
            </div>
          </div>
        `).join("");
      }
    }
  },

  /* ------------------------------------------------------------------------
     2. INVENTORY MANAGEMENT
     ------------------------------------------------------------------------ */
  async renderInventory() {
    const grid = document.getElementById("hospital-inventory-grid");
    if (!grid) return;

    let stockSummary = {
      'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0,
      'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0
    };

    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.inventory.getAll();
        if (res && res.success && res.data && res.data.summary && res.data.summary.stockByGroup) {
          stockSummary = { ...stockSummary, ...res.data.summary.stockByGroup };
        }
      }
    } catch (e) {
      console.warn("[HospitalEngine] Inventory load error:", e.message);
    }

    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    grid.innerHTML = bloodGroups.map(bg => {
      const units = stockSummary[bg] || 0;
      const isLow = units < 5;
      return `
        <div class="card p-4 animate-fade-in" style="border-top: 4px solid ${isLow ? 'var(--crimson-500)' : 'var(--emerald-500)'};">
          <div class="flex justify-between items-center mb-3">
            <span class="blood-badge" style="font-size: 1.1rem; width: 44px; height: 44px;">${bg}</span>
            <span class="badge ${isLow ? 'badge-crimson' : 'badge-emerald'}">${isLow ? 'Low Reserve' : 'Adequate'}</span>
          </div>
          <div class="text-2xl font-black text-slate-900">${units} <span class="text-xs text-muted font-normal">Units Available</span></div>
          <p class="text-xs text-muted mt-1">Monitored live in Central MongoDB</p>
          <div class="flex gap-2 mt-4 pt-3 border-t border-slate-100">
            <a href="request-blood.html?group=${encodeURIComponent(bg)}" class="btn btn-danger btn-sm" style="flex: 1; text-align: center; font-size: 0.75rem;">+ Requisition</a>
          </div>
        </div>
      `;
    }).join("");
  },

  /* ------------------------------------------------------------------------
     3. REQUEST BLOOD (STAT Requisition Workflow)
     ------------------------------------------------------------------------ */
  renderRequestBlood() {
    const form = document.getElementById("form-hospital-requisition");
    if (!form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const preGroup = urlParams.get("group");
    if (preGroup) {
      const bgSelect = document.getElementById("req-blood-group");
      if (bgSelect) bgSelect.value = preGroup;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const bloodGroup = document.getElementById("req-blood-group").value;
      const component = document.getElementById("req-component").value;
      const units = parseInt(document.getElementById("req-units").value, 10);
      const urgency = document.getElementById("req-urgency").value;
      const targetBank = document.getElementById("req-target-bank").value;
      const caseId = document.getElementById("req-case-id").value.trim() || `CAS-${Math.floor(1000 + Math.random() * 9000)}`;
      const department = document.getElementById("req-department").value.trim() || "Emergency Trauma";

      const submitBtn = document.getElementById("btn-submit-requisition");
      const originalBtnText = submitBtn ? submitBtn.innerHTML : "";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Broadcasting to Regional Depots...</span>`;
      }

      try {
        if (typeof ApiClient !== "undefined") {
          await ApiClient.requests.create({
            bloodGroup,
            component,
            unitsRequired: units,
            urgency,
            targetBloodBank: targetBank,
            patientCaseId: caseId,
            department
          });
        }

        UIComponents.showToast("Requisition Broadcasted", `Order for ${units} units of ${bloodGroup} ${component} saved in MongoDB.`, "success");
        setTimeout(() => {
          window.location.href = "emergency-requests.html";
        }, 600);
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
        UIComponents.showToast("Requisition Failed", err.message || "Failed to submit requisition to server.", "error");
      }
    });
  },

  /* ------------------------------------------------------------------------
     4. EMERGENCY REQUESTS TRACKING
     ------------------------------------------------------------------------ */
  async renderEmergencyRequests() {
    const container = document.getElementById("emergency-requests-container");
    if (!container) return;

    let requests = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.requests.getAll();
        if (res && res.success && res.data && res.data.requests) {
          requests = res.data.requests;
        }
      }
    } catch (e) {
      console.warn("[HospitalEngine] Error fetching emergency requests:", e.message);
    }

    this._renderEmergencyCards(requests, container);
  },

  _renderEmergencyCards(requests, container) {
    if (!container) return;
    if (!requests || requests.length === 0) {
      container.innerHTML = UIComponents.getEmptyStateHtml(
        ICONS.emergency,
        "No Active Emergency Tracking",
        "Submit a new STAT requisition to track priority courier logistics and real-time blood delivery.",
        "+ Create STAT Requisition",
        "onclick=\"location.href='request-blood.html'\""
      );
      return;
    }

    container.innerHTML = requests.map(r => `
      <div class="emergency-stat-card animate-fade-in">
        <div class="flex justify-between items-start">
          <div>
            <span class="badge ${r.urgency === 'STAT' ? 'badge-crimson' : 'badge-amber'}">${r.urgency || 'ROUTINE'}</span>
            <h4 class="font-bold text-lg text-slate-900 mt-2">${r.bloodGroup} ${r.component} (${r.unitsRequired} Units)</h4>
            <p class="text-xs text-muted mt-1">Case ID: <strong>${r.patientCaseId}</strong> &bull; Dept: ${r.department || 'Trauma'}</p>
            <div class="text-xs text-slate-700 mt-2 font-medium flex items-center gap-1.5">${ICONS.building} <span>Depot: ${r.targetBloodBank || 'Patiala Central Blood Centre'}</span></div>
          </div>
          <div class="text-right">
            <span class="badge ${r.status === 'Dispatched' ? 'badge-sky' : r.status === 'Fulfilled' ? 'badge-emerald' : 'badge-amber'}">${r.status}</span>
            <div class="text-xs font-semibold text-slate-600 mt-2">${r.courier || 'Awaiting Dispatch'}</div>
            <div class="text-xs text-muted mt-1">${new Date(r.createdAt || Date.now()).toLocaleTimeString()}</div>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
          ${r.status === 'Dispatched' ? `
            <button class="btn btn-primary btn-sm" onclick="HospitalEngine.markReceived('${r._id || r.id}', '${r.bloodGroup}', '${r.component}', ${r.unitsRequired})">Confirm Delivery Receipt</button>
          ` : ''}
          ${r.status === 'Pending' ? `
            <button class="btn btn-ghost btn-sm text-crimson" onclick="HospitalEngine.cancelRequest('${r._id || r.id}')">Cancel Order</button>
          ` : ''}
        </div>
      </div>
    `).join("");
  },

  async markReceived(reqId, bloodGroup, component, units) {
    UIComponents.showConfirmDialog(
      "Acknowledge Delivery & Stock Intake",
      `Confirm receipt of ${units} Units of ${bloodGroup} ${component}? Status will transition to Fulfilled in MongoDB.`,
      async () => {
        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.requests.updateStatus(reqId, "Fulfilled", "Blood units received and accepted into clinical care unit.", "Delivered to OT/ICU");
          }
          UIComponents.showToast("Delivery Confirmed", `${units} units marked as Fulfilled in database.`, "success");
          await this.renderEmergencyRequests();
        } catch (e) {
          UIComponents.showToast("Action Failed", e.message, "danger");
        }
      }
    );
  },

  async cancelRequest(reqId) {
    UIComponents.showConfirmDialog(
      "Cancel Requisition",
      "Are you sure you want to cancel this blood requisition? Reserved units will be released back to the donor pool.",
      async () => {
        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.requests.updateStatus(reqId, "Cancelled", "Cancelled by clinical staff");
          }
          UIComponents.showToast("Order Cancelled", "Requisition cancelled in MongoDB.", "info");
          await this.renderEmergencyRequests();
        } catch (e) {
          UIComponents.showToast("Action Failed", e.message, "danger");
        }
      },
      "Yes, Cancel",
      true
    );
  },

  /* ------------------------------------------------------------------------
     5. EMERGENCY NETWORK (Regional Radar)
     ------------------------------------------------------------------------ */
  async renderEmergencyNetwork() {
    const listMount = document.getElementById("emergency-network-list");
    if (!listMount) return;

    let facilities = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.hospitals.getAll();
        if (res && res.success && res.data && res.data.facilities) {
          facilities = res.data.facilities;
        }
      }
    } catch (e) {
      console.warn("[HospitalEngine] Error fetching network:", e.message);
    }

    listMount.innerHTML = facilities.map(f => `
      <div class="card p-5 animate-fade-in" style="padding: 1.5rem; margin-bottom: 1.25rem;">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2">
              <span class="badge ${f.type === 'Hospital' ? 'badge-sky' : 'badge-purple'}">${f.type || 'Facility'}</span>
              ${f.verified ? '<span class="badge badge-emerald">✓ Verified Partner</span>' : ''}
            </div>
            <h4 class="font-bold text-lg text-slate-900 mt-2">${f.name}</h4>
            <p class="text-xs text-muted mt-1 flex items-center gap-1.5">${ICONS.pin} <span>${f.area || f.city} &bull; ${f.emergencyPhone || '+91 175 221 9999'}</span></p>
          </div>
          <div class="text-right">
            <span class="badge badge-emerald font-semibold">${f.inventoryHealth || 'Healthy Reserves'}</span>
            <div class="text-xs text-muted mt-2">${f.distanceKm || 2.5} km from clinical center</div>
          </div>
        </div>
      </div>
    `).join("");
  },

  /* ------------------------------------------------------------------------
     6. AUTHORIZED DONORS
     ------------------------------------------------------------------------ */
  async renderDonors() {
    const tableBody = document.getElementById("hospital-donors-table");
    if (!tableBody) return;

    let donors = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.donors.getAll();
        if (res && res.success && res.data && res.data.donors) {
          donors = res.data.donors;
        }
      }
    } catch (e) {
      console.warn("[HospitalEngine] Error fetching donors:", e.message);
    }

    if (donors.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-8 text-xs">No voluntary donors registered yet in Patiala central registry.</td></tr>`;
      return;
    }

    tableBody.innerHTML = donors.map(d => `
      <tr>
        <td>
          <div class="font-bold text-slate-800">${d.name}</div>
          <div class="text-xs text-muted">${d.email}</div>
        </td>
        <td><span class="blood-badge" style="width: 32px; height: 32px; font-size: 0.8rem;">${d.bloodGroup || 'O+'}</span></td>
        <td>${d.city || 'Patiala'}</td>
        <td><span class="badge badge-emerald">Verified Donor</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="UIComponents.showToast('Contact Initiated', 'Direct call link dispatched to ${d.name}.', 'info')">
            Contact
          </button>
        </td>
      </tr>
    `).join("");
  },

  /* ------------------------------------------------------------------------
     7. REQUISITION HISTORY
     ------------------------------------------------------------------------ */
  async renderRequestHistory() {
    const tableBody = document.getElementById("request-history-table");
    if (!tableBody) return;

    let requests = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.requests.getAll();
        if (res && res.success && res.data && res.data.requests) {
          requests = res.data.requests;
        }
      }
    } catch (e) {
      console.warn("[HospitalEngine] Error fetching history:", e.message);
    }

    if (requests.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-8 text-xs">No requisition history records found in MongoDB.</td></tr>`;
      return;
    }

    tableBody.innerHTML = requests.map(r => `
      <tr>
        <td><strong>${r.requestId || r._id}</strong></td>
        <td><span class="blood-badge" style="width: 28px; height: 28px; font-size: 0.75rem;">${r.bloodGroup}</span></td>
        <td>${r.component}</td>
        <td>${r.unitsRequired} Units</td>
        <td><span class="badge ${r.status === 'Fulfilled' ? 'badge-emerald' : r.status === 'Cancelled' ? 'badge-slate' : 'badge-amber'}">${r.status}</span></td>
        <td>${r.targetBloodBank || 'Patiala Central Blood Centre'}</td>
        <td>${new Date(r.createdAt || Date.now()).toLocaleDateString()}</td>
      </tr>
    `).join("");
  },

  /* ------------------------------------------------------------------------
     8. TRANSFERS
     ------------------------------------------------------------------------ */
  async renderTransfers() {
    const tableBody = document.getElementById("transfers-table-body");
    if (!tableBody) return;

    let requests = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.requests.getAll();
        if (res && res.success && res.data && res.data.requests) {
          requests = res.data.requests;
        }
      }
    } catch (e) {}

    if (requests.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-8 text-xs">No inter-facility emergency transfers recorded.</td></tr>`;
      return;
    }

    tableBody.innerHTML = requests.map(t => `
      <tr>
        <td><strong>${t.requestId || t._id}</strong></td>
        <td>${t.hospitalName || 'Rajindra Hospital'} &rarr; ${t.targetBloodBank || 'Central Depot'}</td>
        <td><span class="blood-badge" style="width: 28px; height: 28px; font-size: 0.75rem;">${t.bloodGroup}</span> ${t.component}</td>
        <td>${t.unitsRequired} Units</td>
        <td><span class="badge ${t.status === 'Fulfilled' ? 'badge-emerald' : 'badge-sky'}">${t.status}</span></td>
        <td>${new Date(t.createdAt || Date.now()).toLocaleDateString()}</td>
      </tr>
    `).join("");
  },

  initTransferForm() {
    const form = document.getElementById("form-transfer");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const bloodGroup = document.getElementById("trans-group").value;
      const component = document.getElementById("trans-comp").value;
      const units = parseInt(document.getElementById("trans-units").value, 10);
      const target = document.getElementById("trans-target").value;

      try {
        if (typeof ApiClient !== "undefined") {
          await ApiClient.requests.create({
            bloodGroup,
            component,
            unitsRequired: units,
            urgency: "STAT",
            targetBloodBank: target,
            department: "Inter-Hospital Transfer"
          });
        }
        UIComponents.showToast("Transfer Dispatched", `${units} units of ${bloodGroup} dispatched to ${target}.`, "success");
        await this.renderTransfers();
      } catch (err) {
        UIComponents.showToast("Transfer Error", err.message, "danger");
      }
    });
  },

  /* ------------------------------------------------------------------------
     9. FACILITY PROFILE & REGULATORY DOCUMENTS
     ------------------------------------------------------------------------ */
  async renderProfile() {
    const hosp = await this.syncHospitalFromApi();
    if (!hosp) return;

    const nameInput = document.getElementById("hosp-name");
    const licInput = document.getElementById("hosp-lic");
    const typeInput = document.getElementById("hosp-type");
    const phoneInput = document.getElementById("hosp-phone");
    const cityInput = document.getElementById("hosp-city");

    if (nameInput) nameInput.value = hosp.name || "";
    if (licInput) licInput.value = hosp.license || "";
    if (typeInput) typeInput.value = hosp.type || "";
    if (phoneInput) phoneInput.value = hosp.emergencyPhone || "";
    if (cityInput) cityInput.value = hosp.city || "Patiala";

    const form = document.getElementById("form-hospital-profile");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const updated = {
          name: nameInput.value.trim(),
          emergencyPhone: phoneInput.value.trim(),
          city: cityInput.value.trim()
        };

        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.hospitals.updateProfile(hosp._id || hosp.facilityId || "hosp_01", updated);
          }
          this._cachedHospital = { ...hosp, ...updated };
          UIComponents.showToast("Hospital Profile Saved", "Clinical facility credentials updated in MongoDB.", "success");
        } catch (err) {
          UIComponents.showToast("Update Failed", err.message, "error");
        }
      });
    }

    await this.renderDocumentsList();

    const docForm = document.getElementById("form-upload-hospital-doc");
    if (docForm) {
      docForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const descInput = document.getElementById("hosp-doc-desc");
        const fileInput = document.getElementById("hosp-doc-file");
        const submitBtn = document.getElementById("btn-upload-hosp-doc");

        const file = fileInput.files[0];
        if (!file) {
          UIComponents.showToast("Missing File", "Please select a license or accreditation document.", "warning");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Uploading to MongoDB Repository...</span>`;

        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.hospitals.uploadDocument(file, "FACILITY_LICENSE", descInput.value.trim());
            UIComponents.showToast("Document Uploaded", `${file.name} saved to facility regulatory ledger.`, "success");
            await this.renderDocumentsList();
            descInput.value = "";
            fileInput.value = "";
          }
        } catch (docErr) {
          UIComponents.showToast("Upload Error", docErr.message || "Failed to upload document.", "error");
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Upload</span>`;
        }
      });
    }
  },

  async renderDocumentsList() {
    const container = document.getElementById("hospital-docs-list");
    if (!container) return;

    let docs = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.hospitals.getDocuments();
        if (res && res.data && res.data.documents) {
          docs = res.data.documents.filter(d => d.documentType !== 'PROFILE_PHOTO');
        }
      }
    } catch (e) {
      console.warn("[Hospital Docs]: Error fetching documents:", e.message);
    }

    if (docs.length === 0) {
      container.innerHTML = `<div class="text-center text-muted text-xs py-4">No regulatory or accreditation documents uploaded yet. Upload NABH or State Health registration above.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="flex flex-col gap-2">
        ${docs.map(d => `
          <div class="p-3 border border-slate-200 rounded-lg bg-white flex justify-between items-center" style="transition: border-color 0.15s ease;">
            <div class="flex items-center gap-3">
              <div style="width: 34px; height: 34px; border-radius: 6px; background: var(--slate-100); color: var(--text-secondary); display: flex; align-items: center; justify-content: center;">
                ${d.mimeType && d.mimeType.includes('pdf') ? ICONS.fileText : ICONS.image}
              </div>
              <div>
                <div class="font-bold text-xs text-slate-800">${d.originalName}</div>
                <div class="text-xs text-muted flex gap-2">
                  <span class="badge badge-slate" style="font-size: 0.65rem;">${d.documentType}</span>
                  <span>${(d.fileSize / 1024).toFixed(1)} KB</span>
                  <span>${d.description || 'Facility Record'}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <a href="/api/hospitals/documents/${d._id}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 5px 10px; display: inline-flex; align-items: center; gap: 4px;">
                ${ICONS.eye}
                <span>View</span>
              </a>
              <button type="button" class="btn btn-ghost btn-sm text-crimson" onclick="HospitalEngine.deleteDocument('${d._id}')" style="padding: 5px 8px;" title="Delete Document">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async deleteDocument(docId) {
    UIComponents.showConfirmDialog(
      "Delete Document",
      "Are you sure you want to permanently delete this facility document?",
      async () => {
        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.hospitals.deleteDocument(docId);
            UIComponents.showToast("Document Deleted", "File removed from facility repository.", "info");
            await this.renderDocumentsList();
          }
        } catch (err) {
          UIComponents.showToast("Delete Failed", err.message, "error");
        }
      },
      "Yes, Delete",
      true
    );
  }
};
