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
var utils = require('../utils/Utils');
var followutils = require('../follow/FollowUtils');
var chatconvoutils = require('../chat/ChatConversationUtils');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var cache_utils = require('../utils/cache/CacheUtils');
var REDIS_KEYS = cache_utils.REDIS_KEYS;
var CREAD_GOOGLE = config.CREAD_GOOGLE;
var jobqueuehandler = require('../utils/long-tasks/JobQueueHandler');

const googleOAuthClient = config.getGoogleOAuthClient();

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
                else {
                    resolve(false);
                }
            }
        });
    });
}

function checkIfUserExists(connection, fbid, ggl_userid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT firstname, lastname, uuid, authkey ' +
            'FROM User ' +
            'WHERE ' + (fbid ? 'fbid' : 'ggl_userid') +  ' = ?', [(fbid ? fbid : ggl_userid)], function (err, rows) {
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
        id: userdetails.fbid ? userdetails.fbid : userdetails.ggl_userid
    });

    userdetails.uuid = uuid;
    userdetails.authkey = authkey;

    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {
                connection.query('INSERT INTO User SET ?', [userdetails], function (err, rows) {
                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else if (fcmtoken) {

                        addUserToDynamoDB({
                            'UUID': uuid,
                            'Fcm_token': [fcmtoken]
                        }, function (err) {
                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else {
                                resolve({
                                    uuid: uuid,
                                    authkey: authkey
                                });
                            }
                        });
                    }
                    else {
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

function addUserToDynamoDB(item, callback) {
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
        if (err) {
            callback(err);
        }
        else {
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
                    else {
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
            else {
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
                        else {
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

function getUserDetailsFromGoogle(access_token) {
    return new Promise(function (resolve, reject) {
        googleOAuthClient
            .verifyIdToken({
                idToken: access_token,
                audience: CREAD_GOOGLE.CLIENTID // Specify the CLIENT_ID of the app that accesses the backend
                // Or, if multiple clients access the backend:
                //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
            })
            .then(function (ticket) {

                const payload = ticket.getPayload();

                // If request specified a G Suite domain:
                //const domain = payload['hd'];

                resolve({
                    ggl_userid: payload['sub'],
                    email: payload['email'],
                    firstname: payload['given_name'],
                    lastname: payload['family_name'],
                    locale: payload['locale']
                });

            })
            .catch(function (err) {
                reject(err);
            });
    });
}

function updateNewFacebookUserDataForUpdates(connection, uuid, actor_uuid, category) {
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

/**
 * Function to add Cread Kalakaar as a follower and a followee for the user as well as add a default chat message
 * from Cread Kalakaar
 * */
function addDefaultCreadKalakaarActions(connection, user_uuid) {
    return new Promise(function (resolve, reject) {
        utils.beginTransaction(connection)
            .then(function () {
                return followutils.registerFollowForCreadKalakaar(connection, user_uuid);
            })
            .then(function () {
                var default_ck_chat_job_data = {
                    for_uuid: user_uuid
                };

                return jobqueuehandler.scheduleJob(REDIS_KEYS.KUE_DEFAULT_CK_CHAT_MSG, default_ck_chat_job_data, {
                    delay: 10 * 60 * 1000,
                    removeOnComplete: true
                });
            })
            .then(function () {
                return utils.commitTransaction(connection);
            }, function (err) {
                return utils.rollbackTransaction(connection, undefined, err);
            })
            .then(function () {
                resolve();
            })
            .catch(function (err) {
                reject(err);
            })
    });
}

(function processDefaultCKChatJob() {

    var connection;

    jobqueuehandler.processJob(REDIS_KEYS.KUE_DEFAULT_CK_CHAT_MSG, function (jobData) {
        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                console.log('Process job in IIFE called');
                return utils.beginTransaction(connection);
            })
            .then(function () {
                return chatconvoutils.addDefaultMessageFromCreadKalakaar(connection, jobData.for_uuid);
            })
            .then(function () {
                return utils.commitTransaction(connection);
            }, function (err) {
                return utils.rollbackTransaction(connection, undefined, err);
            })
            .then(function () {
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if (err instanceof BreakPromiseChainError) {
                    //Do nothing
                }
                else {
                    console.error(err);
                }
            });
    })
})();

module.exports = {
    checkIfPhoneExists: checkIfPhoneExists,
    addUserFcmToken: addUserFcmToken,
    removeUserFcmToken: removeUserFcmToken,
    addUserToDynamoDB: addUserToDynamoDB,
    registerUserData: registerUserData,
    checkIfUserExists: checkIfUserExists,
    getUserDetailsFromGoogle: getUserDetailsFromGoogle,
    updateNewFacebookUserDataForUpdates: updateNewFacebookUserDataForUpdates,
    addDefaultCreadKalakaarActions: addDefaultCreadKalakaarActions
};