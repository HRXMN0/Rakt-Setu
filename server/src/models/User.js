const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false
    },
    role: {
        type: String,
        enum: ['SUPER_ADMIN', 'ADMIN', 'HOSPITAL_STAFF', 'DONOR'],
        default: 'DONOR'
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        default: null
    },
    phone: {
        type: String,
        trim: true,
        default: ''
    },
    city: {
        type: String,
        trim: true,
        default: 'Patiala'
    },
    area: {
        type: String,
        trim: true,
        default: ''
    },
    weight: {
        type: String,
        default: '68 kg'
    },
    profilePhoto: {
        type: String,
        default: null
    },
    hospitalName: {
        type: String,
        trim: true,
        default: null
    },
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        default: null
    },
    bloodBankName: {
        type: String,
        trim: true,
        default: null
    },
    bloodBankId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        default: null
    },
    licenseNumber: {
        type: String,
        trim: true,
        default: ''
    },
    verified: {
        type: Boolean,
        default: true
    },
    tokenVersion: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

