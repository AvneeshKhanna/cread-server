/**
 * Created by avnee on 28-10-2017.
 */
'use-strict';

const config = require('../../Config');

const envconfig = require('config');

const AWS = config.AWS;
const ddbClient = new AWS.DynamoDB.DocumentClient();
const uuidGen = require('uuid');

const _auth = require('../../auth-token-management/AuthTokenManager');

const userstbl_ddb = envconfig.get('dynamoDB.users_table');
const updatesutils = require('../updates/UpdatesUtils');
const utils = require('../utils/Utils');
const followutils = require('../follow/FollowUtils');
const chatconvoutils = require('../chat/ChatConversationUtils');
const BreakPromiseChainError = require('../utils/BreakPromiseChainError');

const cache_utils = require('../utils/cache/CacheUtils');
const REDIS_KEYS = cache_utils.REDIS_KEYS;
const CREAD_GOOGLE = config.CREAD_GOOGLE;
const jobqueuehandler = require('../utils/long-tasks/JobQueueHandler');

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

    const uuid = uuidGen.v4();
    const authkey = _auth.generateToken({
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
                    else /*if (fcmtoken) */{

                        addUserToDynamoDB({
                            'UUID': uuid,
                            'Fcm_token': [
                                fcmtoken
                            ]
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
                    /*else {
                        resolve({
                            uuid: uuid,
                            authkey: authkey
                        });
                    }*/
                });
            }
        });
    });
}

function addUserToDynamoDB(item, callback) {
    let params = {
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
        let table = userstbl_ddb;
        let addParams = {
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

        let getParams = {
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

        let table = userstbl_ddb;
        let getParams = {
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
                let fcmtokens = data.Item.Fcm_token;

                if (fcmtokens.indexOf(fcmtoken) !== -1) {    //Fcm Token exists, remove it
                    fcmtokens.splice(fcmtokens.indexOf(fcmtoken), 1);

                    let updateParams = {
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
                    firstname: utils.firstLetterToUpper(payload['given_name']),
                    lastname: utils.firstLetterToUpper(payload['family_name']),
                    locale: payload['locale'],
                    profilepicurl: payload['picture'] + "?sz=500"   //Adding query parameter for high res pic
                });

            })
            .catch(function (err) {
                reject(err);
            });
    });
}

function updateNewFacebookUserDataForUpdates(connection, uuid, actor_uuid, category) {
    return new Promise(function (resolve, reject) {
        let updateparams = {
            uuid: uuid,
            actor_uuid: actor_uuid,
            category: category
        };
        updatesutils.addToUpdatesTable(connection, updateparams)
            .then(resolve, reject);
    });
}

/**
 * Function to schedule a task to Cread Kalakaar as a follower and a followee for the user as well as add a default chat message
 * from Cread Kalakaar
 * */
function addDefaultCreadKalakaarActions(connection, user_uuid) {
    return new Promise(function (resolve, reject) {
        utils.beginTransaction(connection)
            .then(function () {
                let default_ck_chat_job_data = {
                    for_uuid: user_uuid
                };

                return jobqueuehandler.scheduleJob(REDIS_KEYS.KUE_DEFAULT_CK_CHAT_MSG, default_ck_chat_job_data, {
                    delay: config.isProduction() ? 5 * 60 * 1000 : 10 * 1000,
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

    let connection;

    jobqueuehandler.processJob(REDIS_KEYS.KUE_DEFAULT_CK_CHAT_MSG, function (jobData) {
        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                console.log('Process job in IIFE called');
                return utils.beginTransaction(connection);
            })
            .then(function () {
                return followutils.registerFollowForCreadKalakaar(connection, jobData.for_uuid);
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