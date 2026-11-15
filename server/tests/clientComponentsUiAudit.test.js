/**
 * CLIENT COMPONENTS & ROLE DISPLAY UNIT AUDIT TEST SUITE
 * Tests client-side components (components.js, auth.js, donor.js, hospital.js, blood-bank.js, storage.js)
 * to guarantee that UI rendering logic strictly enforces role-based identity display without leaks.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock browser globals for Node.js execution
const sessionStorageStore = {};
const localStorageStore = {};

const context = vm.createContext({
    window: {
        location: {
            port: "5000",
            href: "",
            replace: function(url) { this.href = url; }
        }
    },
    sessionStorage: {
        getItem: (k) => sessionStorageStore[k] || null,
        setItem: (k, v) => { sessionStorageStore[k] = String(v); },
        removeItem: (k) => { delete sessionStorageStore[k]; },
        clear: () => { for (let k in sessionStorageStore) delete sessionStorageStore[k]; }
    },
    localStorage: {
        getItem: (k) => localStorageStore[k] || null,
        setItem: (k, v) => { localStorageStore[k] = String(v); },
        removeItem: (k) => { delete localStorageStore[k]; },
        clear: () => { for (let k in localStorageStore) delete localStorageStore[k]; }
    },
    document: {
        getElementById: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
        body: { appendChild: () => {} }
    },
    console: console,
    Date: Date,
    JSON: JSON,
    Math: Math,
    parseInt: parseInt,
    setInterval: () => {},
    setTimeout: () => {}
});

// Load source modules into context
const loadScript = (relativePath) => {
    const fullPath = path.resolve(__dirname, '../../', relativePath);
    let code = fs.readFileSync(fullPath, 'utf8');
    // Convert top-level const/let/var declarations to context properties
    code = code.replace(/^(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=/gm, 'this.$1 =');
    vm.runInContext(code, context);
};

loadScript('js/data.js');
loadScript('js/storage.js');
loadScript('js/components.js');
loadScript('js/donor.js');
loadScript('js/hospital.js');
loadScript('js/blood-bank.js');

const runClientComponentsTests = () => {
    const results = [];
    const record = (num, name, passed, details = '') => {
        results.push({ num, name, passed, details });
        console.log(`  ${passed ? '✓' : '✗'} [Client Test ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
    };

    console.log('\n--- Running Client Components Role UI Audit Tests (6 Checks) ---');

    // 1. Donor Sidebar User Card
    try {
        const donorSession = {
            userId: "usr_donor_99",
            email: "donor@raktsetu.org",
            role: "DONOR",
            name: "Aarav Sharma",
            bloodGroup: "O+",
            facilityName: null,
            facilityId: null
        };
        const html = context.UIComponents.buildSidebarHtml("DONOR", "dashboard", donorSession);
        const hasDonorName = html.includes("Aarav Sharma");
        const hasDonorEmail = html.includes("donor@raktsetu.org");
        const hasVerifiedDonorBadge = html.includes("Verified Donor");
        const noHospitalName = !html.includes("Government Rajindra Hospital");
        const noStaffEmail = !html.includes("staff@cityhospital.org");

        const passed = hasDonorName && hasDonorEmail && hasVerifiedDonorBadge && noHospitalName && noStaffEmail;
        record(1, 'Donor sidebar user card displays donor name and email, NEVER hospital name or staff email', passed,
            `Name verified: ${hasDonorName}, Email verified: ${hasDonorEmail}, Hospital excluded: ${noHospitalName}`);
    } catch (e) {
        record(1, 'Donor sidebar user card test', false, e.message);
    }

    // 2. Hospital Sidebar User Card
    try {
        const hospSession = {
            userId: "usr_hosp_01",
            email: "staff@cityhospital.org",
            role: "HOSPITAL",
            name: "Dr. Manpreet Kaur",
            facilityName: "Government Rajindra Hospital, Patiala",
            facilityId: "hosp_01"
        };
        const html = context.UIComponents.buildSidebarHtml("HOSPITAL", "dashboard", hospSession);
        const hasHospitalName = html.includes("Government Rajindra Hospital, Patiala");
        const hasStaffMeta = html.includes("Dr. Manpreet Kaur") && html.includes("staff@cityhospital.org");
        const hasHospitalBadge = html.includes("Hospital Staff");
        const noDonorName = !html.includes("Aarav Sharma");

        const passed = hasHospitalName && hasStaffMeta && hasHospitalBadge && noDonorName;
        record(2, 'Hospital sidebar card displays hospital facility name and staff affiliation', passed,
            `Facility: ${hasHospitalName}, Staff: ${hasStaffMeta}`);
    } catch (e) {
        record(2, 'Hospital sidebar card test', false, e.message);
    }

    // 3. Blood Bank Sidebar User Card
    try {
        const bbSession = {
            userId: "usr_bb_01",
            email: "admin@raktsetu.org",
            role: "BLOOD_BANK",
            name: "Gurpreet Singh",
            facilityName: "Patiala Central Blood Centre",
            facilityId: "bb_01"
        };
        const html = context.UIComponents.buildSidebarHtml("BLOOD_BANK", "dashboard", bbSession);
        const hasDepotName = html.includes("Patiala Central Blood Centre");
        const hasAdminMeta = html.includes("Gurpreet Singh") && html.includes("admin@raktsetu.org");
        const hasDepotBadge = html.includes("Blood Bank Admin");

        const passed = hasDepotName && hasAdminMeta && hasDepotBadge;
        record(3, 'Blood Bank sidebar card displays depot name and administrator identity', passed,
            `Depot: ${hasDepotName}, Admin: ${hasAdminMeta}`);
    } catch (e) {
        record(3, 'Blood Bank sidebar card test', false, e.message);
    }

    // 4. Super Admin Sidebar User Card
    try {
        const superSession = {
            userId: "usr_super_01",
            email: "superadmin@raktsetu.org",
            role: "SUPER_ADMIN",
            name: "Dr. Vikram Sethi"
        };
        const html = context.UIComponents.buildSidebarHtml("DONOR", "dashboard", superSession);
        const hasSuperName = html.includes("Dr. Vikram Sethi");
        const hasSuperEmail = html.includes("superadmin@raktsetu.org");
        const hasSuperBadge = html.includes("SUPER ADMIN");

        const passed = hasSuperName && hasSuperEmail && hasSuperBadge;
        record(4, 'Super Admin sidebar displays administrator name and SUPER ADMIN badge', passed,
            `Admin Name: ${hasSuperName}, Super Badge: ${hasSuperBadge}`);
    } catch (e) {
        record(4, 'Super Admin sidebar card test', false, e.message);
    }

    // 5. Donor Engine never leaks seeded donor[0] to new donors
    try {
        context.Storage.clearSession();
        context.Storage.setSession({
            userId: "usr_new_donor_555",
            email: "newdonor@test.org",
            name: "Sukhwinder Kaur",
            role: "DONOR",
            bloodGroup: "B+"
        });

        const donorProfile = context.DonorEngine.getDonor();
        const isNotAarav = donorProfile.name === "Sukhwinder Kaur" && donorProfile.email === "newdonor@test.org";
        const hasCorrectBg = donorProfile.bloodGroup === "B+";

        const passed = isNotAarav && hasCorrectBg;
        record(5, 'DonorEngine creates isolated profile for new donor and NEVER falls back to seeded demo donor[0]', passed,
            `Returned: ${donorProfile.name} (${donorProfile.email})`);
    } catch (e) {
        record(5, 'DonorEngine dynamic isolation test', false, e.message);
    }

    // 6. Storage.clearSession flushes all identity keys
    try {
        context.Storage.setSession({ userId: "test_user", role: "DONOR" });
        context.localStorage.setItem("rs_active_session_token", "dummy");
        context.localStorage.setItem("rs_jwt_token", "dummy_token");

        context.Storage.clearSession();
        const sessionAfter = context.Storage.getSession();
        const localActiveAfter = context.localStorage.getItem("rs_active_session_token");
        const localJwtAfter = context.localStorage.getItem("rs_jwt_token");

        const passed = sessionAfter === null && localActiveAfter === null && localJwtAfter === null;
        record(6, 'Storage.clearSession completely purges sessionStorage and localStorage auth tokens', passed,
            `Session cleared: ${sessionAfter === null}`);
    } catch (e) {
        record(6, 'Storage.clearSession test', false, e.message);
    }

    return results;
};

if (require.main === module) {
    const results = runClientComponentsTests();
    const passed = results.filter(r => r.passed).length;
    console.log(`\n================================================================`);
    console.log(`  📊 CLIENT COMPONENTS AUDIT SUMMARY: ${passed} / ${results.length} PASSED`);
    console.log(`================================================================\n`);
    process.exit(passed === results.length ? 0 : 1);
}

module.exports = runClientComponentsTests;
