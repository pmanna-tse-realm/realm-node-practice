
exports.appConfig = {
    id: "<Realm Application ID>",
    timeout: 15000,
};
exports.partitionValue = "<Partition Value>";

exports.logLevel = "debug";
exports.manualClientReset = true;

exports.username = "";
exports.password = "";
exports.userAPIKey = "";
exports.customJWT = "";
exports.customUser = "";

// This is just an example of object: gather them from the Data Model tab on the Realm UI Portal
/*
exports.schemaName = "TestData";
exports.TestDataSchema = {
    name: 'TestData',
    properties: {
        _id: 'objectId',
        _partition: 'string',
        doubleValue: 'double?',
        longInt: 'int?',
        mediumInt: 'int?'
    },
    primaryKey: '_id'
};
exports.schemaClasses = [this.TestDataSchema];
*/

// This is a flexible example instead: will figure out the schema, and print info on all collections
exports.schemaName = "";
exports.schemaClasses = [];
