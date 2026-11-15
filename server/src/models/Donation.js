const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    donorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    donorName: {
        type: String,
        required: true
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        required: true
    },
    date: {
        type: String,
        required: true
    },
    facility: {
        type: String,
        required: true
    },
    facilityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        default: null
    },
    donationType: {
        type: String,
        default: 'Whole Blood'
    },
    units: {
        type: Number,
        default: 1
    },
    testStatus: {
        type: String,
        default: 'Screened & Approved'
    },
    recipientImpact: {
        type: String,
        default: 'Emergency Care Unit'
    },
    certificateId: {
        type: String,
        unique: true,
        required: true
    }
}, {
    timestamps: true
});

donationSchema.index({ donorId: 1, date: -1 });

module.exports = mongoose.model('Donation', donationSchema);

