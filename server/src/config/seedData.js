const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const BloodUnit = require('../models/BloodUnit');
const Request = require('../models/Request');
const Donation = require('../models/Donation');
const Appointment = require('../models/Appointment');

const seedInitialData = async () => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
        console.warn('[Seed]: Automatic or unauthorized seeding in PRODUCTION is strictly prohibited.');
        return;
    }

    try {
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('[Seed]: Database already contains user accounts. Skipping auto-seed.');
            return;
        }

        console.log('[Seed]: Populating initial Rakt-Setu evaluation dataset...');

        // 1. Create Hospitals & Blood Banks
        const rajindra = await Hospital.create({
            facilityId: 'hosp_01',
            name: 'Government Rajindra Hospital, Patiala',
            type: 'Hospital',
            city: 'Patiala',
            area: 'Sangrur Road & New Lal Bagh',
            location: 'Patiala Healthcare Hub',
            region: 'Central',
            distanceKm: 1.8,
            verified: true,
            license: 'PB-NABH-2024-8841',
            emergencyPhone: '+91 175 221 9999',
            inventoryHealth: 'Healthy',
            inventory: {
                'A+': { wholeBlood: 14, prbc: 22, platelets: 8, plasma: 12, total: 56, status: 'Adequate' },
                'A-': { wholeBlood: 4, prbc: 6, platelets: 2, plasma: 4, total: 16, status: 'Low Stock' },
                'B+': { wholeBlood: 18, prbc: 28, platelets: 10, plasma: 16, total: 72, status: 'Adequate' },
                'B-': { wholeBlood: 3, prbc: 5, platelets: 2, plasma: 3, total: 13, status: 'Moderate' },
                'AB+': { wholeBlood: 8, prbc: 12, platelets: 5, plasma: 9, total: 34, status: 'Adequate' },
                'AB-': { wholeBlood: 2, prbc: 3, platelets: 1, plasma: 2, total: 8, status: 'Critical' },
                'O+': { wholeBlood: 25, prbc: 38, platelets: 14, plasma: 22, total: 99, status: 'Adequate' },
                'O-': { wholeBlood: 5, prbc: 8, platelets: 3, plasma: 5, total: 21, status: 'Moderate' }
            }
        });

        const amar = await Hospital.create({
            facilityId: 'hosp_02',
            name: 'Amar Hospital, Patiala',
            type: 'Hospital',
            city: 'Patiala',
            area: 'Bank Colony, Patiala',
            location: 'Patiala South',
            region: 'South',
            distanceKm: 3.4,
            verified: true,
            license: 'PB-NABH-2023-4102',
            emergencyPhone: '+91 175 235 4444',
            inventoryHealth: 'Healthy'
        });

        const centralBloodCentre = await Hospital.create({
            facilityId: 'bb_01',
            name: 'Patiala Central Blood Centre',
            type: 'Blood Bank',
            city: 'Patiala',
            area: 'Urban Estate, Phase 2',
            location: 'Central Depot Zone',
            region: 'Central',
            distanceKm: 2.1,
            verified: true,
            license: 'FDA-PB-BB-4491',
            emergencyPhone: '+91 175 221 1100',
            inventoryHealth: 'Healthy',
            inventory: {
                'A+': { wholeBlood: 24, prbc: 32, platelets: 8, plasma: 8, total: 72, status: 'Adequate' },
                'A-': { wholeBlood: 8, prbc: 10, platelets: 3, plasma: 3, total: 24, status: 'Low Stock' },
                'B+': { wholeBlood: 35, prbc: 48, platelets: 15, plasma: 12, total: 110, status: 'Adequate' },
                'B-': { wholeBlood: 9, prbc: 12, platelets: 4, plasma: 3, total: 28, status: 'Moderate' },
                'AB+': { wholeBlood: 15, prbc: 18, platelets: 6, plasma: 6, total: 45, status: 'Adequate' },
                'AB-': { wholeBlood: 4, prbc: 6, platelets: 2, plasma: 2, total: 14, status: 'Critical' },
                'O+': { wholeBlood: 55, prbc: 75, platelets: 25, plasma: 20, total: 175, status: 'Adequate' },
                'O-': { wholeBlood: 14, prbc: 18, platelets: 6, plasma: 6, total: 44, status: 'Moderate' }
            }
        });

        // 2. Pre-seed Evaluation Test Users with bcrypt passwords
        // Password for all test accounts is 'Password@123'
        const rawPassword = 'Password@123';

        const superAdmin = await User.create({
            name: 'Dr. Vikram Sethi',
            email: 'superadmin@raktsetu.org',
            password: rawPassword,
            role: 'SUPER_ADMIN',
            phone: '+91 98765 00001',
            hospitalName: 'State Health Directorate, Punjab',
            city: 'Patiala',
            verified: true
        });

        const adminUser = await User.create({
            name: 'Gurpreet Singh',
            email: 'admin@raktsetu.org',
            password: rawPassword,
            role: 'ADMIN',
            phone: '+91 175 221 1100',
            bloodBankName: centralBloodCentre.name,
            bloodBankId: centralBloodCentre._id,
            city: 'Patiala',
            licenseNumber: 'FDA-PB-BB-4491',
            verified: true
        });

        const staffUser = await User.create({
            name: 'Dr. Manpreet Kaur',
            email: 'staff@cityhospital.org',
            password: rawPassword,
            role: 'HOSPITAL_STAFF',
            phone: '+91 175 221 9000',
            hospitalName: rajindra.name,
            hospitalId: rajindra._id,
            city: 'Patiala',
            licenseNumber: 'PB-NABH-2024-8841',
            verified: true
        });

        // Additional alias accounts for seamless evaluation
        await User.create({
            name: 'Dr. Manpreet Kaur (Eval 1)',
            email: 'hospital@raktsetu.org',
            password: rawPassword,
            role: 'HOSPITAL_STAFF',
            phone: '+91 175 221 9000',
            hospitalName: rajindra.name,
            hospitalId: rajindra._id,
            city: 'Patiala',
            licenseNumber: 'PB-NABH-2024-8841',
            verified: true
        });

        await User.create({
            name: 'Gurpreet Singh (Eval 1)',
            email: 'bloodbank@raktsetu.org',
            password: rawPassword,
            role: 'ADMIN',
            phone: '+91 175 221 1100',
            bloodBankName: centralBloodCentre.name,
            bloodBankId: centralBloodCentre._id,
            city: 'Patiala',
            licenseNumber: 'FDA-PB-BB-4491',
            verified: true
        });

        const demoDonor = await User.create({
            name: 'Aarav Sharma',
            email: 'donor@raktsetu.org',
            password: rawPassword,
            role: 'DONOR',
            bloodGroup: 'O+',
            phone: '+91 98765 43210',
            city: 'Patiala',
            area: 'Urban Estate, Phase 2',
            weight: '74 kg',
            verified: true
        });

        // 3. Pre-seed Demo Donor's History and Appointment
        await Donation.create([
            {
                donorId: demoDonor._id,
                donorName: demoDonor.name,
                bloodGroup: demoDonor.bloodGroup,
                date: '2026-06-15',
                facility: 'Government Rajindra Hospital, Patiala',
                facilityId: rajindra._id,
                donationType: 'Whole Blood',
                units: 1,
                testStatus: 'Screened & Approved',
                recipientImpact: 'Trauma Emergency Unit',
                certificateId: 'CERT-2026-0615-88'
            },
            {
                donorId: demoDonor._id,
                donorName: demoDonor.name,
                bloodGroup: demoDonor.bloodGroup,
                date: '2026-03-02',
                facility: 'Patiala Central Blood Centre',
                facilityId: centralBloodCentre._id,
                donationType: 'Packed RBCs',
                units: 1,
                testStatus: 'Screened & Approved',
                recipientImpact: 'Pediatric Surgery',
                certificateId: 'CERT-2026-0302-44'
            },
            {
                donorId: demoDonor._id,
                donorName: demoDonor.name,
                bloodGroup: demoDonor.bloodGroup,
                date: '2025-11-10',
                facility: 'Patiala Central Blood Centre',
                facilityId: centralBloodCentre._id,
                donationType: 'Whole Blood',
                units: 1,
                testStatus: 'Screened & Approved',
                recipientImpact: 'Cardiology Ward',
                certificateId: 'CERT-2025-1110-12'
            }
        ]);

        await Appointment.create({
            donorId: demoDonor._id,
            donorName: demoDonor.name,
            facilityName: centralBloodCentre.name,
            facilityId: centralBloodCentre._id,
            facilityType: 'Blood Bank',
            address: 'Urban Estate, Phase 2, Patiala',
            date: '2026-11-15',
            time: '10:30 AM',
            donationType: 'Whole Blood',
            status: 'Confirmed',
            donorSlipCode: 'RS-APT-9821'
        });

        // 4. Pre-seed Blood Units in Inventory
        const now = new Date();
        const futureDate = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const pastDate = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const sampleUnits = [
            { unitId: 'RK-9001', bloodType: 'O-', componentType: 'Packed RBCs', status: 'available', expiryDays: 35 },
            { unitId: 'RK-9002', bloodType: 'O-', componentType: 'Whole Blood', status: 'available', expiryDays: 28 },
            { unitId: 'RK-9003', bloodType: 'O+', componentType: 'Packed RBCs', status: 'available', expiryDays: 40 },
            { unitId: 'RK-9004', bloodType: 'O+', componentType: 'Whole Blood', status: 'available', expiryDays: 25 },
            { unitId: 'RK-9005', bloodType: 'A+', componentType: 'Packed RBCs', status: 'available', expiryDays: 30 },
            { unitId: 'RK-9006', bloodType: 'A-', componentType: 'Packed RBCs', status: 'available', expiryDays: 21 },
            { unitId: 'RK-9007', bloodType: 'B+', componentType: 'Whole Blood', status: 'available', expiryDays: 32 },
            { unitId: 'RK-9008', bloodType: 'B-', componentType: 'Packed RBCs', status: 'available', expiryDays: 19 },
            { unitId: 'RK-9009', bloodType: 'AB+', componentType: 'Whole Blood', status: 'available', expiryDays: 38 },
            { unitId: 'RK-9010', bloodType: 'AB-', componentType: 'Packed RBCs', status: 'available', expiryDays: 14 },
            { unitId: 'RK-9011', bloodType: 'O+', componentType: 'Platelets', status: 'available', expiryDays: 5 },
            { unitId: 'RK-9012', bloodType: 'B+', componentType: 'Plasma', status: 'available', expiryDays: 180 },
            { unitId: 'RK-9013', bloodType: 'O-', componentType: 'Packed RBCs', status: 'reserved', expiryDays: 20 },
            { unitId: 'RK-9014', bloodType: 'A+', componentType: 'Whole Blood', status: 'used', expiryDays: -5 }
        ];

        for (const u of sampleUnits) {
            await BloodUnit.create({
                unitId: u.unitId,
                bloodType: u.bloodType,
                componentType: u.componentType,
                collectionDate: pastDate(5),
                expiryDate: futureDate(u.expiryDays),
                status: u.status,
                facilityName: centralBloodCentre.name,
                hospitalId: centralBloodCentre._id,
                distanceKm: 2.1
            });
        }

        // 5. Pre-seed Emergency Requests
        await Request.create([
            {
                requestId: 'REQ-ER-9482',
                bloodGroup: 'O-',
                component: 'Packed RBCs',
                unitsRequired: 4,
                urgency: 'CRITICAL (STAT)',
                patientCaseId: 'CAS-ER-9482',
                department: 'Trauma ICU / OT-2',
                hospitalId: rajindra._id,
                hospitalName: rajindra.name,
                targetBloodBank: centralBloodCentre.name,
                targetFacilityId: centralBloodCentre._id,
                status: 'Dispatched',
                courier: 'RapidCare Transit #04 (ETA: 14 mins)',
                requestedBy: staffUser._id,
                timeline: [
                    { stage: 'Request Created', timestamp: pastDate(0.1), note: 'Critical trauma STAT' },
                    { stage: 'Approved by Blood Bank', timestamp: pastDate(0.08), note: '4 units allocated' },
                    { stage: 'Dispatched', timestamp: pastDate(0.03), note: 'In transit via RapidCare #04' }
                ]
            },
            {
                requestId: 'REQ-ER-9483',
                bloodGroup: 'AB-',
                component: 'Platelets',
                unitsRequired: 2,
                urgency: 'HIGH',
                patientCaseId: 'CAS-HEM-3312',
                department: 'Hematology & Oncology',
                hospitalId: amar._id,
                hospitalName: amar.name,
                targetBloodBank: centralBloodCentre.name,
                targetFacilityId: centralBloodCentre._id,
                status: 'Pending',
                requestedBy: staffUser._id,
                timeline: [
                    { stage: 'Request Created', timestamp: pastDate(0.05), note: 'Awaiting blood bank review' }
                ]
            }
        ]);

        console.log('[Seed Complete]: All demo accounts, facilities, inventory units, and history initialized successfully.');
    } catch (err) {
        console.error('[Seed Error]:', err.message);
    }
};

// Standalone execution handler for explicit CLI setup: npm run seed
if (require.main === module) {
    const { connectDB, disconnectDB } = require('./db');
    (async () => {
        try {
            console.log('[Setup]: Initiating explicit database setup and seeding...');
            await connectDB();
            await seedInitialData();

            // Run role-isolation sanitization migration
            console.log('[Setup]: Running role isolation sanitization migration...');
            await User.updateMany({ role: 'DONOR' }, { $set: { hospitalName: null, hospitalId: null, bloodBankName: null, bloodBankId: null } });
            await User.updateMany({ role: 'HOSPITAL_STAFF' }, { $set: { bloodBankName: null, bloodBankId: null } });
            await User.updateMany({ role: 'ADMIN' }, { $set: { hospitalName: null, hospitalId: null } });
            await User.updateMany({ role: 'SUPER_ADMIN' }, { $set: { hospitalId: null, bloodBankId: null } });
            console.log('[Setup]: Role isolation migration complete.');

            await disconnectDB();
            console.log('[Setup]: Database setup completed successfully.');
            process.exit(0);
        } catch (setupErr) {
            console.error('[Setup Fatal Error]:', setupErr.message);
            process.exit(1);
        }
    })();
}

module.exports = seedInitialData;

