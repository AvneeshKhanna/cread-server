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

var docClient = new AWS.DynamoDB.DocumentClient();

var _auth = require('../../auth-token-management/AuthTokenManager');

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
        })
        .then(function (row) {

            var data = {
                firstname : row.firstname,
                lastname: row.lastname,
                contact: row.phoneNo,
                email: row.email
            };

            response.send({
                tokenstatus: 'valid',
                data: data
            });
            response.end();

        });

});

/**
 * Get a specific user's profile data
 * */
function getUserProfileData(uuid) {

    return new Promise(function (resolve, reject) {

        connection.query('SELECT firstname, lastname, email, phoneNo FROM users WHERE UUID = ?', [uuid], function (err, row) {

            if(err){
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
        firstname : request.body.firstname,
        lastname : request.body.lastname,
        email : request.body.email
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
            TableName : userstbl_ddb,
            Key: {
                UUID : uuid
            },
            UpdateExpression: 'set #key1 = :val1, #key2 = :val2',
            ExpressionAttributeNames: {
                '#key1' : 'Name',
                '#key2' : 'Email_Id'
            },
            ExpressionAttributeValues: {
                ':val1' : params.firstname + ' ' + params.lastname,
                ':val2' : params.email
            }
        };

        docClient.update(ddbparams, function (err, data) {

            if(err){
                reject(err);
            }
            else{
                resolve();
            }

        })

    });
}

/**
 * Function to update user's details in RDS table
 * */
function updateUserProfileRDS(params, uuid){
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE users SET ? WHERE UUID = ?', [params, uuid], function (err, row) {

            if(err){
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
            return updateFbUsername(uuid, fbusername);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
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
        })

});

function updateFbUsername(uuid, fbusername) {
    return new Promise(function (resolve, reject) {

        var params = {
            fbusername: fbusername
        };

        connection.query('UPDATE users SET ? WHERE UUID = ?', [params, uuid], function (err, row) {
            if(err){
                reject(err);
            }
            else {
                resolve();
            }
        })
    })
}

module.exports = router;