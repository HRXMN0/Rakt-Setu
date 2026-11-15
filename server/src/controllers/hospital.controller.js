const mongoose = require('mongoose');
const Hospital = require('../models/Hospital');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * Get all healthcare facilities (Hospitals and Blood Banks)
 */
const getAllHospitals = async (req, res, next) => {
    try {
        const { type, city } = req.query;
        const filter = {};

        if (type) filter.type = type;
        if (city) filter.city = new RegExp(city, 'i');

        const facilities = await Hospital.find(filter).sort({ name: 1 });
        return successResponse(res, 200, 'Facilities retrieved', { facilities });
    } catch (err) {
        next(err);
    }
};

/**
 * Get facility by ID
 */
const getHospitalById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const isObjectId = mongoose.Types.ObjectId.isValid(id);
        const facility = isObjectId ? await Hospital.findById(id) : await Hospital.findOne({ facilityId: id });

        if (!facility) {
            return errorResponse(res, 404, 'Facility not found.');
        }

        return successResponse(res, 200, 'Facility details retrieved', { facility });
    } catch (err) {
        next(err);
    }
};

/**
 * Get aggregated emergency network stock
 */
const getEmergencyNetworkStock = async (req, res, next) => {
    try {
        const facilities = await Hospital.find({ verified: true });
        return successResponse(res, 200, 'Emergency network stock retrieved', { facilities });
    } catch (err) {
        next(err);
    }
};

/**
 * Update facility profile / inventory (Staff / Admin only)
 */
const updateHospital = async (req, res, next) => {
    try {
        const { id } = req.params;
        const isObjectId = mongoose.Types.ObjectId.isValid(id);
        const facility = isObjectId ? await Hospital.findById(id) : await Hospital.findOne({ facilityId: id });

        if (!facility) {
            return errorResponse(res, 404, 'Facility not found.');
        }

        // Facility-Level Authorization: Hospital staff can only modify their own facility
        if (req.user.role === 'HOSPITAL_STAFF') {
            const userHospId = req.user.hospitalId ? req.user.hospitalId.toString() : null;
            const facId = facility._id ? facility._id.toString() : null;
            const matchesId = userHospId && (userHospId === facId || userHospId === facility.facilityId);
            const matchesName = req.user.hospitalName && facility.name === req.user.hospitalName;
            if (!matchesId && !matchesName) {
                return errorResponse(res, 403, 'Forbidden: You are only authorized to manage your own hospital facility.');
            }
        }

        const { name, emergencyPhone, address, city, area, inventory, inventoryHealth } = req.body;
        if (name) facility.name = name;
        if (emergencyPhone) facility.emergencyPhone = emergencyPhone;
        if (city) facility.city = city;
        if (area) facility.area = area;
        if (address) facility.location = address;
        if (inventoryHealth) facility.inventoryHealth = inventoryHealth;

        // Inventory quantity validation (prevent negative values)
        if (inventory && typeof inventory === 'object') {
            for (const group of Object.keys(inventory)) {
                const item = inventory[group];
                if (typeof item === 'number') {
                    if (item < 0) {
                        return errorResponse(res, 400, `Inventory quantity for blood group '${group}' cannot be negative.`);
                    }
                    facility.inventory.set(group, {
                        total: item,
                        wholeBlood: item,
                        prbc: 0,
                        platelets: 0,
                        plasma: 0,
                        status: item >= 5 ? 'Adequate' : 'Low Stock'
                    });
                } else if (item && typeof item === 'object') {
                    if (item.total !== undefined && item.total < 0) {
                        return errorResponse(res, 400, `Inventory quantity for blood group '${group}' cannot be negative.`);
                    }
                    facility.inventory.set(group, item);
                }
            }
        }

        await facility.save();
        return successResponse(res, 200, 'Facility profile updated successfully', { facility });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllHospitals,
    getHospitalById,
    getEmergencyNetworkStock,
    updateHospital
};

