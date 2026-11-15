/**
 * RAKT-SETU APPOINTMENT BOOKING TO DONATION HISTORY END-TO-END TEST SUITE
 * Tests the complete flow:
 * 1. New donor registers and starts with 0 completed donations.
 * 2. New donor schedules an appointment.
 * 3. Appointment and digital pass code (RS-APT-XXXX) are persisted in MongoDB against donor's ObjectId.
 * 4. Appointment appears under My Appointments (GET /api/donors/appointments).
 * 5. Appointment appears under Scheduled Appointments in Donation History (GET /api/donors/history).
 * 6. Appointment does NOT falsely count as a completed donation.
 * 7. Refreshing preserves appointment and pass code.
 * 8. Logging out and re-logging in preserves appointment and pass code.
 * 9. Appointment cancellation updates status cleanly with ownership enforcement.
 * 10. Donor A cannot cancel or access Donor B's appointments.
 * 11. Facility staff completes appointment -> verified Donation record is created and completed count increases by 1.
 * 12. Duplicate completions do not create duplicate donation records.
 */

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Appointment = require('../src/models/Appointment');
const Donation = require('../src/models/Donation');

const runAppointmentBookingTests = async () => {
    const results = [];
    const record = (num, name, passed, details = '') => {
        results.push({ num, name, passed, details });
        console.log(`  ${passed ? '✓' : '✗'} [Booking Test ${num}] ${name} ${details ? '(' + details + ')' : ''}`);
    };

    console.log('\n--- Running Complete Appointment Booking & Donation History Flow Tests ---');

    let donorToken = null;
    let donorUser = null;
    let bookedAppointment = null;
    let staffToken = null;

    // 1. Staff Login for later completion tests
    try {
        const staffRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'staff@cityhospital.org', password: 'Password@123', expectedRole: 'HOSPITAL_STAFF' });
        staffToken = staffRes.body?.data?.token;
    } catch (e) {
        console.warn('Staff login helper failed:', e.message);
    }

    // 1. New donor registers and starts with 0 completed donations
    try {
        const uniqueEmail = `test_donor_pass_${Date.now()}@test.org`;
        const regRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Jaspreet Singh',
                email: uniqueEmail,
                password: 'Password@123',
                confirmPassword: 'Password@123',
                role: 'DONOR',
                bloodGroup: 'B+',
                city: 'Patiala'
            });

        donorToken = regRes.body?.data?.token;
        donorUser = regRes.body?.data?.user;

        // Verify initial history is 0
        const histRes = await request(app)
            .get('/api/donors/history')
            .set('Authorization', `Bearer ${donorToken}`);

        const passed = regRes.status === 201 &&
            histRes.status === 200 &&
            histRes.body?.data?.totalCount === 0 &&
            histRes.body?.data?.donations?.length === 0;

        record(1, 'New donor registers with 0 completed donations and clean state', passed,
            `Donor: ${donorUser?.name}, Initial Completed Count: ${histRes.body?.data?.totalCount}`);
    } catch (e) {
        record(1, 'New donor registration and initial history check', false, e.message);
    }

    // 2. New donor schedules an appointment
    try {
        const passCode = `RS-APT-${Math.floor(1000 + Math.random() * 9000)}`;
        const bookRes = await request(app)
            .post('/api/donors/appointments')
            .set('Authorization', `Bearer ${donorToken}`)
            .send({
                facilityName: 'Government Rajindra Hospital, Patiala',
                facilityType: 'Hospital',
                address: 'Sangrur Road, Patiala',
                date: '2026-12-01',
                time: '11:00 AM - 12:00 PM',
                donationType: 'Whole Blood',
                donorSlipCode: passCode
            });

        bookedAppointment = bookRes.body?.data?.appointment;

        const passed = bookRes.status === 201 &&
            bookedAppointment &&
            bookedAppointment.donorSlipCode === passCode &&
            bookedAppointment.donorId === donorUser._id &&
            bookedAppointment.status === 'Confirmed';

        record(2, 'Appointment successfully booked with unique pass code and linked to donor ObjectId', passed,
            `Pass Code: ${bookedAppointment?.donorSlipCode}, Status: ${bookedAppointment?.status}`);
    } catch (e) {
        record(2, 'Appointment booking and pass generation', false, e.message);
    }

    // 3. Appointment is actually persisted in MongoDB database
    try {
        const docInDb = await Appointment.findById(bookedAppointment?._id);
        const passed = docInDb &&
            docInDb.donorSlipCode === bookedAppointment.donorSlipCode &&
            docInDb.donorId.toString() === donorUser._id.toString() &&
            docInDb.facilityName === 'Government Rajindra Hospital, Patiala';

        record(3, 'Appointment is verified as persisted in MongoDB with correct fields and donor association', passed,
            `DB ID: ${docInDb?._id}, DonorId: ${docInDb?.donorId}`);
    } catch (e) {
        record(3, 'MongoDB persistence verification', false, e.message);
    }

    // 4. Appointment appears under My Appointments endpoint (GET /api/donors/appointments)
    try {
        const aptRes = await request(app)
            .get('/api/donors/appointments')
            .set('Authorization', `Bearer ${donorToken}`);

        const aptList = aptRes.body?.data?.appointments || [];
        const found = aptList.find(a => a.donorSlipCode === bookedAppointment.donorSlipCode);

        const passed = aptRes.status === 200 && found && found.status === 'Confirmed';
        record(4, 'Appointment appears in My Appointments endpoint with Confirmed status and pass code', passed,
            `Found: ${Boolean(found)}, Total Donor Appointments: ${aptList.length}`);
    } catch (e) {
        record(4, 'My Appointments endpoint check', false, e.message);
    }

    // 5. Appointment appears under Scheduled Appointments in Donation History (GET /api/donors/history)
    try {
        const histRes = await request(app)
            .get('/api/donors/history')
            .set('Authorization', `Bearer ${donorToken}`);

        const aptList = histRes.body?.data?.appointments || [];
        const foundApt = aptList.find(a => a.donorSlipCode === bookedAppointment.donorSlipCode);
        const completedDonations = histRes.body?.data?.donations || [];

        const passed = histRes.status === 200 &&
            foundApt &&
            foundApt.donorSlipCode === bookedAppointment.donorSlipCode &&
            completedDonations.length === 0; // Must NOT be in completed donations!

        record(5, 'Donation History endpoint returns scheduled appointment under appointments, NOT completed donations', passed,
            `Scheduled Appointments: ${aptList.length}, Completed Donations: ${completedDonations.length}`);
    } catch (e) {
        record(5, 'Donation history appointments separation check', false, e.message);
    }

    // 6. Refreshing preserves appointment and pass code (GET /api/auth/me -> /api/donors/history)
    try {
        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${donorToken}`);

        const histRes = await request(app)
            .get('/api/donors/history')
            .set('Authorization', `Bearer ${donorToken}`);

        const aptList = histRes.body?.data?.appointments || [];
        const foundApt = aptList.find(a => a.donorSlipCode === bookedAppointment.donorSlipCode);

        const passed = meRes.status === 200 && histRes.status === 200 && foundApt && foundApt.status === 'Confirmed';
        record(6, 'Page refresh simulation preserves authenticated identity and scheduled pass', passed,
            `User: ${meRes.body?.data?.user?.email}, Pass Preserved: ${Boolean(foundApt)}`);
    } catch (e) {
        record(6, 'Page refresh simulation check', false, e.message);
    }

    // 7. Logging out and re-logging in preserves appointment and pass code
    try {
        // Logout
        await request(app).post('/api/auth/logout');

        // Re-login
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: donorUser.email, password: 'Password@123', expectedRole: 'DONOR' });

        const newToken = loginRes.body?.data?.token;

        const aptRes = await request(app)
            .get('/api/donors/appointments')
            .set('Authorization', `Bearer ${newToken}`);

        const aptList = aptRes.body?.data?.appointments || [];
        const foundApt = aptList.find(a => a.donorSlipCode === bookedAppointment.donorSlipCode);

        const passed = loginRes.status === 200 && foundApt && foundApt.donorSlipCode === bookedAppointment.donorSlipCode;
        record(7, 'Logging out and re-logging in preserves appointment and pass code cleanly', passed,
            `Re-login verified: ${Boolean(foundApt)}`);
    } catch (e) {
        record(7, 'Re-login appointment persistence check', false, e.message);
    }

    // 8. Cross-donor authorization isolation: Donor B cannot see or cancel Donor A's appointment
    try {
        const donorBRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Amanpreet Kaur',
                email: `donor_b_${Date.now()}@test.org`,
                password: 'Password@123',
                confirmPassword: 'Password@123',
                role: 'DONOR',
                bloodGroup: 'O-'
            });

        const donorBToken = donorBRes.body?.data?.token;

        // Donor B tries to get appointments -> should not see Donor A's appointment
        const bApts = await request(app)
            .get('/api/donors/appointments')
            .set('Authorization', `Bearer ${donorBToken}`);

        const foundInB = (bApts.body?.data?.appointments || []).find(a => a.donorSlipCode === bookedAppointment.donorSlipCode);

        // Donor B tries to cancel Donor A's appointment -> 403 Forbidden
        const cancelForbidden = await request(app)
            .put(`/api/donors/appointments/${bookedAppointment._id}/cancel`)
            .set('Authorization', `Bearer ${donorBToken}`);

        const passed = !foundInB && cancelForbidden.status === 403;
        record(8, 'Cross-donor isolation enforced: Donor B cannot see or cancel Donor A\'s appointment', passed,
            `Visible to B: ${Boolean(foundInB)}, Cancel attempt status: ${cancelForbidden.status}`);
    } catch (e) {
        record(8, 'Cross-donor isolation check', false, e.message);
    }

    // 9. Appointment cancellation updates status cleanly
    try {
        // Book a secondary appointment to test cancellation
        const secondPassCode = `RS-APT-${Math.floor(1000 + Math.random() * 9000)}`;
        const book2 = await request(app)
            .post('/api/donors/appointments')
            .set('Authorization', `Bearer ${donorToken}`)
            .send({
                facilityName: 'Patiala Central Blood Centre',
                facilityType: 'Blood Bank',
                date: '2026-12-05',
                time: '02:00 PM - 03:00 PM',
                donorSlipCode: secondPassCode
            });

        const apt2Id = book2.body?.data?.appointment?._id;

        const cancelRes = await request(app)
            .put(`/api/donors/appointments/${apt2Id}/cancel`)
            .set('Authorization', `Bearer ${donorToken}`);

        const aptCheck = await request(app)
            .get('/api/donors/appointments')
            .set('Authorization', `Bearer ${donorToken}`);

        const cancelledApt = (aptCheck.body?.data?.appointments || []).find(a => a._id === apt2Id);

        const passed = cancelRes.status === 200 && cancelledApt && cancelledApt.status === 'Cancelled';
        record(9, 'Appointment cancellation updates status to Cancelled without removing pass reference', passed,
            `Status: ${cancelledApt?.status}`);
    } catch (e) {
        record(9, 'Appointment cancellation check', false, e.message);
    }

    // 10. Completed donation only appears after official facility completion
    try {
        // Staff completes bookedAppointment
        const completeRes = await request(app)
            .put(`/api/donors/appointments/${bookedAppointment._id}/complete`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ bloodGroup: 'B+' });

        // Query history
        const histRes = await request(app)
            .get('/api/donors/history')
            .set('Authorization', `Bearer ${donorToken}`);

        const completedDonations = histRes.body?.data?.donations || [];
        const completedAppointment = (histRes.body?.data?.appointments || []).find(a => a._id === bookedAppointment._id);

        const passed = completeRes.status === 200 &&
            completedAppointment &&
            completedAppointment.status === 'Completed' &&
            completedDonations.length === 1 &&
            completedDonations[0].facility === 'Government Rajindra Hospital, Patiala';

        record(10, 'Appointment completion marks status Completed and records verified Donation in history', passed,
            `Appointment Status: ${completedAppointment?.status}, Total Completed Donations: ${completedDonations.length}`);
    } catch (e) {
        record(10, 'Appointment completion workflow check', false, e.message);
    }

    // 11. Duplicate completion attempts are rejected and do not create duplicate donations
    try {
        const duplicateComplete = await request(app)
            .put(`/api/donors/appointments/${bookedAppointment._id}/complete`)
            .set('Authorization', `Bearer ${staffToken}`);

        const histRes = await request(app)
            .get('/api/donors/history')
            .set('Authorization', `Bearer ${donorToken}`);

        const completedDonations = histRes.body?.data?.donations || [];

        const passed = duplicateComplete.status === 400 && completedDonations.length === 1;
        record(11, 'Duplicate completion calls are safely rejected (HTTP 400) and do not create duplicates', passed,
            `Duplicate status: ${duplicateComplete.status}, Total Donations: ${completedDonations.length}`);
    } catch (e) {
        record(11, 'Duplicate completion protection check', false, e.message);
    }

    // 12. Existing demo donor history remains intact
    try {
        const demoRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'donor@raktsetu.org', password: 'Password@123', expectedRole: 'DONOR' });

        const demoToken = demoRes.body?.data?.token;

        const demoHist = await request(app)
            .get('/api/donors/history')
            .set('Authorization', `Bearer ${demoToken}`);

        const passed = demoRes.status === 200 &&
            demoHist.status === 200 &&
            demoHist.body?.data?.donations?.length > 0;

        record(12, 'Existing seeded demo donor (Aarav Sharma) history and profile remain completely intact', passed,
            `Aarav Completed Donations: ${demoHist.body?.data?.donations?.length}`);
    } catch (e) {
        record(12, 'Existing demo donor integrity check', false, e.message);
    }

    return results;
};

if (require.main === module) {
    const { connectDB, disconnectDB } = require('../src/config/db');
    (async () => {
        try {
            await connectDB();
            const results = await runAppointmentBookingTests();
            const total = results.length;
            const passed = results.filter(r => r.passed).length;
            console.log(`\n================================================================`);
            console.log(`  📊 APPOINTMENT BOOKING TO HISTORY SUMMARY: ${passed} / ${total} PASSED`);
            console.log(`================================================================\n`);
            await disconnectDB();
            process.exit(passed === total ? 0 : 1);
        } catch (err) {
            console.error('Test execution failed:', err);
            process.exit(1);
        }
    })();
}

module.exports = runAppointmentBookingTests;

