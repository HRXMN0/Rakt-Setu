const Request = require('../models/Request');
const BloodUnit = require('../models/BloodUnit');
const { getCompatibleDonorGroups, rankCompatibleUnits } = require('../services/matching.service');
const { executeWithTransaction } = require('../utils/transactionHelper');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Create a new blood requisition (Emergency or Routine)
 */
const createRequest = async (req, res, next) => {
    try {
        const { bloodGroup, component, unitsRequired, unitsRequested, units, urgency, patientCaseId, department, targetBloodBank } = req.body;
        const requestedUnits = unitsRequired || unitsRequested || units;

        if (!bloodGroup || !requestedUnits) {
            return errorResponse(res, 400, 'Blood group and units required are mandatory.');
        }

        const requestId = `REQ-${Date.now().toString().slice(-4)}`;
        const hospitalName = req.user.hospitalName || 'Government Rajindra Hospital, Patiala';

        const request = await Request.create({
            requestId,
            bloodGroup,
            component: component || 'Packed RBCs',
            unitsRequired: parseInt(requestedUnits, 10),
            urgency: urgency || 'ROUTINE',
            patientCaseId: patientCaseId || `CAS-${Math.floor(1000 + Math.random() * 9000)}`,
            department: department || 'Emergency Trauma',
            hospitalId: req.user.hospitalId || null,
            hospitalName,
            targetBloodBank: targetBloodBank || 'Patiala Central Blood Centre',
            status: 'Pending',
            requestedBy: req.user._id,
            courier: 'Awaiting Dispatch',
            timeline: [
                {
                    stage: 'Request Broadcasted',
                    timestamp: new Date(),
                    note: `Emergency request for ${requestedUnits} units of ${bloodGroup} created.`
                }
            ]
        });

        return successResponse(res, 201, 'Blood request broadcasted successfully', { request });
    } catch (err) {
        next(err);
    }
};

/**
 * Get all requests (with hospital isolation for hospital staff)
 */
const getAllRequests = async (req, res, next) => {
    try {
        const { status, urgency } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (urgency) filter.urgency = urgency;

        // Enforce hospital isolation: Hospital staff only view their own hospital's requests
        if (req.user.role === 'HOSPITAL_STAFF') {
            if (req.user.hospitalId) {
                filter.hospitalId = req.user.hospitalId;
            } else if (req.user.hospitalName) {
                filter.hospitalName = req.user.hospitalName;
            }
        }

        const requests = await Request.find(filter).sort({ createdAt: -1 });
        return successResponse(res, 200, 'Requests retrieved', { requests });
    } catch (err) {
        next(err);
    }
};

/**
 * Get request by ID
 */
const getRequestById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const request = await Request.findById(id);

        if (!request) {
            return errorResponse(res, 404, 'Blood request not found.');
        }

        // Hospital isolation check
        if (req.user.role === 'HOSPITAL_STAFF') {
            const matchesId = req.user.hospitalId && request.hospitalId && request.hospitalId.toString() === req.user.hospitalId.toString();
            const matchesName = request.hospitalName === req.user.hospitalName;
            if (!matchesId && !matchesName) {
                return errorResponse(res, 403, 'Forbidden: You cannot access requests from another hospital.');
            }
        }

        return successResponse(res, 200, 'Request retrieved', { request });
    } catch (err) {
        next(err);
    }
};

/**
 * Match a blood request against available inventory
 */
const matchRequest = async (req, res, next) => {
    try {
        const { id } = req.params;
        const request = await Request.findById(id);

        if (!request) {
            return errorResponse(res, 404, 'Blood request not found.');
        }

        // Get compatible blood types based on recipient
        const compatibleDonorTypes = getCompatibleDonorGroups(request.bloodGroup);

        // Fetch candidate available units
        const candidateUnits = await BloodUnit.find({
            bloodType: { $in: compatibleDonorTypes },
            status: 'available',
            expiryDate: { $gt: new Date() }
        });

        // Run ranking engine
        const rankedUnits = rankCompatibleUnits(candidateUnits, request.bloodGroup);

        return successResponse(res, 200, 'Compatibility matching completed', {
            request,
            recipientBloodGroup: request.bloodGroup,
            compatibleBloodGroups: compatibleDonorTypes,
            totalAvailableMatched: rankedUnits.length,
            units: rankedUnits
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Update request status (Approve, Dispatch, Fulfill, Reject, Cancel)
 */
const updateRequestStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, note, courier } = req.body;

        const request = await Request.findById(id);
        if (!request) {
            return errorResponse(res, 404, 'Blood request not found.');
        }

        // Facility-Level Authorization: Hospital staff may only manage requests belonging to their hospital
        if (req.user.role === 'HOSPITAL_STAFF') {
            const matchesId = req.user.hospitalId && request.hospitalId && request.hospitalId.toString() === req.user.hospitalId.toString();
            const matchesName = request.hospitalName === req.user.hospitalName;
            if (!matchesId && !matchesName) {
                return errorResponse(res, 403, 'Forbidden: You cannot modify blood requests from another hospital.');
            }
            if (status === 'Dispatched') {
                return errorResponse(res, 403, 'Forbidden: Hospital staff cannot dispatch blood requests. Only blood bank administrators can dispatch units.');
            }
        }

        const currentStatus = request.status;

        // Lifecycle & State Machine Integrity:
        if (currentStatus === 'Fulfilled') {
            return errorResponse(res, 400, 'Cannot modify a request that has already been fulfilled. Fulfilled requests cannot be dispatched or cancelled again.');
        }
        if (currentStatus === 'Cancelled') {
            return errorResponse(res, 400, 'Cannot modify a request that has already been cancelled.');
        }
        if (currentStatus === 'Rejected') {
            return errorResponse(res, 400, 'Cannot modify a request that has already been rejected.');
        }

        // Prevent cancelling a request that was already dispatched
        if (currentStatus === 'Dispatched' && status === 'Cancelled') {
            return errorResponse(res, 400, 'Cannot cancel a blood request that has already been dispatched.');
        }

        const isMultiDocMutation = (status === 'Cancelled' || status === 'Dispatched' || status === 'Fulfilled');

        if (isMultiDocMutation) {
            await executeWithTransaction(async (session) => {
                // Cancellation releases ONLY units that are genuinely reserved
                if (status === 'Cancelled') {
                    await BloodUnit.updateMany(
                        { reservedForRequest: request._id, status: 'reserved' },
                        { $set: { status: 'available', reservedForRequest: null, reservedBy: null } },
                        { session }
                    );
                } else if (status === 'Dispatched' || status === 'Fulfilled') {
                    await BloodUnit.updateMany(
                        { reservedForRequest: request._id, status: 'reserved' },
                        { $set: { status: 'used' } },
                        { session }
                    );
                }

                if (status) request.status = status;
                if (courier) request.courier = courier;

                if (note || status) {
                    request.timeline.push({
                        stage: status || 'Status Updated',
                        timestamp: new Date(),
                        note: note || `Status transitioned to ${status}`
                    });
                }

                await request.save({ session });
            }, { operationName: `request ${status ? status.toLowerCase() : 'status update'}` });
        } else {
            // Single-document atomic mutation on Request only (e.g. Approved, timeline notes)
            if (status) request.status = status;
            if (courier) request.courier = courier;

            if (note || status) {
                request.timeline.push({
                    stage: status || 'Status Updated',
                    timestamp: new Date(),
                    note: note || `Status transitioned to ${status}`
                });
            }

            await request.save();
        }

        return successResponse(res, 200, 'Request status updated', { request });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createRequest,
    getAllRequests,
    getRequestById,
    matchRequest,
    updateRequestStatus
};

