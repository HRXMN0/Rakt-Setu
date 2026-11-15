const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
    facilityId: {
        type: String,
        required: [true, 'Facility ID is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Facility name is required'],
        trim: true
    },
    type: {
        type: String,
        enum: ['Hospital', 'Blood Bank'],
        required: true,
        default: 'Hospital'
    },
    city: {
        type: String,
        default: 'Patiala'
    },
    area: {
        type: String,
        default: 'Urban Estate'
    },
    location: {
        type: String,
        default: 'Patiala Healthcare District'
    },
    region: {
        type: String,
        enum: ['North', 'South', 'East', 'West', 'Central'],
        default: 'Central'
    },
    distanceKm: {
        type: Number,
        default: 2.5
    },
    verified: {
        type: Boolean,
        default: true
    },
    license: {
        type: String,
        trim: true,
        default: 'PB-NABH-2024-8841'
    },
    emergencyPhone: {
        type: String,
        trim: true,
        default: '+91 175 221 9999'
    },
    inventoryHealth: {
        type: String,
        enum: ['Healthy', 'Warning', 'Shortage'],
        default: 'Healthy'
    },
    inventory: {
        type: Map,
        of: new mongoose.Schema({
            wholeBlood: { type: Number, default: 0 },
            prbc: { type: Number, default: 0 },
            platelets: { type: Number, default: 0 },
            plasma: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
            status: { type: String, default: 'Adequate' }
        }, { _id: false }),
        default: {}
    }
}, {
    timestamps: true
});

hospitalSchema.index({ type: 1, city: 1 });

module.exports = mongoose.model('Hospital', hospitalSchema);

