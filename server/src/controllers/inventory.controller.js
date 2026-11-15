const mongoose = require('mongoose');
const BloodUnit = require('../models/BloodUnit');
const Request = require('../models/Request');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Get all blood units with filtering, search, and summary metrics
 */
const getAllUnits = async (req, res, next) => {
    try {
        const { bloodType, status, search, facilityName, limit = 50, page = 1 } = req.query;

        const filter = {};
        if (bloodType) filter.bloodType = bloodType;
        if (status) filter.status = status;
        if (facilityName) filter.facilityName = new RegExp(facilityName, 'i');

        if (search) {
            filter.$or = [
                { unitId: new RegExp(search, 'i') },
                { donorName: new RegExp(search, 'i') },
                { facilityName: new RegExp(search, 'i') }
            ];
        }

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const units = await BloodUnit.find(filter)
            .sort({ expiryDate: 1 })
            .skip(skip)
            .limit(parseInt(limit, 10));

        const total = await BloodUnit.countDocuments(filter);

        // Aggregate counts by status
        const countsAgg = await BloodUnit.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const counts = {
            total: await BloodUnit.countDocuments(),
            available: 0,
            reserved: 0,
            used: 0,
            expired: 0
        };
        countsAgg.forEach(c => {
            if (counts[c._id] !== undefined) counts[c._id] = c.count;
        });

        // 8-Blood group summary of available units
        const groupAgg = await BloodUnit.aggregate([
            { $match: { status: 'available' } },
            { $group: { _id: '$bloodType', count: { $sum: 1 } } }
        ]);
        const stockByGroup = {
            'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0,
            'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0
        };
        groupAgg.forEach(g => {
            if (stockByGroup[g._id] !== undefined) stockByGroup[g._id] = g.count;
        });

        return successResponse(res, 200, 'Inventory retrieved', {
            units,
            summary: {
                counts,
                stockByGroup
            },
            pagination: {
                total,
                page: parseInt(page, 10),
                pages: Math.ceil(total / parseInt(limit, 10))
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Add a new blood unit to inventory
 */
const addUnit = async (req, res, next) => {
    try {
        const { unitId, bloodType, componentType, collectionDate, expiryDate, donorName, facilityName, distanceKm } = req.body;

        if (!bloodType) {
            return errorResponse(res, 400, 'Blood type is required.');
        }

        // Auto-generate unit ID if not given
        const finalUnitId = unitId || `RK-${Math.floor(1000 + Math.random() * 9000)}`;

        // Check duplicate
        const existing = await BloodUnit.findOne({ unitId: finalUnitId });
        if (existing) {
            return errorResponse(res, 409, `A blood unit with ID '${finalUnitId}' already exists.`);
        }

        const colDate = collectionDate ? new Date(collectionDate) : new Date();

        // Calculate default shelf life if expiry not provided
        let expDate = expiryDate ? new Date(expiryDate) : null;
        if (!expDate) {
            const comp = componentType || 'Whole Blood';
            let shelfLifeDays = 35; // Whole Blood default
            if (comp.includes('Platelet')) shelfLifeDays = 5;
            else if (comp.includes('RBC') || comp.includes('Red Blood')) shelfLifeDays = 42;
            else if (comp.includes('Plasma')) shelfLifeDays = 365;

            expDate = new Date(colDate.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000);
        }

        const newUnit = await BloodUnit.create({
            unitId: finalUnitId,
            bloodType,
            componentType: componentType || 'Whole Blood',
            collectionDate: colDate,
            expiryDate: expDate,
            status: 'available',
            donorName: donorName || 'Voluntary Walk-in Donor',
            facilityName: facilityName || (req.user.bloodBankName || 'Patiala Central Blood Centre'),
            distanceKm: distanceKm || 2.4
        });

        return successResponse(res, 201, 'Blood unit added successfully', { unit: newUnit });
    } catch (err) {
        next(err);
    }
};

/**
 * Update an existing blood unit
 */
const updateUnit = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, componentType, expiryDate } = req.body;

        const unit = await BloodUnit.findById(id);
        if (!unit) {
            return errorResponse(res, 404, 'Blood unit not found.');
        }

        if (status) unit.status = status;
        if (componentType) unit.componentType = componentType;
        if (expiryDate) unit.expiryDate = new Date(expiryDate);

        await unit.save();

        return successResponse(res, 200, 'Blood unit updated', { unit });
    } catch (err) {
        next(err);
    }
};

/**
 * Delete a blood unit
 */
const deleteUnit = async (req, res, next) => {
    try {
        const { id } = req.params;
        const unit = await BloodUnit.findByIdAndDelete(id);
        if (!unit) {
            return errorResponse(res, 404, 'Blood unit not found.');
        }

        return successResponse(res, 200, 'Blood unit deleted successfully', { unitId: unit.unitId });
    } catch (err) {
        next(err);
    }
};

/**
 * Atomic reservation of a blood unit (prevents double booking)
 */
const reserveUnit = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { requestId } = req.body;

        let targetRequestId = null;
        if (requestId) {
            const isReqObjectId = mongoose.Types.ObjectId.isValid(requestId);
            const bloodReq = isReqObjectId
                ? await Request.findById(requestId)
                : await Request.findOne({ requestId });

            if (!bloodReq) {
                return errorResponse(res, 404, 'Referenced blood request not found.');
            }
            if (['Fulfilled', 'Cancelled', 'Rejected'].includes(bloodReq.status)) {
                return errorResponse(res, 400, `Cannot reserve blood units for request in '${bloodReq.status}' status.`);
            }
            targetRequestId = bloodReq._id;
        }

        const isObjectId = mongoose.Types.ObjectId.isValid(id);
        const filter = isObjectId
            ? { _id: id, status: 'available' }
            : { unitId: id, status: 'available' };

        // Atomic update: only updates if current status is strictly 'available'
        const unit = await BloodUnit.findOneAndUpdate(
            filter,
            {
                $set: {
                    status: 'reserved',
                    reservedBy: req.user._id,
                    reservedForRequest: targetRequestId
                }
            },
            { new: true }
        );

        if (!unit) {
            return errorResponse(
                res,
                409,
                'Unit could not be reserved. It may have already been reserved, used, or expired.'
            );
        }

        return successResponse(res, 200, 'Blood unit reserved successfully', { unit });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllUnits,
    addUnit,
    updateUnit,
    deleteUnit,
    reserveUnit
};

