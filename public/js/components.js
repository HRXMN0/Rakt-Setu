/**
 * RAKT-SETU ENTERPRISE UI COMPONENTS & SHELL RENDERER
 * Renders consistent persistent grouped sidebars, topbars with breadcrumbs,
 * Lucide-style SVG vector icons, dialogs, toast alerts, and responsive layouts.
 */

const ICONS = {
  dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
  search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  calendar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  history: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  droplet: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`,
  clipboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
  emergency: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  network: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
  transfer: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  flask: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.69 17.5A2 2 0 0 0 6.26 21h11.48a2 2 0 0 0 1.57-3.5L14 9.31V2"></path><line x1="8.5" y1="2" x2="15.5" y2="2"></line><line x1="14" y1="9.31" x2="10" y2="9.31"></line></svg>`,
  inbox: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`,
  building: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line><line x1="9" y1="18" x2="9" y2="18.01"></line><line x1="15" y1="18" x2="15" y2="18.01"></line></svg>`,
  logout: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
  heart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
  award: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  activity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></polyline></svg>`,
  box: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  upload: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  fileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
  image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  pin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
};

const UIComponents = {
  NAV_GROUPS: {
    DONOR: [
      {
        section: "Main",
        items: [
          { key: "dashboard", href: "dashboard.html", icon: ICONS.dashboard, label: "Overview" },
          { key: "schedule", href: "schedule-donation.html", icon: ICONS.calendar, label: "Schedule Donation" },
          { key: "appointments", href: "appointments.html", icon: ICONS.clipboard, label: "My Appointments" },
          { key: "history", href: "donation-history.html", icon: ICONS.history, label: "Donation History" }
        ]
      },
      {
        section: "Account",
        items: [
          { key: "profile", href: "profile.html", icon: ICONS.user, label: "My Profile" }
        ]
      }
    ],
    HOSPITAL: [
      {
        section: "Operations",
        items: [
          { key: "dashboard", href: "dashboard.html", icon: ICONS.dashboard, label: "Clinical Cockpit" },
          { key: "inventory", href: "inventory.html", icon: ICONS.droplet, label: "Blood Inventory" },
          { key: "request-blood", href: "request-blood.html", icon: ICONS.clipboard, label: "Request Blood" },
          { key: "emergency-requests", href: "emergency-requests.html", icon: ICONS.emergency, label: "Emergency Tracking", badge: "Live" }
        ]
      },
      {
        section: "Network & Resources",
        items: [
          { key: "emergency-network", href: "emergency-network.html", icon: ICONS.network, label: "Emergency Network" },
          { key: "transfers", href: "transfers.html", icon: ICONS.transfer, label: "Blood Transfers" },
          { key: "donors", href: "donors.html", icon: ICONS.users, label: "Authorized Donors" },
          { key: "request-history", href: "request-history.html", icon: ICONS.history, label: "Requisition Logs" }
        ]
      },
      {
        section: "Settings",
        items: [
          { key: "profile", href: "profile.html", icon: ICONS.building, label: "Hospital Profile" }
        ]
      }
    ],
    BLOOD_BANK: [
      {
        section: "Depot Management",
        items: [
          { key: "dashboard", href: "dashboard.html", icon: ICONS.dashboard, label: "Depot Overview" },
          { key: "inventory", href: "inventory.html", icon: ICONS.flask, label: "Cold Storage Stock" },
          { key: "requests", href: "requests.html", icon: ICONS.inbox, label: "Hospital Orders", badge: "Queue" }
        ]
      },
      {
        section: "Regional Grid",
        items: [
          { key: "emergency-network", href: "emergency-network.html", icon: ICONS.emergency, label: "Regional SOS Alert" },
          { key: "donors", href: "donors.html", icon: ICONS.users, label: "Donor Registry" }
        ]
      },
      {
        section: "Facility",
        items: [
          { key: "profile", href: "profile.html", icon: ICONS.building, label: "Facility Profile" }
        ]
      }
    ]
  },

  initShell(role, activePageKey, breadcrumbTitle = "") {
    let session = Storage.getSession();

    // Prevent cross-role session contamination: if session is for another role, use neutral role defaults
    if (!session || (session.role !== role && session.role !== "SUPER_ADMIN")) {
      session = {
        name: role === "DONOR" ? "Blood Donor" : role === "HOSPITAL" ? "Clinical Staff" : "Depot Admin",
        email: role === "DONOR" ? "donor@raktsetu.org" : role === "HOSPITAL" ? "staff@cityhospital.org" : "admin@raktsetu.org",
        role: role,
        facilityName: role === "DONOR" ? null : (role === "HOSPITAL" ? "Government Rajindra Hospital, Patiala" : "Patiala Central Blood Centre")
      };
    }

    const sidebarContainer = document.getElementById("sidebar-mount");
    if (sidebarContainer) {
      sidebarContainer.innerHTML = this.buildSidebarHtml(role, activePageKey, session);
    }

    const topbarContainer = document.getElementById("topbar-mount");
    if (topbarContainer) {
      topbarContainer.innerHTML = this.buildTopbarHtml(role, activePageKey, breadcrumbTitle, session);
    }

    const mobileNavContainer = document.getElementById("mobile-nav-mount");
    if (mobileNavContainer) {
      mobileNavContainer.innerHTML = this.buildMobileNavHtml(role, activePageKey);
    }

    if (!document.getElementById("toast-container")) {
      const toastCont = document.createElement("div");
      toastCont.id = "toast-container";
      toastCont.className = "toast-container";
      document.body.appendChild(toastCont);
    }

    document.querySelectorAll(".btn-action-logout").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.showConfirmDialog(
          "Sign Out",
          "Are you sure you want to end your current session?",
          () => {
            Auth.logout("login.html");
          },
          "Sign Out"
        );
      });
    });

    // Live Clock Telemetry
    const clockEl = document.getElementById("topbar-live-clock");
    if (clockEl) {
      const updateClock = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      };
      updateClock();
      setInterval(updateClock, 1000);
    }

    // Smooth Dynamic KPI Counter Animation
    setTimeout(() => {
      document.querySelectorAll(".stat-card-value").forEach(el => {
        const raw = el.textContent.trim();
        const num = parseInt(raw, 10);
        if (!isNaN(num) && num > 0 && String(num) === raw) {
          let count = 0;
          const step = Math.max(1, Math.floor(num / 18));
          const interval = setInterval(() => {
            count += step;
            if (count >= num) {
              el.textContent = num;
              clearInterval(interval);
            } else {
              el.textContent = count;
            }
          }, 30);
        }
      });
    }, 120);
  },

  buildSidebarHtml(role, activeKey, session) {
    const roleBadges = {
      DONOR: '<span class="sidebar-role-badge badge-role-donor">Donor Portal</span>',
      HOSPITAL: '<span class="sidebar-role-badge badge-role-hospital">Hospital Portal</span>',
      BLOOD_BANK: '<span class="sidebar-role-badge badge-role-blood-bank">Blood Bank Portal</span>'
    };

    const groups = this.NAV_GROUPS[role] || [];
    let navSectionsHtml = "";

    groups.forEach(group => {
      navSectionsHtml += `<div class="sidebar-nav-section-title">${group.section}</div>`;
      group.items.forEach(item => {
        navSectionsHtml += `
          <a href="${item.href}" class="sidebar-link ${item.key === activeKey ? 'active' : ''}">
            <span class="sidebar-link-icon">${item.icon}</span>
            <span>${item.label}</span>
            ${item.badge ? `<span class="sidebar-link-badge">${item.badge}</span>` : ''}
          </a>
        `;
      });
    });

    const initial = session.name ? session.name.charAt(0).toUpperCase() : "U";

    let primaryDisplayName = "";
    let secondaryDisplayMeta = "";
    let roleSubBadge = "";

    if (session.role === "SUPER_ADMIN") {
      primaryDisplayName = session.name || "System Administrator";
      secondaryDisplayMeta = session.email || "superadmin@raktsetu.org";
      roleSubBadge = `<span class="badge badge-purple" style="font-size: 0.65rem; padding: 2px 6px; font-weight: 700; margin-top: 2px; display: inline-block;">SUPER ADMIN</span>`;
    } else if (role === "DONOR" || session.role === "DONOR") {
      primaryDisplayName = session.name || "Registered Donor";
      secondaryDisplayMeta = session.email || "donor@raktsetu.org";
      const bg = session.bloodGroup ? ` &bull; ${session.bloodGroup}` : "";
      roleSubBadge = `<span class="badge badge-crimson" style="font-size: 0.65rem; padding: 1px 6px; font-weight: 600; margin-top: 2px; display: inline-block;">Verified Donor${bg}</span>`;
    } else if (role === "HOSPITAL" || session.role === "HOSPITAL_STAFF") {
      primaryDisplayName = session.facilityName || "Government Rajindra Hospital, Patiala";
      secondaryDisplayMeta = `${session.name || "Clinical Staff"} &bull; ${session.email}`;
      roleSubBadge = `<span class="badge badge-emerald" style="font-size: 0.65rem; padding: 1px 6px; font-weight: 600; margin-top: 2px; display: inline-block;">Hospital Staff</span>`;
    } else if (role === "BLOOD_BANK" || session.role === "ADMIN") {
      primaryDisplayName = session.facilityName || "Patiala Central Blood Centre";
      secondaryDisplayMeta = `${session.name || "Depot Administrator"} &bull; ${session.email}`;
      roleSubBadge = `<span class="badge badge-amber" style="font-size: 0.65rem; padding: 1px 6px; font-weight: 600; margin-top: 2px; display: inline-block;">Blood Bank Admin</span>`;
    } else {
      primaryDisplayName = session.name || "User";
      secondaryDisplayMeta = session.email || "";
      roleSubBadge = `<span class="badge" style="font-size: 0.65rem; padding: 1px 6px; font-weight: 600; margin-top: 2px; display: inline-block;">${role}</span>`;
    }

    const avatarHtml = session.profilePhoto
      ? `<img src="${session.profilePhoto}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
      : initial;

    return `
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
          </div>
          <div class="sidebar-brand-text">
            <div class="sidebar-brand-name"><span>Rakt-</span><span class="brand-accent">Setu</span></div>
            ${roleBadges[role] || ''}
          </div>
        </div>

        <nav class="sidebar-nav-container">
          ${navSectionsHtml}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user-card">
            <div class="sidebar-user-avatar">${avatarHtml}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name" title="${primaryDisplayName}">${primaryDisplayName}</div>
              <div class="sidebar-user-meta" title="${secondaryDisplayMeta}">${secondaryDisplayMeta}</div>
              <div class="sidebar-user-role-badge-row">${roleSubBadge}</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm w-full btn-action-logout" style="width: 100%; justify-content: flex-start; gap: 8px;">
            ${ICONS.logout}
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    `;
  },

  buildTopbarHtml(role, activeKey, pageTitle, session) {
    const roleTitles = {
      DONOR: "Donor Hub",
      HOSPITAL: "Hospital Clinical Portal",
      BLOOD_BANK: "Regional Blood Center"
    };

    return `
      <header class="topbar">
        <div class="topbar-breadcrumbs">
          <a href="dashboard.html">${roleTitles[role] || 'Portal'}</a>
          <span class="separator">/</span>
          <span class="current-page">${pageTitle || 'Overview'}</span>
        </div>

        <div class="topbar-actions" style="display: flex; align-items: center; gap: 12px;">
          <div class="topbar-status-chip" title="Live Telemetry: Node Active">
            <span class="status-dot pulse" style="background-color: #10B981;"></span>
            <span>Live Node &bull; <span id="topbar-live-clock">--:--:--</span></span>
          </div>
          ${session.role === 'SUPER_ADMIN' ? '<span class="badge badge-purple" style="font-size: 0.65rem; padding: 2px 8px; font-weight: 700;">SUPER ADMIN</span>' : ''}
          <button class="btn btn-ghost btn-icon btn-action-logout" title="Sign Out">
            ${ICONS.logout}
          </button>
        </div>
      </header>
    `;
  },

  buildMobileNavHtml(role, activeKey) {
    const groups = this.NAV_GROUPS[role] || [];
    let items = [];
    groups.forEach(g => items.push(...g.items));
    const primaryItems = items.slice(0, 4);

    const itemsHtml = primaryItems.map(item => `
      <a href="${item.href}" class="mobile-nav-item ${item.key === activeKey ? 'active' : ''}">
        <span class="mobile-nav-icon">${item.icon}</span>
        <span>${item.label.split(" ")[0]}</span>
      </a>
    `).join("");

    return `
      <nav class="mobile-bottom-nav">
        ${itemsHtml}
        <a href="profile.html" class="mobile-nav-item ${activeKey === 'profile' ? 'active' : ''}">
          <span class="mobile-nav-icon">${ICONS.user}</span>
          <span>Profile</span>
        </a>
      </nav>
    `;
  },

  showToast(title, message, type = "success", duration = 3500) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const icons = {
      success: `<span style="color: var(--success-color);">●</span>`,
      error: `<span style="color: var(--emergency-color);">●</span>`,
      warning: `<span style="color: var(--warning-color);">●</span>`,
      info: `<span style="color: var(--info-color);">●</span>`
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || '●'}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 250);
    }, duration);
  },

  showConfirmDialog(title, message, onConfirm, confirmText = "Confirm", isDanger = false) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop open";
    backdrop.innerHTML = `
      <div class="modal-content" style="max-width: 440px;">
        <div class="modal-header">
          <div class="card-title">${title}</div>
          <button class="btn btn-ghost btn-sm" id="btn-dialog-close">✕</button>
        </div>
        <div class="modal-body">
          <p class="text-sm" style="color: var(--text-secondary); line-height: 1.6; white-space: pre-line;">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" id="btn-dialog-cancel">Cancel</button>
          <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'} btn-sm" id="btn-dialog-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const cleanup = () => backdrop.remove();

    backdrop.querySelector("#btn-dialog-close").onclick = cleanup;
    backdrop.querySelector("#btn-dialog-cancel").onclick = cleanup;
    backdrop.querySelector("#btn-dialog-confirm").onclick = () => {
      cleanup();
      if (typeof onConfirm === "function") onConfirm();
    };
  },

  getEmptyStateHtml(icon, title, subtitle, ctaText = "", ctaActionAttr = "") {
    return `
      <div class="state-container animate-fade-in">
        <div class="empty-state-icon">${icon}</div>
        <div class="state-title">${title}</div>
        <div class="state-subtitle">${subtitle}</div>
        ${ctaText ? `<button class="btn btn-primary btn-sm" ${ctaActionAttr}>${ctaText}</button>` : ''}
      </div>
    `;
  },

  /**
   * Universal Print Dispatcher bridge to PrintEngine
   */
  print(docType, data, meta) {
    if (typeof PrintEngine === "undefined") {
      console.warn("[UIComponents] PrintEngine not loaded yet, triggering native print");
      window.print();
      return;
    }
    switch (docType) {
      case "requisition":
        PrintEngine.printRequisitionSlip(data, meta);
        break;
      case "appointment":
        PrintEngine.printAppointmentSlip(data, meta);
        break;
      case "certificate":
        PrintEngine.printDonationCertificate(data, meta);
        break;
      case "transfer":
        PrintEngine.printTransferReceipt(data, meta);
        break;
      case "dispatch":
        PrintEngine.printDispatchGatePass(data, meta);
        break;
      case "inventory":
        PrintEngine.printInventoryReport(data, meta);
        break;
      default:
        if (typeof data === "string") {
          PrintEngine.printHtml(data, meta || "Rakt-Setu Document");
        } else {
          window.print();
        }
    }
  }
};
