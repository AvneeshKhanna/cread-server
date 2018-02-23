/**
 * Created by avnee on 28-10-2017.
 */
'use-strict';

var config = require('../../Config');

var envconfig = require('config');

var AWS = config.AWS;
var ddbClient = new AWS.DynamoDB.DocumentClient();
var uuidGen = require('uuid');

var _auth = require('../../auth-token-management/AuthTokenManager');

var userstbl_ddb = envconfig.get('dynamoDB.users_table');
var updatesutils = require('../updates/UpdatesUtils');

function checkIfPhoneExists(connection, phone) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT firstname, lastname, phone FROM User WHERE phone = ?', [phone], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows[0]);
                if (rows[0]) {
                    resolve(true);
                }
                else{
                    resolve(false);
                }
            }
        });
    });
}

function checkIfUserExists(connection, fbid){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT firstname, lastname, uuid, authkey FROM User WHERE fbid = ?', [fbid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows[0]);
            }
        });
    });
}

function registerUserData(connection, userdetails, fcmtoken) {

    var uuid = uuidGen.v4();
    var authkey = _auth.generateToken({
        fbid: userdetails.fbid
    });

    userdetails.uuid = uuid;
    userdetails.authkey = authkey;

    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{
                connection.query('INSERT INTO User SET ?', [userdetails], function (err, rows) {
                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else if(fcmtoken){

                        addUserToDynamoDB({
                            'UUID': uuid,
                            'Fcm_token': [fcmtoken]
                        }, function (err) {
                            if(err){
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else{
                                resolve({
                                    uuid: uuid,
                                    authkey: authkey
                                });
                            }
                        });
                    }
                    else{
                        resolve({
                            uuid: uuid,
                            authkey: authkey
                        });
                    }
                });
            }
        });
    });
}

function addUserToDynamoDB(item, callback){
    var params = {
        TableName: userstbl_ddb,
        Item: /*{
                'UUID': uuid,
                'ContactNumber': contactnumber,
                'Email_Id': emailid,
                'Name': name,
                'City': city,
                'Fcm_token': [fcmToken]
            }*/item
    };

    ddbClient.put(params, function (err, data) {
        if (err){
            callback(err);
        }
        else{
            callback();
        }
    });
}

function addUserFcmToken(uuid, fcmtoken, resultfromprev) {
    return new Promise(function (resolve, reject) {
        var table = userstbl_ddb;
        var addParams = {
            TableName: table,
            Key: {
                UUID: uuid
            },
            AttributeUpdates: {
                Fcm_token: {
                    Action: 'ADD',
                    Value: [fcmtoken]
                }
            }
        };

        var getParams = {
            TableName: table,
            Key: {
                UUID: uuid
            },
            AttributesToGet: ['Fcm_token']
        };

        ddbClient.get(getParams, function (error, data) {
            if (error) {
                reject(error);
            }
            else if (data.Item.Fcm_token.indexOf(fcmtoken) !== -1) {    //Fcm Token already exists
                resolve(resultfromprev);
            }
            else {
                ddbClient.update(addParams, function (error, data) {
                    if (error) {
                        reject(error);
                    }
                    else{
                        resolve(resultfromprev);
                    }
                });
            }
        });
    });
}

function removeUserFcmToken(uuid, fcmtoken) {
    return new Promise(function (resolve, reject) {

        var table = userstbl_ddb;
        var getParams = {
            TableName: table,
            Key: {
                UUID: uuid
            },
            AttributesToGet: ['Fcm_token']
        };

        ddbClient.get(getParams, function (error, data) {
            if (error) {
                reject(error);
            }
            else{
                var fcmtokens = data.Item.Fcm_token;

                if (fcmtokens.indexOf(fcmtoken) !== -1) {    //Fcm Token exists, remove it
                    fcmtokens.splice(fcmtokens.indexOf(fcmtoken), 1);

                    var updateParams = {
                        TableName: table,
                        Key: {
                            UUID: uuid
                        },
                        AttributeUpdates: {
                            Fcm_token: {
                                Action: 'PUT',
                                Value: fcmtokens
                            }
                        }
                    };

                    ddbClient.update(updateParams, function (error, data) {
                        if (error) {
                            reject(error);
                        }
                        else{
                            resolve();
                        }
                    });

                }
                else {
                    resolve();
                }
            }
        });
    });
}

function updateNewFacebookUserDataForUpdates(connection, uuid, actor_uuid, category){
    return new Promise(function (resolve, reject) {
        var updateparams = {
            uuid: uuid,
            actor_uuid: actor_uuid,
            category: category
        };
        updatesutils.addToUpdatesTable(connection, updateparams)
            .then(resolve, reject);
    });
}

module.exports = {
    checkIfPhoneExists: checkIfPhoneExists,
    addUserFcmToken: addUserFcmToken,
    removeUserFcmToken: removeUserFcmToken,
    addUserToDynamoDB: addUserToDynamoDB,
    registerUserData: registerUserData,
    checkIfUserExists: checkIfUserExists,
    updateNewFacebookUserDataForUpdates: updateNewFacebookUserDataForUpdates
};