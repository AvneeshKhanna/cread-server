/**
 * Created by avnee on 03-07-2017.
 */

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var connection = config.createConnection;
var AWS = config.AWS;
var uuid = require('uuid');

var _auth = require('../../../auth-token-management/AuthTokenManager');

router.post('/sign-up', function (request, response) {

    var email = request.body.email;
    var password = request.body.password;
    var contact = request.body.contact;
    var name = request.body.name;

    checkIfClientUserAlreadyExists(email)
        .then(function (row) {
            if(row.length == 0){
                return createNewClientUser(email, password, contact, name);
            }
            else {
                response.send({
                    status: 'exists'
                });
                response.end();
            }
        }, function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Some error occurred at the server'
            });
            response.end();
        })
        .then(function (authkey) {
            response.send({
                status: 'created',
                data: {
                    authkey: authkey
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

function checkIfClientUserAlreadyExists(email) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT clientid FROM Client WHERE email = ?', [email], function (err, row) {
            if(err){
                reject(err);
            }
            else {
                resolve(row);
            }
        })
    })
}

function createNewClientUser(email, password, contact, name) {
    return new Promise(function (resolve, reject) {

        var params = {
            name: name,
            email: email,
            password: password,
            clientid: uuid.v4()
        };

        if(contact){
            params.contact = contact;
        }

        var payload = {
            clientid: params.clientid
        };

        params.authkey = _auth.generateToken(payload);

        connection.query('INSERT INTO Client SET ?', [params], function (err, row) {
            if(err){
                reject(err);
            }
            else {
                resolve(params.authkey);
            }
        })
    })
}

router.post('/sign-in', function (request, response) {

    var email = request.body.email;
    var password = request.body.password;

    getUserDetailsForLogin(email)
        .then(function (userdata) {

            if(userdata){   //Email exists

                if(userdata.password == password){  //Password matches
                    return checkForAuthKey(userdata);
                }
                else {  //Password doesn't match
                    response.send({
                        access: 'denied',
                        status: 'incorrect-password'
                    });
                    response.end();
                }

            }
            else {  //Email doesn't exists
                response.send({
                    access: 'denied',
                    status: 'incorrect-email'
                });
                response.end();
            }
        }, function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Server error occurred'
            });
        })
        .then(function (authkey) {

            response.send({
                access: 'approved',
                authkey: authkey
            });
            response.end();

        }, function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Server error occurred'
            });
        });

});

/**
 * Returns the authkey associated with the email-password (generates if doesn't exists)
 * */
function checkForAuthKey(userdata){

    return new Promise(function (resolve, reject) {

        if(userdata.authkey){
            resolve(userdata.authkey);
        }
        else{

            var payload = {
                id: userdata.clientid/*,
                contact: userdata.contact*/   //TODO: Replace contact since it is not mandatory
            };

            var authkey = _auth.generateToken(payload);

            //Update the authkey for the client record
            connection.query('UPDATE Client SET ? WHERE clientid = ?', [{authkey: authkey}, userdata.clientid], function (err, row) {

                if(err){
                    reject(err);
                }
                else {
                    resolve(authkey);
                }

            });

        }

    })
}

/**
 * Returns the user details for the given email
 * */
function getUserDetailsForLogin(email) {

    return new Promise(function (resolve, reject) {

        connection.query('SELECT * FROM Client WHERE email = ?', [email], function (err, row) {

            if(err){
                reject(err);
            }
            else {
                resolve(row[0]);
            }

        })

    });

}

router.post('/token-update', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;

    _auth.validateToken(authkey)
        .then(function (decoded) {
            return getUserContact(decoded.id);
        }, function (err) {
            console.error(err);
            response.send({
                tokenstatus: 'invalid'
            });
            response.send();
        })
        .then(function (row) {

            var payload = {
                id: clientid,
                contact: row.contact
            };

            return saveToken(clientid, _auth.generateToken(payload));

        }, function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Server error occurred'
            });
        })
        .then(function (authkey) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    authkey: authkey
                }
            });
            response.end();
        }, function (err) {
            console.error(err);
            response.status(500).send({
                error: 'Server error occurred'
            });
        });

});

/**
 * Returns the contact associated with the user
 * */
function getUserContact(clientid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT contact FROM Client WHERE clientid = ?', [clientid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                resolve(row[0]);
            }
        })
    })
}

/**
 * Updates the given token for the given clientid record in the table
 * */
function saveToken(clientid, authkey) {
    return new Promise(function (resolve, reject) {

        var params = {
            authkey: authkey
        };

        connection.query('UPDATE Client SET ? WHERE clientid = ?', [params, clientid], function (err, row) {

            if (err) {
                reject(err);
            }
            else {
                resolve(authkey);
            }

        });

    })
}

module.exports = router;