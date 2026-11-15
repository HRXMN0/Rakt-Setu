const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ownerRole: {
        type: String,
        enum: ['DONOR', 'HOSPITAL_STAFF', 'ADMIN', 'SUPER_ADMIN', 'HOSPITAL', 'BLOOD_BANK'],
        required: true
    },
    documentType: {
        type: String,
        enum: [
            'PROFILE_PHOTO',
            'DONOR_ID',
            'MEDICAL_CERT',
            'FACILITY_LICENSE',
            'INVENTORY_PROOF',
            'REGISTRATION_CERT',
            'NABH_CERT',
            'HOSPITAL_LICENSE',
            'BLOOD_BANK_LICENSE',
            'OTHER'
        ],
        default: 'DONOR_ID'
    },
    facilityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        default: null
    },
    originalName: {
        type: String,
        required: true,
        trim: true
    },
    filename: {
        type: String,
        required: true,
        unique: true
    },
    filePath: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

documentSchema.index({ userId: 1, documentType: 1 });

module.exports = mongoose.model('Document', documentSchema);

