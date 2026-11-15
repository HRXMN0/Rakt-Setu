const BloodUnit = require('../src/models/BloodUnit');
const User = require('../src/models/User');
const Donation = require('../src/models/Donation');
const Appointment = require('../src/models/Appointment');

const runMongoTests = async () => {
    const results = [];

    const record = (num, name, passed, details = '') => {
        results.push({ num, category: 'MONGODB IMPLEMENTATION', name, passed, details });
        console.log(`  ${passed ? '✓' : '✗'} [Test ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
    };

    console.log('\n--- Running MongoDB Implementation Tests (16 - 22) ---');

    let createdUnit = null;

    // 16. Create a record
    try {
        const uniqueUnitId = `RK-TEST-${Date.now().toString().slice(-4)}`;
        createdUnit = await BloodUnit.create({
            unitId: uniqueUnitId,
            bloodType: 'A+',
            componentType: 'Packed RBCs',
            collectionDate: new Date(),
            expiryDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
            status: 'available',
            facilityName: 'Patiala Central Blood Centre'
        });
        const passed = !!createdUnit && createdUnit.unitId === uniqueUnitId;
        record(16, 'Create a record (BloodUnit schema)', passed, `Unit ID: ${createdUnit.unitId}`);
    } catch (e) {
        record(16, 'Create a record', false, e.message);
    }

    // 17. Retrieve a record
    try {
        const found = await BloodUnit.findById(createdUnit._id);
        const passed = found && found.unitId === createdUnit.unitId;
        record(17, 'Retrieve a record by ID', passed);
    } catch (e) {
        record(17, 'Retrieve a record', false, e.message);
    }

    // 18. Update a record
    try {
        createdUnit.status = 'reserved';
        await createdUnit.save();
        const updated = await BloodUnit.findById(createdUnit._id);
        const passed = updated.status === 'reserved';
        record(18, 'Update a record', passed, `Updated status: ${updated.status}`);
    } catch (e) {
        record(18, 'Update a record', false, e.message);
    }

    // 19. Delete an authorized record
    try {
        await BloodUnit.findByIdAndDelete(createdUnit._id);
        const checkDeleted = await BloodUnit.findById(createdUnit._id);
        const passed = checkDeleted === null;
        record(19, 'Delete an authorized record', passed);
    } catch (e) {
        record(19, 'Delete an authorized record', false, e.message);
    }

    // 20. Verify database persistence
    try {
        const adminUser = await User.findOne({ email: 'admin@raktsetu.org' });
        const passed = adminUser && adminUser.role === 'ADMIN';
        record(20, 'Verify database document persistence', passed, `User: ${adminUser ? adminUser.email : 'none'}`);
    } catch (e) {
        record(20, 'Verify database persistence', false, e.message);
    }

    // 21. Verify correct user references
    try {
        const donorUser = await User.findOne({ email: 'donor@raktsetu.org' });
        const donation = await Donation.findOne({ donorId: donorUser._id });
        const passed = donation && donation.donorId.toString() === donorUser._id.toString();
        record(21, 'Verify correct user references in relational models', passed, `Certificate: ${donation ? donation.certificateId : 'none'}`);
    } catch (e) {
        record(21, 'Verify correct user references', false, e.message);
    }

    // 22. Verify new donors start with zero donations
    try {
        const brandNewDonor = await User.create({
            name: 'Fresh Voluntary Donor',
            email: `fresh_donor_${Date.now()}@test.org`,
            password: 'Password@123',
            role: 'DONOR'
        });

        const brandNewDonations = await Donation.find({ donorId: brandNewDonor._id });
        const brandNewAppointments = await Appointment.find({ donorId: brandNewDonor._id });

        const passed = brandNewDonations.length === 0 && brandNewAppointments.length === 0;
        record(22, 'Verify new donors start with zero donations and empty history', passed, `Donations count: ${brandNewDonations.length}`);
    } catch (e) {
        record(22, 'Verify new donors start with zero donations', false, e.message);
    }

    return results;
};

module.exports = runMongoTests;
