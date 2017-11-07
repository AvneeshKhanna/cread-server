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
                    else {

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

module.exports = {
    addUserFcmToken: addUserFcmToken,
    removeUserFcmToken: removeUserFcmToken,
    addUserToDynamoDB: addUserToDynamoDB,
    registerUserData: registerUserData
};