/**
 * Created by avnee on 03-07-2017.
 */

/**
 * To request or update a specific user's profile
 * */

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var connection = config.createConnection;
var AWS = config.AWS;

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');
var s3bucket = envconfig.get('s3.bucket');
var uuidGenerator = require('uuid');

var multer = require('multer');
var upload = multer({dest: './images/uploads/profile_picture/'});
var fs = require('fs');

var jimp = require('jimp');

var docClient = new AWS.DynamoDB.DocumentClient();

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var clientprofile_utils = require('../dsbrd/client-profile/ClientProfileUtils');
var userprofileutils = require('./UserProfileUtils');
var useraccessutils = require('./UserAccessUtils');
var utils = require('../utils/Utils');

var consts = require('../utils/Constants');
var cache_time = consts.cache_time;

//TODO: Delete profile pictures after uploading

router.post('/request/', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return getUserProfileData(uuid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (row) {

            var data = {
                firstname: row.firstname,
                lastname: row.lastname,
                contact: row.phoneNo,
                email: row.email
            };

            response.send({
                tokenstatus: 'valid',
                data: data
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

/**
 * Get a specific user's profile data
 * */
function getUserProfileData(uuid) {

    return new Promise(function (resolve, reject) {

        connection.query('SELECT firstname, lastname, email, phoneNo FROM users WHERE UUID = ?', [uuid], function (err, row) {

            if (err) {
                console.error(err);
                throw err;
            }
            else {
                resolve(row[0]);
            }

        });


    });

}

router.post('/update/', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

    var params = {
        firstname: request.body.firstname,
        lastname: request.body.lastname,
        email: request.body.email
    };

    _auth.authValid(uuid, authkey)
        .then(function () {
            return updateUserProfileRDS(params, uuid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
        })
        .then(function () {
            return updateUserProfileDDB(params, uuid);
        }, function (err) {

            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            });
            response.end();

        })
        .then(function () {

            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();

        }, function (err) {

            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            });
            response.end();

        });

});

/**
 * Function to update user's details in DynamoDB table
 * */
function updateUserProfileDDB(params, uuid) {
    return new Promise(function (resolve, reject) {

        var ddbparams = {
            TableName: userstbl_ddb,
            Key: {
                UUID: uuid
            },
            UpdateExpression: 'set #key1 = :val1, #key2 = :val2',
            ExpressionAttributeNames: {
                '#key1': 'Name',
                '#key2': 'Email_Id'
            },
            ExpressionAttributeValues: {
                ':val1': params.firstname + ' ' + params.lastname,
                ':val2': params.email
            }
        };

        docClient.update(ddbparams, function (err, data) {

            if (err) {
                reject(err);
            }
            else {
                resolve();
            }

        })

    });
}

/**
 * Function to update user's details in RDS table
 * */
function updateUserProfileRDS(params, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE users SET ? WHERE UUID = ?', [params, uuid], function (err, row) {

            if (err) {
                reject(err);
            }
            else {
                resolve();
            }

        });
    })
}

router.post('/update-fb-username', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var fbusername = request.body.fbusername;

    console.log("request is " + JSON.stringify(request.body, null, 3));

    _auth.authValid(uuid, authkey)
        .then(function () {
            return checkIfUsernameAlreadyExists(fbusername);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
        })
        .then(function (exists) {
            if (exists) {
                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'username-exists'
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else {
                //Proceed
                return updateFbUsername(uuid, fbusername);
            }
        })
        .then(function () {

            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();

        })
        .catch(function (err) {
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        })

});

function checkIfUsernameAlreadyExists(fbusername) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT UUID FROM users WHERE fbusername = ?', [fbusername], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                if (row.length !== 0) {
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            }
        })
    })
}

function updateFbUsername(uuid, fbusername) {
    return new Promise(function (resolve, reject) {

        var params = {
            fbusername: fbusername
        };

        connection.query('UPDATE users SET ? WHERE UUID = ?', [params, uuid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        })
    })
}

/**
 * Checks if a user is registered as a client. If not, creates the user's Client Table records
 * */
router.post('/check-for-client', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var bio = request.body.bio;
    var contact = request.body.contact;
    var name = request.body.name;

    var userdetails = {
        bio: bio,
        name: name,
        contact: contact
    };

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return checkUserRegisteredAsClient(uuid, connection);
        })
        .then(function (result) {
            if (result.isClient) {
                if (result.biostatus) {   //Case where client and bio both exist
                    response.send({
                        tokenstatus: 'valid',
                        data: {
                            status: 'done',
                            clientid: result.clientid
                        }
                    });
                    response.end();
                    throw new BreakPromiseChainError();
                }
                else {  //Case where client exists but bio doesn't
                    return updateClientBio(connection, result.clientid, bio)
                }
            }
            else {
                return registerUserAsClient(uuid, userdetails, connection);
            }
        })
        .then(function (clientid) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    clientid: clientid,
                    status: 'done'
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

function checkUserRegisteredAsClient(uuid, connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Client.clientid, Client.bio ' +
            'FROM users ' +
            'JOIN Client ' +
            'ON users.clientid = Client.clientid ' +
            'WHERE uuid = ?', [uuid], function (err, row) {

            console.log("query result " + JSON.stringify(row, null, 3));

            if (err) {
                reject(err);
            }
            else if (!row[0]) {    //Client doesn't exists
                resolve({
                    isClient: false,
                    biostatus: false
                });
            }
            else {  //Client exists
                resolve({
                    isClient: true,
                    biostatus: !!row[0].bio,
                    clientid: row[0].clientid
                });
            }
        });
    })
}

function registerUserAsClient(uuid, userdetails, connection) {
    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {

                var params = {
                    clientid: uuidGenerator.v4(),
                    bio: userdetails.bio,
                    is_user: true,
                    contact: userdetails.contact,
                    name: userdetails.name
                };

                connection.query('INSERT INTO Client SET ?', [params], function (err, row) {
                    if (err) {
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else {
                        connection.query('UPDATE users SET clientid = ? WHERE uuid = ?', [params.clientid, uuid], function (err, row) {
                            if (err) {
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else {
                                connection.commit(function (err) {
                                    if (err) {
                                        connection.rollback(function () {
                                            reject(err);
                                        });
                                    }
                                    else {
                                        resolve(params.clientid);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    });
}

function updateClientBio(connection, clientid, bio) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Client SET bio = ? WHERE clientid = ?', [bio, clientid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                resolve(clientid);
            }
        });
    });
}

router.get('/load-timeline', function (request, response) {
    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var lastindexkey = decodeURIComponent(request.query.lastindexkey);
    var requesteduuid = decodeURIComponent(request.query.requesteduuid);
    var platform = request.query.platform;
    var web_access_token = request.headers.wat;

    var limit = config.isProduction() ? 10 : 6;  //TODO: Change to 10

    var connection;

    _auth.authValidWeb(web_access_token)
        .then(function (payload) {
            if (web_access_token) {
                uuid = payload.uuid;
            }
        })
        .then(function () {
            if(!web_access_token){
                return _auth.authValid(uuid, authkey);
            }
        })
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return userprofileutils.loadTimeline(connection, requesteduuid, uuid, limit, lastindexkey);
        })
        .then(function (result) {

            if (platform !== "android" && platform !== "web") {
                result.items = utils.filterProfileMentions(result.items, "caption")
            }

            //console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if (request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')) {
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    tokenstatus: 'valid',
                    data: result
                });
                response.end();
            }

            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(err.status === 404 ? err.status : 500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/load-timeline', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var page = request.body.page;
    var lastindexkey = request.body.lastindexkey;
    var requesteduuid = request.body.requesteduuid;
    var platform = request.body.platform;

    console.log("request for '/load-timeline' is " + JSON.stringify(request.body, null, 3));

    var limit = (config.envtype === 'PRODUCTION') ? 10 : 6;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            if (page === 0 || page) {
                return userprofileutils.loadTimelineLegacy(connection, requesteduuid, uuid, limit, page);
            }
            else {
                return userprofileutils.loadTimeline(connection, requesteduuid, uuid, limit, lastindexkey);
            }
        })
        .then(function (result) {

            if (platform !== "android") {
                result.items = utils.filterProfileMentions(result.items, "caption")
            }

            console.log("result is " + JSON.stringify(result, null, 3));
            response.send({
                tokenstatus: 'valid',
                data: result
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

/**
 * Load basic profile info including followers and following count
 * */
router.get('/load-profile', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var requesteduuid = decodeURIComponent(request.query.requesteduuid); //The "uuid" of the profile that is requested
    var web_access_token = request.headers.wat;

    console.log("request headers are  " + JSON.stringify(request.headers, null, 3));

    var connection;

    _auth.authValidWeb(web_access_token)
        .then(function (payload) {
            if(web_access_token){
                uuid = payload.uuid;
            }
        })
        .then(function () {
            if(!web_access_token){
                return _auth.authValid(uuid, authkey)
            }
        })
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return userprofileutils.loadProfileInformation(connection, requesteduuid, uuid);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if (request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')) {
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    tokenstatus: 'valid',
                    data: result
                });
                response.end();
            }

            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(err.status === 404 ? err.status : 500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

/**
 * Load basic profile info including followers and following count
 * */
router.post('/load-profile', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var requesteduuid = request.body.requesteduuid; //The "uuid" of the profile that is requested

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return userprofileutils.loadProfileInformation(connection, requesteduuid, uuid);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.send({
                tokenstatus: 'valid',
                data: result
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.get('/load-collab-timeline', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var lastindexkey = decodeURIComponent(request.query.lastindexkey);
    var requesteduuid = decodeURIComponent(request.query.requesteduuid);
    var platform = request.query.platform;
    var web_access_token = request.headers.wat;

    var limit = (config.envtype === 'PRODUCTION') ? 10 : 5;
    var connection;

    _auth.authValidWeb(web_access_token)
        .then(function (payload) {
            if(web_access_token){
                uuid = payload.uuid;
            }
        })
        .then(function () {
            if(!web_access_token){
                return _auth.authValid(uuid, authkey);
            }
        })
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return userprofileutils.loadCollaborationTimeline(connection, requesteduuid, uuid, limit, lastindexkey);
        })
        .then(function (result) {

            if (platform !== "android" && platform !== "web") {
                result.items = utils.filterProfileMentions(result.items, "caption")
            }

            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if (request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')) {
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    tokenstatus: 'valid',
                    data: result
                });
                response.end();
            }

            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(err.status === 404  ? err.status : 500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.get('/load-fb-friends', function (request, response) {

    console.log("request headers are " + JSON.stringify(request.headers, null, 3));

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var fbid = request.query.fbid;
    var fbaccesstoken = decodeURIComponent(request.query.fbaccesstoken);
    var nexturl = request.query.nexturl ? decodeURIComponent(request.query.nexturl) : null;

    var connection;

    //TODO: Error handling for Facebook Graph API

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return utils.beginTransaction(connection);
        })
        .then(function () {
            return userprofileutils.checkIfFbIdAttachedToAnother(connection, fbid, uuid);
        })
        .then(function (isAttachedToAnother) {
            if (!isAttachedToAnother) {
                return userprofileutils.saveFbIdUser(connection, fbid, uuid);
            }
            else {
                response.status(200).send({
                    tokenstatus: 'valid',
                    data: {
                        duplicate_fbid: isAttachedToAnother
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function () {
            return userprofileutils.loadFacebookFriends(connection, uuid, fbid, fbaccesstoken, nexturl);
        })
        .then(function (result) {
            return utils.commitTransaction(connection, result);
        }, function (err) {
            //Even if the error is of type BreakPromiseChainError, transaction rollback won't do any damage
            //since nothing is changed in the database
            return utils.rollbackTransaction(connection, undefined, err);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            result.duplicate_fbid = false;

            if (request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')) {
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    tokenstatus: 'valid',
                    data: result
                });
                response.end();
            }

            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/load-fb-friends', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var fbid = request.body.fbid;
    var fbaccesstoken = request.body.fbaccesstoken;
    var nexturl = request.body.nexturl;

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var connection;

    //TODO: Error handling for Facebook Graph API
    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return userprofileutils.loadFacebookFriends(connection, uuid, fbid, fbaccesstoken, nexturl);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.send({
                tokenstatus: 'valid',
                data: result
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/update-profile', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var userdata = request.body.userdata;

    if (!userdata.bio) {
        delete userdata.bio;
    }
    if (!userdata.watermark) {
        delete userdata.watermark;
    }
    if (!userdata.firstname) {
        delete userdata.firstname;
    }
    /*if(!userdata.lastname){
        delete userdata.lastname;
    }*/
    if (!userdata.email) {
        delete userdata.email;
    }

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return userprofileutils.updateProfile(connection, uuid, userdata);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/update-phone', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var phone = request.body.phone;

    var details = {
        phone: phone
    };

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return useraccessutils.checkIfPhoneExists(connection, phone);
        })
        .then(function (result) {
            if (result) {
                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'phone-exists'
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else {
                return userprofileutils.updateProfile(connection, uuid, details);
            }
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/update-profile-picture', upload.single('display-pic'), function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var display_pic = request.file;

    console.log("request.file is " + JSON.stringify(request.file, null, 3));

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return renameFile(display_pic, uuid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (renamedpath) {
            return userprofileutils.createSmallProfilePic(renamedpath, uuid, 128, 128);
        })
        .then(function (displaypicsmallpath) {
            return uploadProfilePicToS3(displaypicsmallpath, uuid, 'display-pic-small.jpg');
        })
        .then(function () {
            return uploadProfilePicToS3("./images/uploads/profile_picture/" + uuid + ".jpg", uuid, 'display-pic.jpg');
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done',
                    profilepicurl: utils.createProfilePicUrl(uuid)
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            // config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.get('/short-link', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var requesteduuid = request.query.requesteduuid;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            return userprofileutils.getShortProfileLink(requesteduuid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (link) {

            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if (request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')) {
                response.status(304).send().end();
            }
            else {
                response.send({
                    tokenstatus: 'valid',
                    data: {
                        link: link
                    }
                });
                response.end();
            }
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

/**
 * npm package multer uploads an image to the server with a randomly generated guid without an extension. Hence,
 * the uploaded file needs to be renamed
 * */
function renameFile(display_pic, guid) {
    console.log("renameFile() called");
    return new Promise(function (resolve, reject) {
        console.log('display_pic path is ' + display_pic.path);
        fs.rename(display_pic.path, './images/uploads/profile_picture/' + guid + '.jpg', function (err) {
            if (err) {
                console.log("fs.rename: onReject()");
                reject(err);
            }
            else {
                /*fs.open('./images/uploads/profile_picture/' + guid + '.jpg', 'r+', function (err, renamed) {
                    if(err){
                        console.log("fs.readFile: onReject()");
                        reject(err);
                    }
                    else{
                        console.log('renamed file path ' + renamed.path);
                        resolve('./images/uploads/profile_picture/' + guid + '.jpg');
                    }
                });*/
                resolve('./images/uploads/profile_picture/' + guid + '.jpg');
            }
        });
    });
}

function uploadProfilePicToS3(filepath, uuid, filename) {
    console.log("uploadProfilePicToS3() called file.path " + filepath);
    return new Promise(function (resolve, reject) {
        var params = {
            Body: fs.createReadStream(filepath),
            Bucket: s3bucket,
            Key: "Users/" + uuid + "/Profile/" + filename,
            ACL: "public-read"
        };

        var s3 = new AWS.S3();
        s3.putObject(params, function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = router;