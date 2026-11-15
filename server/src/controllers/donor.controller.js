const User = require('../models/User');
const Donation = require('../models/Donation');
const Appointment = require('../models/Appointment');
const Document = require('../models/Document');
const { executeWithTransaction } = require('../utils/transactionHelper');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Get current donor's profile with aggregate history and appointments
 */
const getMyProfile = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return errorResponse(res, 404, 'Donor account not found.');
        }

        // Fetch donations strictly belonging to this user
        const donations = await Donation.find({ donorId: userId }).sort({ date: -1 });

        // Fetch appointments strictly belonging to this user
        const appointments = await Appointment.find({ donorId: userId }).sort({ date: 1 });

        // Fetch uploaded documents
        const documents = await Document.find({ userId }).select('-filePath');

        const totalDonations = donations.length;
        const livesSaved = totalDonations * 3;

        return successResponse(res, 200, 'Donor profile retrieved', {
            donor: {
                ...user.toObject(),
                totalDonations,
                livesSaved,
                badge: totalDonations >= 10 ? 'Champion Donor' : totalDonations >= 5 ? 'Silver Donor' : totalDonations > 0 ? 'Bronze Donor' : 'New Donor',
                donations,
                appointments,
                documents
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get donor profile by ID (with ownership check: Donor can only view own; Admins can view any)
 */
const getDonorById = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Role/Ownership check
        if (req.user.role === 'DONOR' && req.user._id.toString() !== id) {
            return errorResponse(res, 403, 'Forbidden: You cannot access another donor\'s private profile.');
        }

        const user = await User.findById(id).select('-password');
        if (!user) {
            return errorResponse(res, 404, 'Donor not found.');
        }

        const donations = await Donation.find({ donorId: id }).sort({ date: -1 });
        const appointments = await Appointment.find({ donorId: id }).sort({ date: 1 });

        return successResponse(res, 200, 'Donor retrieved', {
            donor: {
                ...user.toObject(),
                totalDonations: donations.length,
                livesSaved: donations.length * 3,
                donations,
                appointments
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Update donor profile (with strict role preservation)
 */
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { name, phone, bloodGroup, city, area, weight } = req.body;

        // Prevent modification of role or email via this endpoint
        if (req.body.role && req.body.role !== req.user.role) {
            return errorResponse(res, 403, 'Forbidden: Modifying your assigned role is strictly prohibited.');
        }

        const user = await User.findById(userId);
        if (!user) {
            return errorResponse(res, 404, 'User not found.');
        }

        if (name) user.name = name.trim();
        if (phone) user.phone = phone.trim();
        if (bloodGroup) user.bloodGroup = bloodGroup;
        if (city) user.city = city.trim();
        if (area) user.area = area.trim();
        if (weight) user.weight = weight;

        await user.save();

        const userObj = user.toObject();
        delete userObj.password;

        return successResponse(res, 200, 'Profile updated successfully', { user: userObj });
    } catch (err) {
        next(err);
    }
};

/**
 * Get donation history for authenticated donor
 */
const getDonationHistory = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const donations = await Donation.find({ donorId: userId }).sort({ date: -1 });
        const appointments = await Appointment.find({ donorId: userId }).sort({ date: -1, createdAt: -1 });

        return successResponse(res, 200, 'Donation history retrieved', {
            donations,
            appointments,
            totalCount: donations.length
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get all appointments for the authenticated donor
 */
const getMyAppointments = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const appointments = await Appointment.find({ donorId: userId }).sort({ date: -1, createdAt: -1 });
        return successResponse(res, 200, 'Appointments retrieved successfully', { appointments });
    } catch (err) {
        next(err);
    }
};

/**
 * Get donation history for specific donor (Authorized roles only)
 */
const getDonationsByDonorId = async (req, res, next) => {
    try {
        const { donorId } = req.params;

        // Ownership check
        if (req.user.role === 'DONOR' && req.user._id.toString() !== donorId) {
            return errorResponse(res, 403, 'Forbidden: You cannot access another donor\'s donation history.');
        }

        const donations = await Donation.find({ donorId }).sort({ date: -1 });
        return successResponse(res, 200, 'Donations retrieved', { donations });
    } catch (err) {
        next(err);
    }
};

/**
 * Book an appointment
 */
const bookAppointment = async (req, res, next) => {
    try {
        const { facilityName, facilityId, facilityType, address, date, time, preferredDate, timeSlot, donationType, donorSlipCode, slipCode } = req.body;
        const apptDate = date || preferredDate;
        const apptTime = time || timeSlot;

        if (!facilityName || !apptDate || !apptTime) {
            return errorResponse(res, 400, 'Facility name, date, and time slot are required.');
        }

        const randomCode = Math.floor(1000 + Math.random() * 9000);
        const code = donorSlipCode || slipCode || `RS-APT-${randomCode}`;

        const appointment = await Appointment.create({
            donorId: req.user._id,
            donorName: req.user.name,
            facilityName,
            facilityId: facilityId || null,
            facilityType: facilityType || 'Blood Bank',
            address: address || 'Patiala Healthcare Zone',
            date: apptDate,
            time: apptTime,
            donationType: donationType || 'Whole Blood',
            status: 'Confirmed',
            donorSlipCode: code
        });

        return successResponse(res, 201, 'Appointment booked successfully', { appointment });
    } catch (err) {
        next(err);
    }
};

/**
 * Cancel an appointment with strict ownership check
 */
const cancelAppointment = async (req, res, next) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return errorResponse(res, 404, 'Appointment not found.');
        }

        // Ownership check: Only the donor who created the appointment (or an admin) can cancel it
        if (req.user.role === 'DONOR' && appointment.donorId.toString() !== req.user._id.toString()) {
            return errorResponse(res, 403, 'Forbidden: You cannot cancel an appointment that belongs to another donor.');
        }

        appointment.status = 'Cancelled';
        await appointment.save();

        return successResponse(res, 200, 'Appointment cancelled successfully', { appointment });
    } catch (err) {
        next(err);
    }
};

/**
 * Mark appointment as Completed and record verified Donation (Staff / Admin only)
 */
const completeAppointment = async (req, res, next) => {
    try {
        const { appointmentId } = req.params;
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return errorResponse(res, 404, 'Appointment not found.');
        }

        if (appointment.status === 'Completed') {
            return errorResponse(res, 400, 'This appointment has already been marked as Completed.');
        }

        let donation;
        await executeWithTransaction(async (session) => {
            appointment.status = 'Completed';
            await appointment.save({ session });

            const existingDonation = await Donation.findOne({
                donorId: appointment.donorId,
                date: appointment.date,
                facility: appointment.facilityName
            }).session(session);

            donation = existingDonation;
            if (!existingDonation) {
                const certCode = `CERT-${appointment.date.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
                const created = await Donation.create([{
                    donorId: appointment.donorId,
                    donorName: appointment.donorName,
                    bloodGroup: req.body.bloodGroup || 'O+',
                    date: appointment.date,
                    facility: appointment.facilityName,
                    facilityId: appointment.facilityId || null,
                    donationType: appointment.donationType || 'Whole Blood',
                    units: 1,
                    testStatus: 'Screened & Approved',
                    recipientImpact: 'Emergency Care & Surgical Support',
                    certificateId: certCode
                }], { session });
                donation = created[0];
            }
        }, { operationName: 'appointment completion and donation recording' });

        return successResponse(res, 200, 'Appointment marked as completed and donation recorded', {
            appointment,
            donation
        });
    } catch (err) {
        next(err);
    }
};

/**
 * List all registered donors (Admin / Hospital staff only)
 */
const getAllDonors = async (req, res, next) => {
    try {
        const { bloodGroup, city } = req.query;
        const filter = { role: 'DONOR' };

        if (bloodGroup) filter.bloodGroup = bloodGroup;
        if (city) filter.city = new RegExp(city, 'i');

        const donors = await User.find(filter).select('-password').sort({ createdAt: -1 });

        return successResponse(res, 200, 'Donors directory retrieved', { donors });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getMyProfile,
    getDonorById,
    updateProfile,
    getDonationHistory,
    getMyAppointments,
    getDonationsByDonorId,
    bookAppointment,
    cancelAppointment,
    completeAppointment,
    getAllDonors
};

