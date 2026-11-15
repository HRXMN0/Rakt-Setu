/**
 * RAKT-SETU DONOR PORTAL ENGINE
 * Business logic for Donor Dashboard, Blood Stock Search, 5-Step Scheduling Wizard,
 * Donation History, and Donor Profile Management.
 */

const DonorEngine = {
  _cachedDonor: null,

  getDonor() {
    const session = Storage.getSession();
    if (!session) return null;

    if (this._cachedDonor && (this._cachedDonor.userId === session.userId || this._cachedDonor._id === session.userId)) {
      return this._cachedDonor;
    }

    this._cachedDonor = {
      id: session.userId,
      userId: session.userId,
      name: session.name || "Registered Donor",
      email: session.email || "",
      phone: session.phone || "",
      bloodGroup: session.bloodGroup || "O+",
      city: session.city || "Patiala",
      area: session.area || "",
      eligibilityStatus: "Eligible Now",
      daysUntilEligible: 0,
      lastDonationDate: "None",
      nextEligibleDate: "Immediate",
      totalDonations: 0,
      livesSaved: 0,
      badge: "New Donor",
      healthVitals: {
        weight: session.weight || "68 kg",
        hemoglobin: "14.0 g/dL",
        bloodPressure: "120/80 mmHg",
        pulse: "72 bpm"
      },
      appointments: [],
      donationHistory: []
    };
    return this._cachedDonor;
  },

  async syncDonorFromApi() {
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.donor.getProfile();
        if (res && res.success && res.data && res.data.donor) {
          this._cachedDonor = res.data.donor;
          return this._cachedDonor;
        }
      }
    } catch (e) {
      console.warn("[DonorEngine] Error fetching profile from MongoDB:", e.message);
    }
    return this.getDonor();
  },

  /* ------------------------------------------------------------------------
     1. DONOR DASHBOARD
     ------------------------------------------------------------------------ */
  async renderDashboard() {
    const donor = await this.syncDonorFromApi();
    if (!donor) return;

    // Greeting & Hero
    const greetingEl = document.getElementById("donor-greeting-name");
    if (greetingEl) greetingEl.textContent = donor.name;

    const bgEl = document.getElementById("donor-hero-bloodgroup");
    if (bgEl) bgEl.textContent = donor.bloodGroup || "O+";

    const daysEl = document.getElementById("donor-eligibility-days");
    if (daysEl) daysEl.textContent = donor.daysUntilEligible || "0";

    const nextDateEl = document.getElementById("donor-next-date");
    if (nextDateEl) nextDateEl.textContent = donor.nextEligibleDate || "Immediate";

    // Metrics
    const totalDonationsEl = document.getElementById("stat-total-donations");
    if (totalDonationsEl) totalDonationsEl.textContent = donor.totalDonations || "0";

    const livesSavedEl = document.getElementById("stat-lives-saved");
    if (livesSavedEl) livesSavedEl.textContent = donor.livesSaved || (donor.totalDonations * 3);

    const badgeEl = document.getElementById("stat-donor-badge");
    if (badgeEl) badgeEl.textContent = donor.badge || "Active Donor";

    // Upcoming Appointment Card
    this._renderUpcomingBox(donor);

    // Recent Donations Table
    const recentTableBody = document.getElementById("donor-recent-table-body");
    if (recentTableBody) {
      const history = (donor.donations || donor.donationHistory || []).slice(0, 3);
      if (history.length === 0) {
        recentTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No donation records yet. Schedule your first donation!</td></tr>`;
      } else {
        recentTableBody.innerHTML = history.map(h => `
          <tr>
            <td><strong>${h.date ? (typeof h.date === 'string' ? h.date.split('T')[0] : new Date(h.date).toLocaleDateString()) : 'Recent'}</strong></td>
            <td>${h.facility || h.facilityName || 'Patiala Central Blood Centre'}</td>
            <td><span class="badge badge-slate">${h.donationType || 'Whole Blood'}</span></td>
            <td><span class="badge badge-emerald">Verified & Approved</span></td>
          </tr>
        `).join("");
      }
    }

    // Render Dynamic Compatibility Matrix
    this.renderCompatibilityMatrix(donor.bloodGroup || 'O+');
  },

  _renderUpcomingBox(donor) {
    const upcomingContainer = document.getElementById("upcoming-appointment-box");
    if (!upcomingContainer) return;

    const appointments = donor.appointments || [];
    const activeApt = appointments.find(a => a.status === "Confirmed");

    if (activeApt) {
      const code = activeApt.donorSlipCode || activeApt.slipCode || "RS-APT-9821";
      upcomingContainer.innerHTML = `
        <div class="card p-5" style="border-left: 4px solid var(--crimson-600); padding: 1.5rem;">
          <div class="flex justify-between items-start mb-3">
            <div>
              <span class="badge badge-emerald">Appointment Confirmed</span>
              <h4 class="font-bold text-lg mt-2">${activeApt.facilityName}</h4>
              <p class="text-xs text-muted mt-1 flex items-center gap-1">${ICONS.pin} <span>${activeApt.address || 'Central Healthcare Zone'}</span></p>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-slate-900">${activeApt.date}</div>
              <div class="text-xs text-muted">${activeApt.time || activeApt.timeSlot || '10:00 AM'}</div>
            </div>
          </div>
          <div class="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
            <div class="text-xs"><strong>Pass Code:</strong> <code style="font-family: var(--font-mono); font-weight: 700; color: var(--crimson-600);">${code}</code></div>
            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="DonorEngine.viewPassModal('${code}')" style="display: inline-flex; align-items: center; gap: 4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <span>View Pass</span>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="DonorEngine.printAppointmentSlip('${code}')" style="display: inline-flex; align-items: center; gap: 4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span>Print</span>
              </button>
              <a href="appointments.html" class="btn btn-ghost btn-sm">All Passes &rarr;</a>
            </div>
          </div>
        </div>
      `;
    } else {
      upcomingContainer.innerHTML = UIComponents.getEmptyStateHtml(
        ICONS.calendar,
        "No Upcoming Appointments",
        "You are eligible to schedule your next blood or platelet donation at any verified center.",
        "Book Donation Slot",
        "onclick=\"location.href='schedule-donation.html'\""
      );
    }
  },

  /* ------------------------------------------------------------------------
     COMPATIBILITY MATRIX ENGINE (Dynamic Healthcare Visualization)
     ------------------------------------------------------------------------ */
  renderCompatibilityMatrix(selectedGroup = "O+") {
    const container = document.getElementById("matrix-btn-group");
    if (!container) return;

    const allGroups = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];

    const compatibility = {
      "O-": {
        give: ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
        receive: ["O-"],
        badgeText: "Universal Red Cell Donor",
        clinicalNote: "O- red blood cells lack A, B, and Rh antigens, making them life-saving for any patient in trauma resuscitations when typing cannot wait."
      },
      "O+": {
        give: ["O+", "A+", "B+", "AB+"],
        receive: ["O+", "O-"],
        badgeText: "Highest Frequency Population Donor",
        clinicalNote: "O+ is present in ~38% of the population. Transfused to all Rh-positive patients across critical trauma and routine surgeries."
      },
      "A-": {
        give: ["A-", "A+", "AB-", "AB+"],
        receive: ["A-", "O-"],
        badgeText: "Platelet & Red Cell Contributor",
        clinicalNote: "A- donors provide critical packed red cells for A and AB patients, and are essential contributors to oncology and hematology wards."
      },
      "A+": {
        give: ["A+", "AB+"],
        receive: ["A+", "A-", "O+", "O-"],
        badgeText: "High Demand Surgical Resource",
        clinicalNote: "A+ is one of the most frequently requested units for elective orthopedic, cardiothoracic, and general surgical procedures."
      },
      "B-": {
        give: ["B-", "B+", "AB-", "AB+"],
        receive: ["B-", "O-"],
        badgeText: "Rare Clinical Resource (<2%)",
        clinicalNote: "Vital for patients with hemoglobinopathies (thalassemia, sickle cell) who require regular phenotype-matched blood transfusions."
      },
      "B+": {
        give: ["B+", "AB+"],
        receive: ["B+", "B-", "O+", "O-"],
        badgeText: "Essential Acute Contributor",
        clinicalNote: "B+ individuals make up ~9% of the registry, providing vital support for neonatal surgery, trauma, and burn recovery units."
      },
      "AB-": {
        give: ["AB-", "AB+"],
        receive: ["AB-", "A-", "B-", "O-"],
        badgeText: "Rarest Blood Type (<1%)",
        clinicalNote: "AB- is exceptionally rare. While red cell recipients are limited, AB plasma is universal and invaluable for burn trauma."
      },
      "AB+": {
        give: ["AB+"],
        receive: ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
        badgeText: "Universal Red Cell Recipient",
        clinicalNote: "AB+ patients can safely receive packed red blood cells from every other ABO and Rh group without acute hemolytic risk."
      }
    };

    const updateView = (group) => {
      const data = compatibility[group] || compatibility["O+"];

      const badgeEl = document.getElementById("matrix-active-group-badge");
      if (badgeEl) badgeEl.textContent = `Selected: ${group} (${data.badgeText})`;

      const giveCountEl = document.getElementById("matrix-give-count");
      if (giveCountEl) giveCountEl.textContent = `${data.give.length} Recipient Group${data.give.length > 1 ? 's' : ''}`;

      const giveChipsEl = document.getElementById("matrix-give-chips");
      if (giveChipsEl) {
        giveChipsEl.innerHTML = data.give.map(g => `
          <span class="blood-badge" style="background: var(--success-bg); color: var(--success-color); border: 1px solid var(--success-border); padding: 5px 12px; font-size: 0.85rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(4,120,87,0.12); transition: transform 0.15s ease;">
            ${g}
          </span>
        `).join('');
      }

      const giveDescEl = document.getElementById("matrix-give-desc");
      if (giveDescEl) giveDescEl.textContent = data.clinicalNote;

      const receiveCountEl = document.getElementById("matrix-receive-count");
      if (receiveCountEl) receiveCountEl.textContent = `${data.receive.length} Donor Group${data.receive.length > 1 ? 's' : ''}`;

      const receiveChipsEl = document.getElementById("matrix-receive-chips");
      if (receiveChipsEl) {
        receiveChipsEl.innerHTML = data.receive.map(g => `
          <span class="blood-badge" style="background: var(--info-bg); color: var(--info-color); border: 1px solid var(--info-border); padding: 5px 12px; font-size: 0.85rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(2,132,199,0.12); transition: transform 0.15s ease;">
            ${g}
          </span>
        `).join('');
      }

      const receiveDescEl = document.getElementById("matrix-receive-desc");
      if (receiveDescEl) {
        receiveDescEl.innerHTML = `<strong>Clinical Match:</strong> A patient with <code>${group}</code> can safely accept red cells from <strong>${data.receive.join(', ')}</strong>.`;
      }

      // Button highlight update
      container.querySelectorAll('.btn-matrix-group').forEach(btn => {
        if (btn.dataset.group === group) {
          btn.style.backgroundColor = 'var(--crimson-primary)';
          btn.style.color = '#ffffff';
          btn.style.borderColor = 'transparent';
          btn.style.boxShadow = '0 4px 12px rgba(169,43,39,0.32)';
          btn.style.transform = 'translateY(-2px)';
        } else {
          btn.style.backgroundColor = '#ffffff';
          btn.style.color = 'var(--text-primary)';
          btn.style.borderColor = 'var(--border-color)';
          btn.style.boxShadow = 'none';
          btn.style.transform = 'none';
        }
      });
    };

    container.innerHTML = allGroups.map(g => `
      <button type="button" class="btn btn-secondary btn-sm btn-matrix-group" data-group="${g}" style="padding: 6px 14px; font-weight: 700; border-radius: 6px;">
        ${g}
      </button>
    `).join('');

    container.querySelectorAll('.btn-matrix-group').forEach(btn => {
      btn.addEventListener('click', () => updateView(btn.dataset.group));
    });

    updateView(selectedGroup);
  },

  async cancelAppointment(aptId) {
    UIComponents.showConfirmDialog(
      "Cancel Appointment",
      "Are you sure you want to cancel this scheduled donation appointment?",
      async () => {
        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.donor.cancelAppointment(aptId);
          }
          this._cachedDonor = null;
          UIComponents.showToast("Appointment Cancelled", "Your booking has been cancelled in the registry.", "info");
          if (document.getElementById("appointments-table-body")) {
            await this.renderHistory();
          } else if (document.getElementById("appointments-page-table-body")) {
            await this.renderAppointmentsPage();
          } else {
            await this.renderDashboard();
          }
        } catch (e) {
          UIComponents.showToast("Cancellation Failed", e.message, "danger");
        }
      },
      "Yes, Cancel",
      true
    );
  },



  /* ------------------------------------------------------------------------
     3. 5-STEP SCHEDULE DONATION WIZARD
     ------------------------------------------------------------------------ */
  initScheduleWizard() {
    let currentStep = 1;
    const totalSteps = 5;

    const wizardData = {
      donationType: "Whole Blood",
      facilityType: "Blood Bank",
      facilityName: "Patiala Central Blood Centre",
      facilityAddress: "Urban Estate, Phase 2, Patiala",
      date: "",
      timeSlot: "10:00 AM - 11:00 AM",
      preScreenAnswers: {}
    };

    const updateWizardView = () => {
      // Update Stepper Bubbles
      for (let i = 1; i <= totalSteps; i++) {
        const stepEl = document.getElementById(`step-indicator-${i}`);
        if (stepEl) {
          stepEl.classList.remove("active", "completed");
          if (i === currentStep) stepEl.classList.add("active");
          else if (i < currentStep) stepEl.classList.add("completed");
        }

        const pane = document.getElementById(`wizard-pane-${i}`);
        if (pane) {
          pane.classList.remove("active");
          if (i === currentStep) pane.classList.add("active");
        }
      }

      // Prev / Next button states
      const prevBtn = document.getElementById("wizard-btn-prev");
      const nextBtn = document.getElementById("wizard-btn-next");

      if (prevBtn) prevBtn.style.display = currentStep === 1 ? "none" : "inline-flex";
      if (nextBtn) {
        if (currentStep === totalSteps) {
          nextBtn.style.display = "none";
        } else if (currentStep === totalSteps - 1) {
          nextBtn.textContent = "Confirm & Generate Slip";
        } else {
          nextBtn.textContent = "Continue to Next Step →";
        }
      }

      // If on step 5, generate the slip
      if (currentStep === 5) {
        this.renderAppointmentSlip(wizardData);
      }
    };

    // Step 1: Donation Type selection
    document.querySelectorAll(".donation-type-card").forEach(card => {
      card.addEventListener("click", () => {
        document.querySelectorAll(".donation-type-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        wizardData.donationType = card.dataset.type;
      });
    });

    // Step 2: Facility selection
    document.querySelectorAll(".facility-card-select").forEach(card => {
      card.addEventListener("click", () => {
        document.querySelectorAll(".facility-card-select").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        wizardData.facilityName = card.dataset.name;
        wizardData.facilityType = card.dataset.type;
        wizardData.facilityAddress = card.dataset.address;
      });
    });

    // Step 3: Date & Slot Picker
    const dateInput = document.getElementById("schedule-date-input");
    if (dateInput) {
      // Default to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const iso = tomorrow.toISOString().split("T")[0];
      dateInput.min = iso;
      dateInput.value = iso;
      wizardData.date = iso;

      dateInput.addEventListener("change", (e) => {
        wizardData.date = e.target.value;
      });
    }

    document.querySelectorAll(".time-slot-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".time-slot-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        wizardData.timeSlot = btn.dataset.slot;
      });
    });

    // Navigation Buttons
    const prevBtn = document.getElementById("wizard-btn-prev");
    const nextBtn = document.getElementById("wizard-btn-next");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (currentStep > 1) {
          currentStep--;
          updateWizardView();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", async () => {
        // Validation per step
        if (currentStep === 4) {
          // Verify pre-screening checkboxes
          const c1 = document.getElementById("check-feel-well").checked;
          const c2 = document.getElementById("check-weight").checked;
          const c3 = document.getElementById("check-no-tattoo").checked;
          const c4 = document.getElementById("check-consent").checked;

          if (!c1 || !c2 || !c3 || !c4) {
            UIComponents.showToast("Pre-Screening Required", "Please review and check all mandatory medical eligibility confirmations.", "warning");
            return;
          }

          // Save Appointment to storage
          const donor = this.getDonor();
          const newApt = {
            id: `apt_${Date.now()}`,
            facilityName: wizardData.facilityName,
            facilityType: wizardData.facilityType,
            address: wizardData.facilityAddress,
            date: wizardData.date || new Date().toISOString().split("T")[0],
            time: wizardData.timeSlot,
            donationType: wizardData.donationType,
            status: "Confirmed",
            donorSlipCode: `RS-APT-${Math.floor(1000 + Math.random() * 9000)}`
          };

          // Persist to MongoDB backend if ApiClient has active token
          if (typeof ApiClient !== "undefined" && ApiClient.getToken()) {
            nextBtn.disabled = true;
            nextBtn.textContent = "Confirming Booking...";
            try {
              const apiRes = await ApiClient.donor.bookAppointment({
                facilityName: wizardData.facilityName,
                facilityType: wizardData.facilityType,
                address: wizardData.facilityAddress,
                date: newApt.date,
                time: newApt.time,
                donationType: wizardData.donationType,
                donorSlipCode: newApt.donorSlipCode
              });

              if (apiRes && apiRes.success && apiRes.data && apiRes.data.appointment) {
                const bApt = apiRes.data.appointment;
                newApt._id = bApt._id;
                newApt.id = bApt._id;
                newApt.donorSlipCode = bApt.donorSlipCode || newApt.donorSlipCode;
              }
            } catch (e) {
              nextBtn.disabled = false;
              nextBtn.textContent = "Confirm & Generate Pass";
              UIComponents.showToast("Booking Failed", e.message || "Failed to persist appointment on server. Please try again.", "error");
              return;
            } finally {
              nextBtn.disabled = false;
            }
          }

          // Keep in-memory appointment data
          this._cachedDonor = null;
          if (donor) {
            if (!donor.appointments) donor.appointments = [];
            donor.appointments.unshift(newApt);
          }

          wizardData.slipCode = newApt.donorSlipCode;
          this._lastWizardData = { ...wizardData, ...newApt };

          UIComponents.showToast("Appointment Confirmed!", "Your digital donor slip has been created.", "success");
        }

        if (currentStep < totalSteps) {
          currentStep++;
          updateWizardView();
        }
      });
    }

    updateWizardView();
  },

  renderAppointmentSlip(wizardData) {
    this._lastWizardData = wizardData;
    const slipMount = document.getElementById("appointment-slip-mount");
    if (!slipMount) return;

    const donor = this.getDonor();

    slipMount.innerHTML = `
      <div class="donor-slip animate-fade-in">
        <div class="slip-header">
          <div class="flex items-center justify-center gap-2 mb-1">
            <span style="display: flex; align-items: center; color: var(--crimson-primary);">${ICONS.droplet}</span>
            <span class="font-extrabold text-lg text-slate-900">Rakt-Setu Official Donor Pass</span>
          </div>
          <span class="badge badge-emerald">Status: Confirmed & Pre-Screened</span>
        </div>

        <div class="slip-qr-placeholder" style="color: var(--text-muted);">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </div>
        <div class="text-center font-mono font-bold text-sm text-slate-700 mb-4">${wizardData.slipCode || 'RS-APT-9821'}</div>

        <div class="grid grid-cols-2 gap-3 text-xs mb-4">
          <div><strong class="text-muted">Donor Name:</strong> <div class="text-sm font-semibold">${donor.name}</div></div>
          <div><strong class="text-muted">Blood Group:</strong> <div class="text-sm font-bold text-crimson">${donor.bloodGroup}</div></div>
          <div><strong class="text-muted">Center:</strong> <div class="text-sm font-semibold">${wizardData.facilityName}</div></div>
          <div><strong class="text-muted">Donation Type:</strong> <div class="text-sm font-semibold">${wizardData.donationType}</div></div>
          <div><strong class="text-muted">Date:</strong> <div class="text-sm font-semibold">${wizardData.date}</div></div>
          <div><strong class="text-muted">Time Slot:</strong> <div class="text-sm font-semibold">${wizardData.timeSlot}</div></div>
        </div>

        <div class="p-3 text-xs bg-slate-50 border border-slate-200 rounded text-slate-600 mb-4">
          <strong>Important Instructions:</strong> Please hydrate adequately, avoid high-fat meals 3 hours prior, and carry a valid photo ID to the collection center.
        </div>

        <div class="flex gap-2 justify-center flex-wrap">
          <button class="btn btn-secondary btn-sm" onclick="DonorEngine.printAppointmentSlip('${wizardData.slipCode || 'RS-APT-9821'}')" style="display: inline-flex; align-items: center; gap: 4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>Print Pass</span>
          </button>
          <a href="appointments.html" class="btn btn-secondary btn-sm">My Appointments</a>
          <a href="donation-history.html" class="btn btn-secondary btn-sm">Donation History</a>
          <a href="dashboard.html" class="btn btn-primary btn-sm">Go to Dashboard</a>
        </div>
      </div>
    `;
  },

  printAppointmentSlip(slipCode) {
    const donor = this.getDonor();
    let apt = (this._lastWizardData && (this._lastWizardData.slipCode === slipCode || !slipCode)) 
      ? this._lastWizardData 
      : (donor.activeAppointment || {});

    if (!apt.facilityName && donor.activeAppointment) {
      apt = { ...donor.activeAppointment, ...apt };
    }

    const aptData = {
      donorSlipCode: slipCode || apt.donorSlipCode || apt.slipCode || "RS-APT-9821",
      facilityName: apt.facilityName || "Central Regional Blood Depot",
      address: apt.address || "Medical Enclave, Healthcare Zone",
      donationType: apt.donationType || "Whole Blood",
      date: apt.date || new Date().toISOString().split("T")[0],
      timeSlot: apt.timeSlot || apt.time || "10:00 AM - 11:30 AM",
      donorName: donor.name || "Voluntary Donor",
      bloodGroup: donor.bloodGroup || "O+",
      phone: donor.phone || "+91 98765 43210"
    };

    if (typeof PrintEngine !== "undefined" && PrintEngine.printAppointmentSlip) {
      PrintEngine.printAppointmentSlip(aptData, donor);
    } else if (typeof UIComponents !== "undefined" && UIComponents.print) {
      UIComponents.print("appointment", aptData, donor);
    } else {
      window.print();
    }
  },

  /* ------------------------------------------------------------------------
     4. DONATION HISTORY & APPOINTMENTS ENGINE
     ------------------------------------------------------------------------ */
  async renderHistory() {
    const donor = await this.syncDonorFromApi() || {};

    // Synchronize latest history and appointments directly from MongoDB
    if (typeof ApiClient !== "undefined") {
      try {
        const res = await ApiClient.donor.getHistory();
        if (res && res.success && res.data) {
          if (res.data.donations) {
            donor.donationHistory = res.data.donations;
            donor.donations = res.data.donations;
            donor.totalDonations = res.data.donations.length;
            donor.livesSaved = res.data.donations.length * 3;
          }
          if (res.data.appointments) {
            donor.appointments = res.data.appointments;
          }
        }
      } catch (e) {
        console.warn("[DonorEngine] Backend history fetch error:", e.message);
      }
    }

    this._populateHistoryTables(donor);
  },

  _populateHistoryTables(donor) {
    // 1. Populate Scheduled Appointments Table
    const aptTableBody = document.getElementById("appointments-table-body");
    const aptCountEl = document.getElementById("appointments-total-count");
    const appointments = donor.appointments || [];

    if (aptCountEl) {
      const activeCount = appointments.filter(a => a.status === "Confirmed").length;
      aptCountEl.textContent = `${activeCount} Active Scheduled ${activeCount === 1 ? 'Pass' : 'Passes'} &bull; ${appointments.length} Total Bookings`;
    }

    if (aptTableBody) {
      if (appointments.length === 0) {
        aptTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-muted text-xs">No scheduled donation appointments yet. <a href="schedule-donation.html" class="text-primary font-bold" style="margin-left: 4px;">+ Schedule Your First Appointment</a></td></tr>`;
      } else {
        aptTableBody.innerHTML = appointments.map(a => {
          const code = a.donorSlipCode || a.slipCode || "RS-APT-9821";
          const statusBadge = a.status === "Confirmed" 
            ? `<span class="badge badge-emerald">● Confirmed</span>`
            : a.status === "Completed"
            ? `<span class="badge badge-sky">Completed</span>`
            : `<span class="badge badge-slate">Cancelled</span>`;

          const cancelBtn = a.status === "Confirmed"
            ? `<button class="btn btn-ghost btn-sm text-crimson" onclick="DonorEngine.cancelAppointment('${a._id || a.id}')" title="Cancel this appointment">Cancel</button>`
            : '';

          return `
            <tr>
              <td><span class="badge badge-crimson font-mono font-bold" style="letter-spacing: 0.05em;">${code}</span></td>
              <td><strong>${a.date}</strong><br><span class="text-xs text-muted">${a.time || a.timeSlot || '10:00 AM - 11:30 AM'}</span></td>
              <td><strong>${a.facilityName || 'Patiala Central Blood Centre'}</strong><br><span class="text-xs text-muted">${a.address || 'Patiala'}</span></td>
              <td><span class="badge badge-slate">${a.donationType || 'Whole Blood'}</span></td>
              <td>${statusBadge}</td>
              <td>
                <div class="flex items-center gap-1">
                  <button class="btn btn-secondary btn-sm" onclick="DonorEngine.viewPassModal('${code}')" style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    <span>View Pass</span>
                  </button>
                  ${cancelBtn}
                </div>
              </td>
            </tr>
          `;
        }).join("");
      }
    }

    // 2. Populate Completed Donations Table
    const tableBody = document.getElementById("history-table-body");
    const countEl = document.getElementById("history-total-count");
    const history = donor.donationHistory || [];

    if (countEl) countEl.textContent = `${history.length} Completed Donations &bull; Authenticated Clinical Records`;

    if (tableBody) {
      if (history.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6">${UIComponents.getEmptyStateHtml(ICONS.history, "No Completed Donations", "Completed donation records and verified digital certificates will appear here after facility confirmation.")}</td></tr>`;
      } else {
        tableBody.innerHTML = history.map(h => `
          <tr>
            <td><strong>${h.date}</strong></td>
            <td>${h.facility || h.facilityName}</td>
            <td><span class="badge badge-slate">${h.donationType || 'Whole Blood'}</span></td>
            <td><strong>${h.units || 1} Unit</strong></td>
            <td><span class="badge badge-emerald">✓ ${h.testStatus || 'Screened & Approved'}</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="DonorEngine.viewCertificate('${h.certificateId}', '${h.date}', '${h.facility || h.facilityName}', '${h.donationType || 'Whole Blood'}')" style="display: inline-flex; align-items: center; gap: 4px;">
                ${ICONS.award}
                <span>Certificate</span>
              </button>
            </td>
          </tr>
        `).join("");
      }
    }
  },

  /* ------------------------------------------------------------------------
     MY APPOINTMENTS PAGE ENGINE
     ------------------------------------------------------------------------ */
  async renderAppointmentsPage(filter = 'ALL') {
    const donor = await this.syncDonorFromApi() || {};

    if (typeof ApiClient !== "undefined") {
      try {
        const res = await ApiClient.donor.getAppointments();
        if (res && res.success && res.data && res.data.appointments) {
          donor.appointments = res.data.appointments;
        }
      } catch (e) {
        console.warn("[DonorEngine] Backend appointments fetch error:", e.message);
      }
    }

    const tableBody = document.getElementById("appointments-page-table-body");
    const subtitleEl = document.getElementById("appointments-status-subtitle");
    if (!tableBody) return;

    let appointments = donor.appointments || [];
    if (filter !== 'ALL') {
      appointments = appointments.filter(a => a.status === filter);
    }

    if (subtitleEl) {
      const activeCount = (donor.appointments || []).filter(a => a.status === "Confirmed").length;
      subtitleEl.textContent = `Showing ${appointments.length} appointments (${activeCount} active entry slips)`;
    }

    if (appointments.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-muted text-xs">No ${filter === 'ALL' ? '' : filter.toLowerCase()} appointments found. <a href="schedule-donation.html" class="text-primary font-bold" style="margin-left: 4px;">+ Book an Appointment</a></td></tr>`;
      return;
    }

    tableBody.innerHTML = appointments.map(a => {
      const code = a.donorSlipCode || a.slipCode || "RS-APT-9821";
      const statusBadge = a.status === "Confirmed" 
        ? `<span class="badge badge-emerald">● Confirmed</span>`
        : a.status === "Completed"
        ? `<span class="badge badge-sky">Completed</span>`
        : `<span class="badge badge-slate">Cancelled</span>`;

      const cancelBtn = a.status === "Confirmed"
        ? `<button class="btn btn-ghost btn-sm text-crimson" onclick="DonorEngine.cancelAppointment('${a._id || a.id}')" title="Cancel this appointment">Cancel</button>`
        : '';

      return `
        <tr>
          <td><span class="badge badge-crimson font-mono font-bold" style="letter-spacing: 0.05em;">${code}</span></td>
          <td><strong>${a.date}</strong><br><span class="text-xs text-muted">${a.time || a.timeSlot || '10:00 AM - 11:30 AM'}</span></td>
          <td><strong>${a.facilityName || 'Patiala Central Blood Centre'}</strong><br><span class="text-xs text-muted">${a.address || 'Patiala'}</span></td>
          <td><span class="badge badge-slate">${a.donationType || 'Whole Blood'}</span></td>
          <td>${statusBadge}</td>
          <td>
            <div class="flex items-center gap-1">
              <button class="btn btn-secondary btn-sm" onclick="DonorEngine.viewPassModal('${code}')" style="display: inline-flex; align-items: center; gap: 4px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <span>View / Print Pass</span>
              </button>
              ${cancelBtn}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  },

  filterAppointments(filter, btn) {
    if (btn) {
      document.querySelectorAll("#apt-filter-group button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    }
    this.renderAppointmentsPage(filter);
  },

  /* ------------------------------------------------------------------------
     DIGITAL DONOR PASS MODAL & CANCELLATION
     ------------------------------------------------------------------------ */
  viewPassModal(slipCodeOrId) {
    const donor = this.getDonor();
    if (!donor) return;

    let apt = (donor.appointments || []).find(a => 
      (a.donorSlipCode && a.donorSlipCode === slipCodeOrId) ||
      (a.slipCode && a.slipCode === slipCodeOrId) ||
      (a._id && a._id.toString() === slipCodeOrId) ||
      (a.id && a.id.toString() === slipCodeOrId)
    );

    if (!apt && this._lastWizardData) {
      apt = this._lastWizardData;
    }

    if (!apt) {
      UIComponents.showToast("Pass Not Found", "Unable to locate the requested appointment slip.", "warning");
      return;
    }

    const code = apt.donorSlipCode || apt.slipCode || slipCodeOrId || "RS-APT-9821";
    const statusText = apt.status || "Confirmed";
    const statusBadgeClass = statusText === "Confirmed" ? "badge-emerald" : statusText === "Completed" ? "badge-sky" : "badge-slate";

    const modalMount = document.getElementById("pass-modal-content");
    const modalBackdrop = document.getElementById("pass-modal-backdrop");
    if (!modalMount || !modalBackdrop) return;

    modalMount.innerHTML = `
      <div class="donor-slip animate-fade-in" style="padding: 0; box-shadow: none; border: none; background: transparent;">
        <div class="slip-header text-center mb-3">
          <div class="flex items-center justify-center gap-2 mb-1">
            <span style="display: flex; align-items: center; color: var(--crimson-primary);">${ICONS.droplet}</span>
            <span class="font-extrabold text-lg text-slate-900">Rakt-Setu Official Donor Pass</span>
          </div>
          <span class="badge ${statusBadgeClass}">Status: ${statusText}</span>
        </div>

        <div class="slip-qr-placeholder text-center py-4" style="color: var(--text-muted); background: #f8fafc; border-radius: 8px; margin-bottom: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <div class="font-mono font-bold text-sm text-slate-800 mt-2" style="letter-spacing: 0.08em;">${code}</div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs mb-4" style="background: #f1f5f9; padding: 12px; border-radius: 8px;">
          <div><strong class="text-muted">Donor Name:</strong> <div class="text-sm font-semibold text-slate-800">${donor.name}</div></div>
          <div><strong class="text-muted">Blood Group:</strong> <div class="text-sm font-bold text-crimson">${donor.bloodGroup || 'O+'}</div></div>
          <div><strong class="text-muted">Center:</strong> <div class="text-sm font-semibold text-slate-800">${apt.facilityName || 'Patiala Central Blood Centre'}</div></div>
          <div><strong class="text-muted">Donation Type:</strong> <div class="text-sm font-semibold text-slate-800">${apt.donationType || 'Whole Blood'}</div></div>
          <div><strong class="text-muted">Date:</strong> <div class="text-sm font-semibold text-slate-800">${apt.date}</div></div>
          <div><strong class="text-muted">Time Slot:</strong> <div class="text-sm font-semibold text-slate-800">${apt.time || apt.timeSlot || '10:00 AM - 11:30 AM'}</div></div>
        </div>

        <div class="p-3 text-xs bg-amber-50 border border-amber-200 rounded text-amber-800 mb-4">
          <strong>Important Instructions:</strong> Carry this digital pass along with a valid Government photo ID to the donation collection desk. Hydrate well prior to collection.
        </div>

        <div class="flex gap-2 justify-center pt-2 border-t border-slate-200">
          <button class="btn btn-primary btn-sm" onclick="DonorEngine.printAppointmentSlip('${code}')" style="display: inline-flex; align-items: center; gap: 6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <span>Print Official Slip</span>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('pass-modal-backdrop').style.display='none'">Close</button>
        </div>
      </div>
    `;

    modalBackdrop.style.display = "flex";
  },

  async cancelAppointment(appointmentId) {
    if (!confirm("Are you sure you want to cancel this scheduled donation appointment?")) {
      return;
    }

    const donor = this.getDonor();
    if (!donor) return;

    try {
      if (typeof ApiClient !== "undefined") {
        await ApiClient.donor.cancelAppointment(appointmentId);
      }
    } catch (e) {
      console.warn("[DonorEngine] Backend cancel error:", e.message);
    }

    this._cachedDonor = null;
    if (donor.appointments) {
      const apt = donor.appointments.find(a => (a._id && a._id.toString() === appointmentId) || (a.id && a.id.toString() === appointmentId));
      if (apt) {
        apt.status = "Cancelled";
      }
    }

    UIComponents.showToast("Appointment Cancelled", "Your booking status has been updated to Cancelled.", "info");

    // Re-render whichever view is active
    if (document.getElementById("appointments-table-body")) {
      await this.renderHistory();
    } else if (document.getElementById("appointments-page-table-body")) {
      await this.renderAppointmentsPage();
    } else if (document.getElementById("upcoming-appointment-box")) {
      await this.renderDashboard();
    }
  },

  viewCertificate(certId, date, facility, type) {
    const donor = this.getDonor();
    const certData = {
      certificateId: certId,
      date: date,
      facility: facility,
      donationType: type,
      donorName: donor.name,
      bloodGroup: donor.bloodGroup
    };

    if (typeof PrintEngine !== "undefined" && PrintEngine.printDonationCertificate) {
      PrintEngine.printDonationCertificate(certData, donor);
    } else if (typeof UIComponents !== "undefined" && UIComponents.print) {
      UIComponents.print("certificate", certData, donor);
    } else {
      window.print();
    }
  },

  /* ------------------------------------------------------------------------
     5. DONOR PROFILE
     ------------------------------------------------------------------------ */
  async renderProfile() {
    const donor = await this.syncDonorFromApi();
    if (!donor) return;

    // Populate Left Vitals Summary Card
    const cardAvatar = document.getElementById("prof-card-avatar");
    const cardName = document.getElementById("prof-card-name");
    const cardBadge = document.getElementById("prof-card-badge");
    const cardBlood = document.getElementById("prof-card-blood");
    const cardWeight = document.getElementById("prof-card-weight");
    const cardHb = document.getElementById("prof-card-hb");
    const cardBp = document.getElementById("prof-card-bp");

    const vitals = donor.healthVitals || {};

    const updateAvatarDisplay = (photoUrl, name) => {
      if (cardAvatar) {
        if (photoUrl) {
          cardAvatar.innerHTML = `<img src="${photoUrl}" alt="${name || 'Avatar'}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
          cardAvatar.textContent = name ? name.charAt(0).toUpperCase() : "D";
        }
      }

      const sidebarAvatar = document.getElementById("sidebar-user-avatar") || document.querySelector(".sidebar-user-avatar");
      if (sidebarAvatar && photoUrl) {
        sidebarAvatar.innerHTML = `<img src="${photoUrl}" alt="${name || 'Avatar'}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
      }
    };

    updateAvatarDisplay(donor.profilePhoto, donor.name);
    if (cardName) cardName.textContent = donor.name || "Voluntary Donor";
    if (cardBadge) cardBadge.textContent = donor.badge || "Verified Donor";
    if (cardBlood) cardBlood.textContent = donor.bloodGroup || "O+";
    if (cardWeight) cardWeight.textContent = vitals.weight || (donor.weight ? `${donor.weight} kg` : "70 kg");
    if (cardHb) cardHb.textContent = vitals.hemoglobin || (donor.hemoglobin ? `${donor.hemoglobin} g/dL (Normal)` : "14.4 g/dL (Normal)");
    if (cardBp) cardBp.textContent = vitals.bloodPressure || donor.bloodPressure || "120/80 mmHg";

    // Populate Edit Form Inputs
    const nameInput = document.getElementById("prof-name");
    const emailInput = document.getElementById("prof-email");
    const phoneInput = document.getElementById("prof-phone");
    const bloodSelect = document.getElementById("prof-blood");
    const cityInput = document.getElementById("prof-city");
    const areaInput = document.getElementById("prof-area");

    if (nameInput) nameInput.value = donor.name || "";
    if (emailInput) emailInput.value = donor.email || "";
    if (phoneInput) phoneInput.value = donor.phone || "";
    if (bloodSelect) bloodSelect.value = donor.bloodGroup || "O+";
    if (cityInput) cityInput.value = donor.city || "Patiala";
    if (areaInput) areaInput.value = donor.area || "Urban Estate, Phase 2";

    // Profile Form Submission
    const form = document.getElementById("form-donor-profile");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const updatedFields = {
          name: nameInput.value.trim(),
          phone: phoneInput.value.trim(),
          bloodGroup: bloodSelect.value,
          city: cityInput.value.trim(),
          area: areaInput.value.trim()
        };

        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.donor.updateProfile(updatedFields);
          }
          donor.name = updatedFields.name;
          donor.phone = updatedFields.phone;
          donor.bloodGroup = updatedFields.bloodGroup;
          donor.city = updatedFields.city;
          donor.area = updatedFields.area;

          const session = Storage.getSession();
          if (session) {
            session.name = donor.name;
            session.bloodGroup = donor.bloodGroup;
            Storage.setSession(session);
          }

          this._cachedDonor = { ...donor };
          updateAvatarDisplay(donor.profilePhoto, donor.name);
          if (cardName) cardName.textContent = donor.name;
          if (cardBlood) cardBlood.textContent = donor.bloodGroup;

          UIComponents.initShell("DONOR", "profile", "My Profile");
          UIComponents.showToast("Profile Updated", "Your donor information has been saved in MongoDB.", "success");
        } catch (apiErr) {
          UIComponents.showToast("Update Failed", apiErr.message || "Could not update profile.", "error");
        }
      });
    }

    // Photo Upload (Multer Integration)
    const photoInput = document.getElementById("donor-photo-input");
    const photoStatus = document.getElementById("photo-upload-status");
    if (photoInput) {
      photoInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (photoStatus) {
          photoStatus.style.display = "block";
          photoStatus.textContent = "Uploading avatar photo...";
        }

        try {
          if (typeof ApiClient !== "undefined") {
            const res = await ApiClient.donor.uploadPhoto(file);
            if (res && res.data && res.data.photoUrl) {
              donor.profilePhoto = res.data.photoUrl;
              const session = Storage.getSession();
              if (session) {
                session.profilePhoto = donor.profilePhoto;
                Storage.setSession(session);
              }
              this._cachedDonor = { ...donor };
              updateAvatarDisplay(donor.profilePhoto, donor.name);
              UIComponents.showToast("Avatar Updated", "Your profile photograph has been uploaded.", "success");
            }
          }
        } catch (uploadErr) {
          UIComponents.showToast("Upload Failed", uploadErr.message || "Failed to upload photo.", "error");
        } finally {
          if (photoStatus) photoStatus.style.display = "none";
          photoInput.value = "";
        }
      });
    }

    // Documents Upload & Management (Multer Integration)
    await this.renderDocumentsList();
    const docForm = document.getElementById("form-upload-document");
    if (docForm) {
      docForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("doc-file-input");
        const typeSelect = document.getElementById("doc-type-select");
        const descInput = document.getElementById("doc-desc-input");
        const feedback = document.getElementById("doc-upload-feedback");
        const btnUpload = document.getElementById("btn-upload-doc");

        const file = fileInput.files[0];
        if (!file) {
          UIComponents.showToast("Missing File", "Please select a file to upload.", "warning");
          return;
        }

        btnUpload.disabled = true;
        btnUpload.textContent = "Uploading...";
        if (feedback) feedback.textContent = "Processing multipart upload via Multer...";

        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.donor.uploadDocument(file, typeSelect.value, descInput.value.trim());
            UIComponents.showToast("Document Uploaded", `${file.name} saved to secure healthcare repository.`, "success");
            await this.renderDocumentsList();
            fileInput.value = "";
            descInput.value = "";
          }
        } catch (docErr) {
          UIComponents.showToast("Upload Error", docErr.message || "Failed to upload document.", "error");
          if (feedback) feedback.textContent = `Error: ${docErr.message}`;
        } finally {
          btnUpload.disabled = false;
          btnUpload.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Upload Document</span>`;
          if (feedback) feedback.textContent = "Allowed formats: PDF, JPEG, PNG, WEBP (Max 5MB)";
        }
      });
    }
  },

  async renderDocumentsList() {
    const container = document.getElementById("donor-documents-container");
    const countBadge = document.getElementById("doc-count-badge");
    if (!container) return;

    let docs = [];
    try {
      if (typeof ApiClient !== "undefined") {
        const res = await ApiClient.donor.getDocuments();
        if (res && res.data && res.data.documents) {
          docs = res.data.documents.filter(d => d.documentType !== 'PROFILE_PHOTO');
        }
      }
    } catch (e) {
      console.warn("[Docs]: Could not load documents from API:", e.message);
    }

    if (countBadge) countBadge.textContent = `${docs.length} Document${docs.length === 1 ? '' : 's'}`;

    if (docs.length === 0) {
      container.innerHTML = `<div class="text-center text-muted text-xs py-4">No verified documents uploaded yet. Upload your ID or medical certificate above.</div>`;
      return;
    }

    const token = typeof ApiClient !== "undefined" ? ApiClient.getToken() : "";

    container.innerHTML = `
      <div class="flex flex-col gap-2">
        ${docs.map(d => `
          <div class="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-white" style="transition: border-color 0.15s ease;">
            <div class="flex items-center gap-3">
              <div style="width: 34px; height: 34px; border-radius: 6px; background: var(--slate-100); color: var(--text-secondary); display: flex; align-items: center; justify-content: center;">
                ${d.mimeType && d.mimeType.includes('pdf') ? ICONS.fileText : ICONS.image}
              </div>
              <div>
                <div class="font-bold text-xs text-slate-800">${d.originalName}</div>
                <div class="text-xs text-muted flex gap-2">
                  <span class="badge badge-slate" style="font-size: 0.65rem;">${d.documentType}</span>
                  <span>${(d.fileSize / 1024).toFixed(1)} KB</span>
                  <span>${new Date(d.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <a href="/api/donors/documents/${d._id}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 5px 10px; display: inline-flex; align-items: center; gap: 4px;">
                ${ICONS.eye}
                <span>View</span>
              </a>
              <button type="button" class="btn btn-ghost btn-sm text-crimson" onclick="DonorEngine.deleteDocument('${d._id}')" style="padding: 5px 8px;" title="Delete Document">
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
      "Are you sure you want to permanently delete this document?",
      async () => {
        try {
          if (typeof ApiClient !== "undefined") {
            await ApiClient.donor.deleteDocument(docId);
            UIComponents.showToast("Document Deleted", "File removed from storage.", "info");
            this.renderDocumentsList();
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
