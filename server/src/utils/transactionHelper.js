const mongoose = require('mongoose');

class DatabaseTransactionError extends Error {
    constructor(message, operationName = 'multi-document transaction') {
        super(message);
        this.name = 'DatabaseTransactionError';
        this.statusCode = 503;
        this.operationName = operationName;
    }
}

/**
 * Checks whether the active MongoDB connection supports multi-document transactions.
 * Transactions require a replica set member or mongos topology.
 */
const isReplicaSetSupported = () => {
    try {
        const client = mongoose.connection?.client;
        if (!client) return false;
        const topologyType = client.topology?.description?.type;
        return topologyType === 'ReplicaSetWithPrimary' ||
               topologyType === 'ReplicaSetNoPrimary' ||
               topologyType === 'Sharded';
    } catch (e) {
        return false;
    }
};

/**
 * Executes a multi-document ACID operation inside a MongoDB transaction.
 * 
 * Strict safety rules:
 * 1. Multi-document operations must NEVER execute silently without a transaction.
 * 2. If transactions are required but unsupported by current database topology,
 *    an explicit DatabaseTransactionError (HTTP 503) is thrown.
 * 3. On transaction failure, all mutations inside the transaction are rolled back.
 *
 * @param {Function} operationFn - async (session) => Promise<any>
 * @param {Object} options - { operationName }
 * @returns {Promise<any>}
 */
const executeWithTransaction = async (operationFn, { operationName = 'multi-document transaction' } = {}) => {
    // Never silently execute multi-document operations without ACID transactions
    if (!isReplicaSetSupported()) {
        throw new DatabaseTransactionError(
            `Multi-document ACID transaction required for '${operationName}', but current MongoDB deployment is standalone and does not support transactions. A replica set (such as MongoDB Atlas or mongod --replSet) is required.`,
            operationName
        );
    }

    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await operationFn(session);
        });
        return result;
    } catch (txError) {
        // If underlying driver reports replica set incompatibility at runtime
        if (txError.message && (
            txError.message.includes('Transaction numbers are only allowed on a replica set member') ||
            txError.message.includes('replica set')
        )) {
            throw new DatabaseTransactionError(
                `Multi-document ACID transaction failed for '${operationName}': ${txError.message}`,
                operationName
            );
        }
        throw txError;
    } finally {
        await session.endSession();
    }
};

module.exports = {
    DatabaseTransactionError,
    isReplicaSetSupported,
    executeWithTransaction
};
