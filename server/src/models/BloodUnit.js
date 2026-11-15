const mongoose = require('mongoose');

const bloodUnitSchema = new mongoose.Schema({
    unitId: {
        type: String,
        required: [true, 'Unit ID is required'],
        unique: true,
        trim: true
    },
    bloodType: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        required: [true, 'Blood type is required']
    },
    componentType: {
        type: String,
        enum: ['Whole Blood', 'Packed RBCs', 'Red Blood Cells', 'Platelets', 'Platelets (Apheresis)', 'Plasma', 'Fresh Frozen Plasma', 'Cryoprecipitate'],
        default: 'Whole Blood'
    },
    collectionDate: {
        type: Date,
        required: [true, 'Collection date is required'],
        default: Date.now
    },
    expiryDate: {
        type: Date,
        required: [true, 'Expiry date is required']
    },
    status: {
        type: String,
        enum: ['available', 'reserved', 'used', 'expired', 'quarantine'],
        default: 'available'
    },
    donorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    donorName: {
        type: String,
        trim: true,
        default: ''
    },
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        default: null
    },
    facilityName: {
        type: String,
        default: 'Patiala Central Blood Centre'
    },
    distanceKm: {
        type: Number,
        default: 2.5
    },
    reservedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reservedForRequest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request',
        default: null
    }
}, {
    timestamps: true
});

bloodUnitSchema.index({ bloodType: 1, status: 1 });
bloodUnitSchema.index({ hospitalId: 1, status: 1 });
bloodUnitSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('BloodUnit', bloodUnitSchema);

