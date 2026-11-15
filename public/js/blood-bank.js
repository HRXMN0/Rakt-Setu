/**
 * RAKT-SETU BLOOD BANK DEPOT ENGINE (DATABASE-FIRST MIGRATION)
 * Business logic for Cold Storage Inventory, Hospital Requisition Queue & Dispatch,
 * Regional Emergency Exchange, and Voluntary Donor Registry Management.
 * Authoritative single source of truth: MongoDB via ApiClient.
 */

const BloodBankEngine = {
  _cachedBank: null,

  getBank() {
    const session = Storage.getSession();
    if (this._cachedBank) return this._cachedBank;
    this._cachedBank = {
      facilityId: session && session.facilityId ? session.facilityId : "bb_01",
      name: session && session.facilityName ? session.facilityName : "Patiala Central Blood Centre",
      license: "PB-CENTRAL-BB-2024",
      coldStorageTemp: "3.8 °C",
      reservedUnits: 12,
      inventory: {}
    };
    return this._cachedBank;
  },

  async syncBankFromApi() {
    const session = Storage.getSession();
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.hospitals.getAll();
        if (res && res.success && res.data && res.data.facilities) {
          const facilities = res.data.facilities;
          let bank = null;
          if (session && session.facilityId) {
            bank = facilities.find(f => f.facilityId === session.facilityId || f._id === session.facilityId);
          }
          if (!bank && session && session.facilityName) {
            bank = facilities.find(f => f.name && f.name.toLowerCase() === session.facilityName.toLowerCase());
          }
          if (!bank) {
            bank = facilities.find(f => f.type === 'Blood Bank') || facilities[facilities.length - 1];
          }
          this._cachedBank = bank;
          return this._cachedBank;
        }
      }
    } catch (e) {
      console.warn("[BloodBankEngine] Error fetching facility:", e.message);
    }
    return this.getBank();
  },

  /* ------------------------------------------------------------------------
     1. DASHBOARD
     ------------------------------------------------------------------------ */
  async renderDashboard() {
    const bank = await this.syncBankFromApi();
    if (!bank) return;

    const nameEl = document.getElementById("bb-name-title");
    if (nameEl) nameEl.textContent = bank.name;

    const tempEl = document.getElementById("bb-temp-status");
    if (tempEl) tempEl.textContent = `Cold Chain: ${bank.coldStorageTemp || '3.8 °C'}`;

    // Fetch live inventory from MongoDB
    let totalStock = 0;
    let criticalGroups = [];
    let stockByGroup = {};

    try {
      if (typeof ApiClient !== "undefined") {
        const invRes = await ApiClient.inventory.getAll();
        if (invRes && invRes.success && invRes.data && invRes.data.summary) {
          stockByGroup = invRes.data.summary.stockByGroup || {};
          totalStock = invRes.data.summary.counts ? invRes.data.summary.counts.available : 0;
          Object.entries(stockByGroup).forEach(([bg, count]) => {
            if (count < 10) {
              criticalGroups.push({ group: bg, count, status: count < 5 ? "Critical" : "Low Stock" });
            }
          });
        }
      }
    } catch (e) {
      console.warn("[BloodBankEngine] Inventory summary fetch error:", e.message);
    }

    const totalStockEl = document.getElementById("stat-bb-total-stock");
    if (totalStockEl) totalStockEl.textContent = `${totalStock} Units`;

    const reservedEl = document.getElementById("stat-bb-reserved");
    if (reservedEl) reservedEl.textContent = `${bank.reservedUnits || 12} Units`;

    // Fetch pending requisitions from MongoDB
    let pendingQueue = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const reqRes = await ApiClient.requests.getAll({ status: "Pending" });
        if (reqRes && reqRes.success && reqRes.data && reqRes.data.requests) {
          pendingQueue = reqRes.data.requests;
        }
      }
    } catch (e) {
      console.warn("[BloodBankEngine] Requests fetch error:", e.message);
    }

    const pendingCountEl = document.getElementById("stat-bb-pending-count");
    if (pendingCountEl) pendingCountEl.textContent = `${pendingQueue.length} Orders`;

    // Shortage Alerts Feed
    const alertContainer = document.getElementById("dashboard-shortage-alerts");
    if (alertContainer) {
      if (criticalGroups.length === 0) {
        alertContainer.innerHTML = `<div class="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded border border-emerald-200">✓ All regional inventory levels are in optimal storage surplus in MongoDB.</div>`;
      } else {
        alertContainer.innerHTML = criticalGroups.map(c => `
          <div class="flex justify-between items-center p-2 mb-2 bg-red-50 text-xs rounded border border-red-200">
            <div class="flex items-center gap-2">
              <span class="blood-badge">${c.group}</span>
              <span class="text-slate-800 font-semibold">${c.count} units in depot (${c.status})</span>
            </div>
            <a href="inventory.html" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;">Manage Batch</a>
          </div>
        `).join("");
      }
    }

    // Pending Requisitions Table
    const tableBody = document.getElementById("dashboard-req-table");
    if (tableBody) {
      if (pendingQueue.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No pending hospital requisitions in queue.</td></tr>`;
      } else {
        tableBody.innerHTML = pendingQueue.slice(0, 4).map(req => `
          <tr>
            <td><strong>${req.hospitalName || 'Clinical Facility'}</strong></td>
            <td><span class="blood-badge">${req.bloodGroup}</span> ${req.component}</td>
            <td><strong>${req.unitsRequired} Units</strong></td>
            <td><span class="badge ${req.urgency === 'STAT' ? 'badge-crimson' : 'badge-amber'}">${req.urgency || 'ROUTINE'}</span></td>
            <td>
              <a href="requests.html" class="btn btn-purple btn-sm" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                Fulfill Order &rarr;
              </a>
            </td>
          </tr>
        `).join("");
      }
    }
  },

  /* ------------------------------------------------------------------------
     2. INVENTORY (Cold Storage Batches)
     ------------------------------------------------------------------------ */
  async renderInventory() {
    const grid = document.getElementById("bloodbank-inventory-grid");
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
      console.warn("[BloodBankEngine] Inventory load error:", e.message);
    }

    const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

    grid.innerHTML = groups.map(group => {
      const count = stockSummary[group] || 0;
      const isCritical = count < 5;

      return `
        <div class="bloodbank-batch-card ${isCritical ? 'border-red-300' : ''}">
          <div class="flex justify-between items-center mb-3">
            <div class="flex items-center gap-2">
              <span class="blood-badge" style="font-size: 1.1rem;">${group}</span>
              <span class="badge ${isCritical ? 'badge-crimson' : 'badge-emerald'}">${isCritical ? 'Low Reserve' : 'Optimal'}</span>
            </div>
            <div class="text-right">
              <span class="text-xl font-extrabold text-slate-900">${count}</span>
              <span class="text-xs text-muted"> Units Available</span>
            </div>
          </div>

          <div class="stock-count-row">
            <span class="text-muted">Storage Protocol:</span>
            <span class="font-bold">Cold Chain Tested</span>
          </div>
          <div class="stock-count-row">
            <span class="text-muted">Storage Temp:</span>
            <span class="font-bold">2.0°C - 6.0°C</span>
          </div>

          <div class="flex gap-2 mt-4 pt-2 border-t border-slate-100">
            <button class="btn btn-secondary btn-sm flex-1" onclick="BloodBankEngine.openRestockModal('${group}')">+ Intake Batch</button>
          </div>
        </div>
      `;
    }).join("");
  },

  openRestockModal(bloodGroup) {
    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop open";
    modalBackdrop.innerHTML = `
      <div class="modal-content" style="max-width: 460px;">
        <div class="modal-header">
          <div class="card-title">Intake &amp; Screen Component Batch (${bloodGroup})</div>
          <button class="btn btn-ghost btn-sm" id="btn-bb-stock-close">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-bb-stock">
            <div class="form-group">
              <label class="form-label" for="bb-stock-component">Component Type</label>
              <select id="bb-stock-component" class="form-select">
                <option value="Whole Blood">Whole Blood</option>
                <option value="Packed RBCs">Packed Red Blood Cells (PRBC)</option>
                <option value="Platelets">Platelets (Apheresis)</option>
                <option value="Plasma">Fresh Frozen Plasma (FFP)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="bb-batch-id">Unit Barcode / Screening ID</label>
              <input type="text" id="bb-batch-id" class="form-input" value="RK-${Math.floor(1000 + Math.random() * 9000)}" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="bb-donor-name">Voluntary Donor Name</label>
              <input type="text" id="bb-donor-name" class="form-input" value="Registered Voluntary Donor" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" id="btn-bb-stock-cancel">Cancel</button>
          <button class="btn btn-purple btn-sm" id="btn-bb-stock-submit">Confirm Storage Intake</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalBackdrop);

    const cleanup = () => modalBackdrop.remove();
    modalBackdrop.querySelector("#btn-bb-stock-close").onclick = cleanup;
    modalBackdrop.querySelector("#btn-bb-stock-cancel").onclick = cleanup;

    modalBackdrop.querySelector("#btn-bb-stock-submit").onclick = async () => {
      const comp = modalBackdrop.querySelector("#bb-stock-component").value;
      const unitId = modalBackdrop.querySelector("#bb-batch-id").value || `RK-${Date.now()}`;
      const donorName = modalBackdrop.querySelector("#bb-donor-name").value.trim() || "Voluntary Donor";

      try {
        if (typeof ApiClient !== "undefined") {
          await ApiClient.inventory.addUnit({
            unitId,
            bloodType: bloodGroup,
            componentType: comp,
            donorName,
            facilityName: "Patiala Central Blood Centre"
          });
        }
        cleanup();
        UIComponents.showToast("Batch Logged", `Blood unit ${unitId} (${bloodGroup}) saved in MongoDB.`, "success");
        await this.renderInventory();
      } catch (e) {
        UIComponents.showToast("Intake Error", e.message, "danger");
      }
    };
  },

  /* ------------------------------------------------------------------------
     3. REQUESTS QUEUE & DISPATCH
     ------------------------------------------------------------------------ */
  async renderRequests() {
    const tableBody = document.getElementById("bloodbank-requests-table");
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
      console.warn("[BloodBankEngine] Error fetching requests:", e.message);
    }

    this._renderRequestsRows(requests, tableBody);
  },

  _renderRequestsRows(requests, tableBody) {
    if (!requests || requests.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-8 text-xs">No hospital requisitions currently in queue.</td></tr>`;
      return;
    }

    tableBody.innerHTML = requests.map(req => `
      <tr>
        <td>
          <div class="font-bold text-slate-900">${req.hospitalName || 'Rajindra Hospital'}</div>
          <div class="text-xs text-muted">ID: ${req.requestId || req._id} &bull; Case: ${req.patientCaseId}</div>
        </td>
        <td>
          <div class="flex items-center gap-2">
            <span class="blood-badge" style="width: 28px; height: 28px; font-size: 0.75rem;">${req.bloodGroup}</span>
            <span class="font-semibold text-xs">${req.component}</span>
          </div>
        </td>
        <td><strong>${req.unitsRequired} Units</strong></td>
        <td><span class="badge ${req.urgency === 'STAT' ? 'badge-crimson' : 'badge-amber'}">${req.urgency}</span></td>
        <td><span class="badge ${req.status === 'Dispatched' ? 'badge-sky' : req.status === 'Fulfilled' ? 'badge-emerald' : 'badge-amber'}">${req.status}</span></td>
        <td><span class="text-xs text-slate-600 font-medium">${req.courier || 'Pending Dispatch'}</span></td>
        <td>
          <div class="flex gap-1.5">
            ${req.status === 'Pending' ? `
              <button class="btn btn-purple btn-sm" onclick="BloodBankEngine.openFulfillModal('${req._id || req.id}', '${req.hospitalName}', '${req.bloodGroup}', ${req.unitsRequired})">
                Dispatch Order
              </button>
            ` : req.status === 'Dispatched' ? `
              <span class="badge badge-sky">In Transit</span>
            ` : `
              <span class="badge badge-emerald">Fulfilled</span>
            `}
          </div>
        </td>
      </tr>
    `).join("");
  },

  openFulfillModal(reqId, hospName, bloodGroup, units) {
    const modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop open";
    modalBackdrop.innerHTML = `
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <div class="card-title">Allocate &amp; Dispatch Order</div>
          <button class="btn btn-ghost btn-sm" id="btn-fulfill-close">✕</button>
        </div>
        <div class="modal-body">
          <p class="text-xs text-muted mb-4">
            Allocating <strong>${units} units of ${bloodGroup}</strong> for <strong>${hospName}</strong>. Select authorized medical courier.
          </p>
          <div class="form-group">
            <label class="form-label" for="ful-courier">Cold-Chain Courier Unit</label>
            <select id="ful-courier" class="form-select">
              <option value="RapidCare Van #04 (+91 98721 88411)">Express Medical Van #04 (Patiala RapidCare)</option>
              <option value="LifeLine Express Courier (+91 98144 22001)">LifeLine Express Cold Courier Unit 2</option>
              <option value="State Drone Pilot 1A (AeroMed)">State Health Drone Dispatch (Patiala SkyLink)</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" id="btn-fulfill-cancel">Cancel</button>
          <button class="btn btn-purple btn-sm" id="btn-fulfill-submit">Confirm &amp; Dispatch</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalBackdrop);

    const cleanup = () => modalBackdrop.remove();
    modalBackdrop.querySelector("#btn-fulfill-close").onclick = cleanup;
    modalBackdrop.querySelector("#btn-fulfill-cancel").onclick = cleanup;

    modalBackdrop.querySelector("#btn-fulfill-submit").onclick = async () => {
      const courier = modalBackdrop.querySelector("#ful-courier").value;

      try {
        if (typeof ApiClient !== "undefined") {
          await ApiClient.requests.updateStatus(reqId, "Dispatched", "Order allocated and dispatched from depot", courier);
        }
        cleanup();
        UIComponents.showToast("Units Dispatched", `Dispatched ${units} units to ${hospName} via ${courier.split('(')[0]}.`, "success");
        await this.renderRequests();
      } catch (e) {
        UIComponents.showToast("Dispatch Failed", e.message, "danger");
      }
    };
  },

  /* ------------------------------------------------------------------------
     4. REGIONAL EMERGENCY EXCHANGE
     ------------------------------------------------------------------------ */
  async renderEmergencyNetwork() {
    const listMount = document.getElementById("bloodbank-network-list");
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
      console.warn("[BloodBankEngine] Error fetching network:", e.message);
    }

    listMount.innerHTML = facilities.map(b => `
      <div class="card p-5 animate-fade-in" style="padding: 1.5rem; margin-bottom: 1.25rem;">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2">
              <span class="badge badge-purple">${b.type || 'Depot'}</span>
              ${b.verified ? '<span class="badge badge-emerald">✓ Verified Facility</span>' : ''}
            </div>
            <h4 class="font-bold text-lg text-slate-900 mt-2">${b.name}</h4>
            <p class="text-xs text-muted mt-1 flex items-center gap-1.5">${ICONS.pin} <span>${b.area || b.city} &bull; ${b.emergencyPhone || '+91 175 221 9999'}</span></p>
          </div>
          <div class="text-right">
            <span class="badge badge-emerald font-semibold">${b.inventoryHealth || 'Active Depot'}</span>
            <div class="mt-3">
              <button class="btn btn-purple btn-sm" onclick="BloodBankEngine.requestExchange('${b.name}')">Request Stock Balancing</button>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  },

  requestExchange(partnerName) {
    UIComponents.showConfirmDialog(
      "Regional Exchange Request",
      `Send inventory balancing request to ${partnerName}?`,
      () => {
        UIComponents.showToast("Exchange Request Sent", "Partner depot coordinator notified.", "success");
      },
      "Send Exchange Notice"
    );
  },

  /* ------------------------------------------------------------------------
     5. DONOR REGISTRY
     ------------------------------------------------------------------------ */
  async renderDonors() {
    const tableBody = document.getElementById("bloodbank-donors-table");
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
      console.warn("[BloodBankEngine] Error fetching donors:", e.message);
    }

    if (donors.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-8 text-xs">No voluntary donors registered yet in central database.</td></tr>`;
      return;
    }

    tableBody.innerHTML = donors.map(d => `
      <tr>
        <td><strong>${d.name}</strong></td>
        <td><span class="blood-badge">${d.bloodGroup || 'O+'}</span></td>
        <td>${d.phone || '+91 98765 00000'}</td>
        <td>${d.city || 'Patiala'} &bull; ${d.area || 'Metro'}</td>
        <td><span class="badge badge-emerald">Active Registered Donor</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="BloodBankEngine.sendDonationInvite('${d.name}')" style="display: inline-flex; align-items: center; gap: 5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span>Send Drive Invite</span>
          </button>
        </td>
      </tr>
    `).join("");
  },

  sendDonationInvite(donorName) {
    UIComponents.showConfirmDialog(
      "Send Donation Drive Invitation",
      `Send priority voluntary blood drive invitation and fast-track booking link to ${donorName}?`,
      () => {
        UIComponents.showToast("Invitation Sent", `Voluntary drive invitation dispatched to ${donorName}.`, "success");
      },
      "Send Invitation"
    );
  },

  /* ------------------------------------------------------------------------
     6. BLOOD BANK PROFILE & REGULATORY DOCUMENTS
     ------------------------------------------------------------------------ */
  async renderProfile() {
    const bank = await this.syncBankFromApi();
    if (!bank) return;

    const nameInput = document.getElementById("bb-name");
    const licInput = document.getElementById("bb-lic");
    const phoneInput = document.getElementById("bb-phone");
    const cityInput = document.getElementById("bb-city");

    if (nameInput) nameInput.value = bank.name || "";
    if (licInput) licInput.value = bank.license || "";
    if (phoneInput) phoneInput.value = bank.emergencyPhone || "+91 175 221 9999";
    if (cityInput) cityInput.value = bank.city || "Patiala";

    const form = document.getElementById("form-bloodbank-profile");
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
            await ApiClient.hospitals.updateProfile(bank._id || bank.facilityId || "bb_01", updated);
          }
          this._cachedBank = { ...bank, ...updated };
          UIComponents.showToast("Profile Updated", "Depot information saved to MongoDB.", "success");
        } catch (err) {
          UIComponents.showToast("Update Failed", err.message, "error");
        }
      });
    }

    await this.renderDocumentsList();

    const docForm = document.getElementById("form-upload-bb-doc");
    if (docForm) {
      docForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const descInput = document.getElementById("bb-doc-desc");
        const fileInput = document.getElementById("bb-doc-file");
        const submitBtn = document.getElementById("btn-upload-bb-doc");

        const file = fileInput.files[0];
        if (!file) {
          UIComponents.showToast("Missing File", "Please select a regulatory document.", "warning");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Uploading to MongoDB Repository...</span>`;

        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.bloodBank.uploadDocument(file, "FACILITY_LICENSE", descInput.value.trim());
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
    const container = document.getElementById("bloodbank-docs-list");
    if (!container) return;

    let docs = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.bloodBank.getDocuments();
        if (res && res.data && res.data.documents) {
          docs = res.data.documents.filter(d => d.documentType !== 'PROFILE_PHOTO');
        }
      }
    } catch (e) {
      console.warn("[BloodBank Docs]: Error fetching documents:", e.message);
    }

    if (docs.length === 0) {
      container.innerHTML = `<div class="text-center text-muted text-xs py-4">No regulatory licenses or certificates uploaded yet.</div>`;
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
              <button type="button" class="btn btn-ghost btn-sm text-crimson" onclick="BloodBankEngine.deleteDocument('${d._id}')" style="padding: 5px 8px;" title="Delete Document">
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
            await ApiClient.bloodBank.deleteDocument(docId);
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
