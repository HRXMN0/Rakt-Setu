/**
 * Rakt-Setu Deterministic Blood Compatibility Matching Engine
 * Implements clinical RBC and Whole Blood transfusion compatibility matrices.
 */

const COMPATIBILITY_RULES = {
    'O-': {
        canGiveTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
        canReceiveFrom: ['O-']
    },
    'O+': {
        canGiveTo: ['O+', 'A+', 'B+', 'AB+'],
        canReceiveFrom: ['O-', 'O+']
    },
    'A-': {
        canGiveTo: ['A-', 'A+', 'AB-', 'AB+'],
        canReceiveFrom: ['O-', 'A-']
    },
    'A+': {
        canGiveTo: ['A+', 'AB+'],
        canReceiveFrom: ['O-', 'O+', 'A-', 'A+']
    },
    'B-': {
        canGiveTo: ['B-', 'B+', 'AB-', 'AB+'],
        canReceiveFrom: ['O-', 'B-']
    },
    'B+': {
        canGiveTo: ['B+', 'AB+'],
        canReceiveFrom: ['O-', 'O+', 'B-', 'B+']
    },
    'AB-': {
        canGiveTo: ['AB-', 'AB+'],
        canReceiveFrom: ['O-', 'A-', 'B-', 'AB-']
    },
    'AB+': {
        canGiveTo: ['AB+'],
        canReceiveFrom: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
    }
};

/**
 * Returns list of compatible donor blood groups for a given recipient
 */
const getCompatibleDonorGroups = (recipientBloodGroup) => {
    const rule = COMPATIBILITY_RULES[recipientBloodGroup];
    return rule ? rule.canReceiveFrom : [recipientBloodGroup];
};

/**
 * Ranks and scores candidate units for optimal emergency dispatch
 */
const rankCompatibleUnits = (candidateUnits, requestedBloodGroup) => {
    const now = new Date();

    return candidateUnits
        .filter(unit => {
            // Must be available and unexpired
            const isAvailable = unit.status === 'available';
            const isUnexpired = new Date(unit.expiryDate) > now;
            return isAvailable && isUnexpired;
        })
        .map(unit => {
            const isExactMatch = unit.bloodType === requestedBloodGroup;
            const distance = unit.distanceKm || 3.0;
            const daysToExpiry = Math.max(0, (new Date(unit.expiryDate) - now) / (1000 * 60 * 60 * 24));

            // Scoring formula: Exact match preferred (100 pts), lower distance (up to 50 pts), reasonable expiry
            let score = 0;
            if (isExactMatch) score += 100;
            else score += 50;

            score += Math.max(0, 50 - distance * 5); // closer distance higher score
            score += Math.min(20, daysToExpiry); // not immediate expiry

            return {
                ...unit.toObject ? unit.toObject() : unit,
                isExactMatch,
                matchScore: Math.round(score),
                compatibilityTier: isExactMatch ? 'Exact Match' : 'Compatible Universal/Alternate'
            };
        })
        .sort((a, b) => b.matchScore - a.matchScore);
};

module.exports = {
    COMPATIBILITY_RULES,
    getCompatibleDonorGroups,
    rankCompatibleUnits
};

