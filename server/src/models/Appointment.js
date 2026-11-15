const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    donorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    donorName: {
        type: String,
        required: true
    },
    facilityName: {
        type: String,
        required: true
    },
    facilityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        default: null
    },
    facilityType: {
        type: String,
        default: 'Blood Bank'
    },
    address: {
        type: String,
        default: 'Patiala Central Healthcare Zone'
    },
    date: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    donationType: {
        type: String,
        default: 'Whole Blood'
    },
    status: {
        type: String,
        enum: ['Confirmed', 'Cancelled', 'Completed'],
        default: 'Confirmed'
    },
    donorSlipCode: {
        type: String,
        unique: true,
        required: true
    }
}, {
    timestamps: true
});

appointmentSchema.index({ donorId: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);

