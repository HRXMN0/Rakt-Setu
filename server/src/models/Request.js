const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    requestId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        required: [true, 'Blood group is required']
    },
    component: {
        type: String,
        default: 'Whole Blood'
    },
    unitsRequired: {
        type: Number,
        required: [true, 'Units required is required'],
        min: [1, 'Must request at least 1 unit']
    },
    urgency: {
        type: String,
        enum: ['ROUTINE', 'HIGH', 'CRITICAL (STAT)', 'Normal', 'Urgent', 'Critical', 'STAT Emergency', 'STAT', 'Emergency'],
        default: 'ROUTINE'
    },
    patientCaseId: {
        type: String,
        trim: true,
        default: 'CAS-ER-1001'
    },
    department: {
        type: String,
        trim: true,
        default: 'Emergency Trauma'
    },
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        default: null
    },
    hospitalName: {
        type: String,
        required: true
    },
    targetBloodBank: {
        type: String,
        default: 'Patiala Central Blood Centre'
    },
    targetFacilityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        default: null
    },
    status: {
        type: String,
        enum: ['Pending', 'Pending Allocation', 'Approved', 'Dispatched', 'Fulfilled', 'Rejected', 'Cancelled'],
        default: 'Pending'
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    courier: {
        type: String,
        default: 'Awaiting Dispatch'
    },
    timeline: [{
        stage: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: '' }
    }]
}, {
    timestamps: true
});

requestSchema.index({ hospitalId: 1, status: 1 });
requestSchema.index({ urgency: 1, status: 1 });

module.exports = mongoose.model('Request', requestSchema);

