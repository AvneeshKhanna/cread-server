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
var uuidGenerator = require('uuid');

var docClient = new AWS.DynamoDB.DocumentClient();

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var clientprofile_utils = require('../dsbrd/client-profile/ClientProfileUtils');

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
            if(exists){
                response.send({
                    tokenstatus: 'valid',
                    data: {
                        status: 'username-exists'
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
            else{
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
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        })

});

function checkIfUsernameAlreadyExists(fbusername){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT UUID FROM users WHERE fbusername = ?', [fbusername], function (err, row) {
            if(err){
                reject(err);
            }
            else{
                if(row.length != 0){
                    resolve(true);
                }
                else{
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
            else{
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
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

function checkUserRegisteredAsClient(uuid, connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT clientid ' +
            'FROM users ' +
            'WHERE uuid = ?', [uuid], function (err, row) {

            console.log("query result " + JSON.stringify(row, null, 3));

            if (err) {
                reject(err);
            }
            else if (!row[0].clientid) {
                resolve({
                    isClient: false
                });
            }
            else {
                resolve({
                    isClient: true,
                    clientid: row[0].clientid
                });
            }
        });
    })
}

function registerUserAsClient(uuid, userdetails, connection){
    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{

                var params = {
                    clientid: uuidGenerator.v4(),
                    bio: userdetails.bio,
                    is_user: true,
                    contact: userdetails.contact,
                    name: userdetails.name
                };

                connection.query('INSERT INTO Client SET ?', [params], function (err, row) {
                    if(err){
                        connection.rollback(function () {
                            reject(err);
                        });
                    }
                    else{
                        connection.query('UPDATE users SET clientid = ? WHERE uuid = ?', [params.clientid, uuid], function (err, row) {
                            if(err){
                                connection.rollback(function () {
                                    reject(err);
                                });
                            }
                            else{
                                connection.commit(function (err) {
                                    if(err){
                                        connection.rollback(function () {
                                            reject(err);
                                        });
                                    }
                                    else{
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

/*router.post('/update-client-bio', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var clientid = request.body.clientid;
    var bio = request.body.bio;

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

            var sqlparams = {
                bio: bio
            };

            return clientprofile_utils.updateClientProfile(clientid, sqlparams, connection);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            })
        })
        .catch()

})*/

module.exports = router;