/**
 * RAKT-SETU DEMO & OPERATIONAL DATA ENGINE
 * Centralized, interconnected healthcare dataset for Donors, Hospitals, and Blood Banks.
 * Contains pre-hashed credentials (SHA-256 of "password123").
 */

const DEMO_PASSWORD_HASH = "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f"; // SHA-256 of "password123"

const INITIAL_DATA = {
  // Pre-configured Accounts for immediate demo access
  users: [
    {
      id: "usr_donor_01",
      email: "donor@raktsetu.org",
      passwordHash: DEMO_PASSWORD_HASH,
      role: "DONOR",
      name: "Aarav Sharma",
      phone: "+91 98765 43210",
      city: "Patiala",
      bloodGroup: "O+",
      lastDonation: "2026-06-15",
      nextEligibleDate: "2026-09-15",
      totalDonations: 7,
      livesSaved: 21,
      createdAt: "2024-01-15"
    },
    {
      id: "usr_hosp_01",
      email: "hospital@raktsetu.org",
      passwordHash: DEMO_PASSWORD_HASH,
      role: "HOSPITAL",
      name: "Dr. Manpreet Kaur",
      hospitalId: "hosp_01",
      hospitalName: "Government Rajindra Hospital, Patiala",
      licenseNumber: "PB-NABH-2024-8841",
      phone: "+91 175 221 9000",
      city: "Patiala",
      emergencyContact: "+91 175 221 9999",
      createdAt: "2023-11-20"
    },
    {
      id: "usr_bb_01",
      email: "bloodbank@raktsetu.org",
      passwordHash: DEMO_PASSWORD_HASH,
      role: "BLOOD_BANK",
      name: "Gurpreet Singh",
      bloodBankId: "bb_01",
      bloodBankName: "Patiala Central Blood Centre",
      licenseNumber: "FDA-PB-BB-4491",
      phone: "+91 175 221 1100",
      city: "Patiala",
      storageCapacity: "2,500 Units",
      createdAt: "2023-08-10"
    }
  ],

  // Registered Donors Directory
  donors: [
    {
      id: "dnr_01",
      userId: "usr_donor_01",
      name: "Aarav Sharma",
      email: "donor@raktsetu.org",
      phone: "+91 98765 43210",
      bloodGroup: "O+",
      age: 29,
      gender: "Male",
      city: "Patiala",
      area: "Urban Estate, Phase 2",
      eligibilityStatus: "Eligible Soon",
      daysUntilEligible: 21,
      lastDonationDate: "2026-06-15",
      nextEligibleDate: "2026-09-15",
      totalDonations: 7,
      livesSaved: 21,
      badge: "Silver Donor",
      healthVitals: {
        weight: "74 kg",
        hemoglobin: "14.8 g/dL",
        bloodPressure: "120/80 mmHg",
        pulse: "72 bpm"
      },
      appointments: [
        {
          id: "apt_2026_01",
          facilityName: "Patiala Central Blood Centre",
          facilityType: "Blood Bank",
          address: "Urban Estate, Phase 2, Patiala",
          date: "2026-09-18",
          time: "10:30 AM",
          donationType: "Whole Blood",
          status: "Confirmed",
          donorSlipCode: "RS-APT-9821"
        }
      ],
      donationHistory: [
        {
          id: "hist_01",
          date: "2026-06-15",
          facility: "Government Rajindra Hospital, Patiala",
          donationType: "Whole Blood",
          units: 1,
          testStatus: "Screened & Approved",
          recipientImpact: "Trauma Emergency Unit",
          certificateId: "CERT-2026-0615-88"
        },
        {
          id: "hist_02",
          date: "2026-03-02",
          facility: "Patiala Central Blood Centre",
          donationType: "Packed RBCs",
          units: 1,
          testStatus: "Screened & Approved",
          recipientImpact: "Pediatric Surgery",
          certificateId: "CERT-2026-0302-44"
        },
        {
          id: "hist_03",
          date: "2025-11-10",
          facility: "Patiala Blood Bank",
          donationType: "Whole Blood",
          units: 1,
          testStatus: "Screened & Approved",
          recipientImpact: "Cardiology Ward",
          certificateId: "CERT-2025-1110-12"
        },
        {
          id: "hist_04",
          date: "2025-07-22",
          facility: "Amar Hospital, Patiala",
          donationType: "Platelets (Apheresis)",
          units: 2,
          testStatus: "Screened & Approved",
          recipientImpact: "Oncology Daycare",
          certificateId: "CERT-2025-0722-09"
        }
      ]
    },
    {
      id: "dnr_02",
      name: "Harpreet Kaur",
      email: "harpreet.k@example.com",
      phone: "+91 98721 11223",
      bloodGroup: "A+",
      age: 26,
      gender: "Female",
      city: "Patiala",
      area: "Model Town",
      eligibilityStatus: "Eligible Now",
      daysUntilEligible: 0,
      lastDonationDate: "2026-04-10",
      nextEligibleDate: "2026-08-10",
      totalDonations: 4,
      livesSaved: 12,
      badge: "Bronze Donor"
    },
    {
      id: "dnr_03",
      name: "Rohan Verma",
      email: "rohan.v@example.com",
      phone: "+91 98144 33211",
      bloodGroup: "B+",
      age: 34,
      gender: "Male",
      city: "Patiala",
      area: "Rajpura Road",
      eligibilityStatus: "Eligible Now",
      daysUntilEligible: 0,
      lastDonationDate: "2026-05-01",
      nextEligibleDate: "2026-08-01",
      totalDonations: 9,
      livesSaved: 27,
      badge: "Gold Donor"
    },
    {
      id: "dnr_04",
      name: "Simranjeet Kaur",
      email: "simran.k@example.com",
      phone: "+91 99887 66554",
      bloodGroup: "O-",
      age: 31,
      gender: "Female",
      city: "Patiala",
      area: "Lehal Colony",
      eligibilityStatus: "Eligible Now",
      daysUntilEligible: 0,
      lastDonationDate: "2026-04-20",
      nextEligibleDate: "2026-08-20",
      totalDonations: 12,
      livesSaved: 36,
      badge: "Champion Donor (Universal)"
    },
    {
      id: "dnr_05",
      name: "Jaspreet Singh",
      email: "jaspreet.s@example.com",
      phone: "+91 98150 56780",
      bloodGroup: "AB+",
      age: 28,
      gender: "Male",
      city: "Patiala",
      area: "Tripuri",
      eligibilityStatus: "Eligible Now",
      daysUntilEligible: 0,
      lastDonationDate: "2026-05-18",
      nextEligibleDate: "2026-08-18",
      totalDonations: 5,
      livesSaved: 15,
      badge: "Bronze Donor"
    }
  ],

  // Hospital Facilities & Internal Inventories
  hospitals: [
    {
      id: "hosp_01",
      name: "Government Rajindra Hospital, Patiala",
      city: "Patiala",
      area: "Sangrur Road & New Lal Bagh",
      type: "Tertiary Care & Level-1 Trauma",
      verified: true,
      license: "PB-NABH-2024-8841",
      beds: 650,
      icuBeds: 120,
      emergencyPhone: "+91 175 221 9999",
      inventory: {
        "A+": { wholeBlood: 14, prbc: 22, platelets: 8, plasma: 12 },
        "A-": { wholeBlood: 4, prbc: 6, platelets: 2, plasma: 4 },
        "B+": { wholeBlood: 18, prbc: 28, platelets: 10, plasma: 16 },
        "B-": { wholeBlood: 3, prbc: 5, platelets: 2, plasma: 3 },
        "AB+": { wholeBlood: 8, prbc: 12, platelets: 5, plasma: 9 },
        "AB-": { wholeBlood: 2, prbc: 3, platelets: 1, plasma: 2 },
        "O+": { wholeBlood: 25, prbc: 38, platelets: 14, plasma: 22 },
        "O-": { wholeBlood: 5, prbc: 8, platelets: 3, plasma: 5 }
      },
      minThresholds: {
        "A+": 10, "A-": 4, "B+": 12, "B-": 4,
        "AB+": 6, "AB-": 3, "O+": 15, "O-": 6
      },
      emergencyRequests: [
        {
          id: "emg_req_101",
          bloodGroup: "O-",
          component: "Packed RBCs",
          unitsRequired: 4,
          urgency: "CRITICAL (STAT)",
          patientCaseId: "CAS-ER-9482",
          department: "Trauma ICU / OT-2",
          targetBloodBank: "Patiala Central Blood Centre",
          status: "Dispatched",
          courier: "RapidCare Transit #04 (ETA: 14 mins)",
          requestedAt: "2026-08-25 20:45",
          estimatedArrival: "2026-08-25 21:30"
        },
        {
          id: "emg_req_102",
          bloodGroup: "AB-",
          component: "Platelets (Apheresis)",
          unitsRequired: 2,
          urgency: "HIGH",
          patientCaseId: "CAS-HEM-3312",
          department: "Hematology & Oncology",
          targetBloodBank: "Patiala Blood Bank",
          status: "Pending Allocation",
          courier: "Awaiting Dispatch",
          requestedAt: "2026-08-25 21:10",
          estimatedArrival: "2026-08-25 22:45"
        }
      ],
      transfers: [
        {
          id: "trf_01",
          direction: "OUTBOUND",
          partnerHospital: "Amar Hospital, Patiala",
          bloodGroup: "B+",
          component: "Whole Blood",
          units: 4,
          transferDate: "2026-08-24 14:30",
          status: "Completed",
          authorizedBy: "Dr. Manpreet Kaur"
        },
        {
          id: "trf_02",
          direction: "INBOUND",
          partnerHospital: "Columbia Asia Hospital Patiala",
          bloodGroup: "O+",
          component: "Packed RBCs",
          units: 6,
          transferDate: "2026-08-22 09:15",
          status: "Completed",
          authorizedBy: "Dr. H. S. Bhasin"
        }
      ]
    },
    {
      id: "hosp_02",
      name: "Amar Hospital, Patiala",
      city: "Patiala",
      area: "Bank Colony, Patiala",
      type: "Multi-Specialty Hospital",
      verified: true,
      license: "PB-NABH-2023-4102",
      beds: 420,
      emergencyPhone: "+91 175 235 4444",
      inventory: {
        "A+": { wholeBlood: 10, prbc: 15, platelets: 6, plasma: 8 },
        "A-": { wholeBlood: 2, prbc: 4, platelets: 1, plasma: 2 },
        "B+": { wholeBlood: 14, prbc: 20, platelets: 7, plasma: 10 },
        "B-": { wholeBlood: 2, prbc: 3, platelets: 1, plasma: 2 },
        "AB+": { wholeBlood: 5, prbc: 8, platelets: 3, plasma: 5 },
        "AB-": { wholeBlood: 1, prbc: 2, platelets: 1, plasma: 1 },
        "O+": { wholeBlood: 18, prbc: 25, platelets: 9, plasma: 14 },
        "O-": { wholeBlood: 3, prbc: 5, platelets: 2, plasma: 3 }
      }
    },
    {
      id: "hosp_03",
      name: "Columbia Asia Hospital Patiala",
      city: "Patiala",
      area: "Bhupindra Road, Near 22 No. Phatak",
      type: "Premier Healthcare & Cardiac Center",
      verified: true,
      license: "PB-NABH-2022-7719",
      beds: 350,
      emergencyPhone: "+91 175 398 1000",
      inventory: {
        "A+": { wholeBlood: 12, prbc: 18, platelets: 5, plasma: 10 },
        "A-": { wholeBlood: 3, prbc: 5, platelets: 2, plasma: 3 },
        "B+": { wholeBlood: 15, prbc: 22, platelets: 8, plasma: 12 },
        "B-": { wholeBlood: 2, prbc: 4, platelets: 1, plasma: 2 },
        "AB+": { wholeBlood: 6, prbc: 10, platelets: 4, plasma: 6 },
        "AB-": { wholeBlood: 1, prbc: 2, platelets: 1, plasma: 2 },
        "O+": { wholeBlood: 20, prbc: 30, platelets: 11, plasma: 16 },
        "O-": { wholeBlood: 4, prbc: 6, platelets: 2, plasma: 4 }
      }
    }
  ],

  // Regional Blood Banks & Central Depots
  bloodBanks: [
    {
      id: "bb_01",
      name: "Patiala Central Blood Centre",
      city: "Patiala",
      area: "Urban Estate, Phase 2",
      verified: true,
      license: "FDA-PB-BB-4491",
      phone: "+91 175 221 1100",
      operatingHours: "24x7 Emergency Services",
      coldStorageTemp: "3.8 °C (Normal Range 2-6 °C)",
      storageCapacity: "2,500 Units",
      totalAvailableUnits: 512,
      reservedUnits: 48,
      inventory: {
        "A+": { total: 72, wholeBlood: 24, prbc: 32, platelets: 8, plasma: 8, status: "Adequate" },
        "A-": { total: 24, wholeBlood: 8, prbc: 10, platelets: 3, plasma: 3, status: "Low Stock" },
        "B+": { total: 110, wholeBlood: 35, prbc: 48, platelets: 15, plasma: 12, status: "Adequate" },
        "B-": { total: 28, wholeBlood: 9, prbc: 12, platelets: 4, plasma: 3, status: "Moderate" },
        "AB+": { total: 45, wholeBlood: 15, prbc: 18, platelets: 6, plasma: 6, status: "Adequate" },
        "AB-": { total: 14, wholeBlood: 4, prbc: 6, platelets: 2, plasma: 2, status: "Critical" },
        "O+": { total: 175, wholeBlood: 55, prbc: 75, platelets: 25, plasma: 20, status: "Adequate" },
        "O-": { total: 44, wholeBlood: 14, prbc: 18, platelets: 6, plasma: 6, status: "Moderate" }
      },
      pendingRequests: [
        {
          id: "req_bb_881",
          hospitalId: "hosp_01",
          hospitalName: "Government Rajindra Hospital, Patiala",
          bloodGroup: "O-",
          component: "Packed RBCs",
          units: 4,
          urgency: "CRITICAL (STAT)",
          caseId: "CAS-ER-9482",
          requestedAt: "2026-08-25 20:45",
          status: "Dispatched",
          courierId: "RC-04",
          driverPhone: "+91 98721 88411"
        },
        {
          id: "req_bb_882",
          hospitalId: "hosp_02",
          hospitalName: "Amar Hospital, Patiala",
          bloodGroup: "A+",
          component: "Fresh Frozen Plasma",
          units: 6,
          urgency: "HIGH",
          caseId: "CAS-SUR-1092",
          requestedAt: "2026-08-25 21:15",
          status: "Pending Allocation"
        },
        {
          id: "req_bb_883",
          hospitalId: "hosp_03",
          hospitalName: "Columbia Asia Hospital Patiala",
          bloodGroup: "B+",
          component: "Whole Blood",
          units: 8,
          urgency: "ROUTINE",
          caseId: "CAS-GEN-7731",
          requestedAt: "2026-08-25 18:30",
          status: "Approved"
        }
      ]
    },
    {
      id: "bb_02",
      name: "Patiala Blood Bank",
      city: "Patiala",
      area: "Rajindra Hospital Campus, Patiala",
      verified: true,
      license: "FDA-PB-BB-1094",
      phone: "+91 175 222 3399",
      operatingHours: "24x7 Service",
      coldStorageTemp: "4.1 °C",
      storageCapacity: "1,800 Units",
      totalAvailableUnits: 340,
      reservedUnits: 25,
      inventory: {
        "A+": { total: 48, wholeBlood: 16, prbc: 22, platelets: 5, plasma: 5, status: "Adequate" },
        "A-": { total: 16, wholeBlood: 5, prbc: 7, platelets: 2, plasma: 2, status: "Moderate" },
        "B+": { total: 85, wholeBlood: 28, prbc: 38, platelets: 10, plasma: 9, status: "Adequate" },
        "B-": { total: 18, wholeBlood: 6, prbc: 8, platelets: 2, plasma: 2, status: "Low Stock" },
        "AB+": { total: 32, wholeBlood: 10, prbc: 14, platelets: 4, plasma: 4, status: "Adequate" },
        "AB-": { total: 9, wholeBlood: 3, prbc: 4, platelets: 1, plasma: 1, status: "Critical" },
        "O+": { total: 110, wholeBlood: 35, prbc: 48, platelets: 15, plasma: 12, status: "Adequate" },
        "O-": { total: 22, wholeBlood: 7, prbc: 10, platelets: 3, plasma: 2, status: "Low Stock" }
      }
    }
  ],

  // Blood Compatibility Rules
  compatibility: {
    "O-": { canGiveTo: ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"], canReceiveFrom: ["O-"] },
    "O+": { canGiveTo: ["O+", "A+", "B+", "AB+"], canReceiveFrom: ["O-", "O+"] },
    "A-": { canGiveTo: ["A-", "A+", "AB-", "AB+"], canReceiveFrom: ["O-", "A-"] },
    "A+": { canGiveTo: ["A+", "AB+"], canReceiveFrom: ["O-", "O+", "A-", "A+"] },
    "B-": { canGiveTo: ["B-", "B+", "AB-", "AB+"], canReceiveFrom: ["O-", "B-"] },
    "B+": { canGiveTo: ["B+", "AB+"], canReceiveFrom: ["O-", "O+", "B-", "B+"] },
    "AB-": { canGiveTo: ["AB-", "AB+"], canReceiveFrom: ["O-", "A-", "B-", "AB-"] },
    "AB+": { canGiveTo: ["AB+"], canReceiveFrom: ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"] }
  }
};
