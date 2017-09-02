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
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.post('/sign-up', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
                throw new BreakPromiseChainError();
            }
        })
        .then(function (data) {
            response.send({
                status: 'created',
                data: data
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                });
                response.end();
            }
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
                resolve({
                    authkey: params.authkey,
                    clientid: params.clientid
                });
            }
        })
    })
}

router.post('/sign-in', function (request, response) {
    
    console.log("request is " + JSON.stringify(request.body, null, 3));

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
                    throw new BreakPromiseChainError();
                }

            }
            else {  //Email doesn't exists
                response.send({
                    access: 'denied',
                    status: 'incorrect-email'
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function (data) {

            console.log("then block after checkAuthKey(): data is " + JSON.stringify(data, null, 3));

            response.send({
                access: 'approved',
                data: data
            });
            response.end();
            throw new BreakPromiseChainError();

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
        });

});

/**
 * Returns the authkey associated with the email-password (generates if doesn't exists)
 * */
function checkForAuthKey(userdata){

    return new Promise(function (resolve, reject) {

        if(userdata.authkey){
            resolve({
                authkey: userdata.authkey,
                clientid: userdata.clientid,
                name: userdata.name
            });
        }
        else{
            var payload = {
                id: userdata.clientid
            };

            var authkey = _auth.generateToken(payload);

            //Update the authkey for the client record
            connection.query('UPDATE Client SET ? WHERE clientid = ?', [{authkey: authkey}, userdata.clientid], function (err, row) {

                if(err){
                    reject(err);
                }
                else {

                    resolve({
                        authkey: authkey,
                        clientid: userdata.clientid,
                        name: userdata.name
                    });
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

router.post('/sign-out', function (request, response) {

    var clientid = request.body.clientid;
    var authkey = request.body.authkey;

    _auth.clientAuthValid(clientid, authkey)
        .then(function () {
            return clearValuesForSignout(clientid);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
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

/**
 * Clears the authkey of the client when he logs out
 * */
function clearValuesForSignout(clientid) {
    return new Promise(function (resolve, reject) {
        var params = {
            authkey: null
        };

        connection.query('UPDATE Client SET ? WHERE clientid = ?', [params, clientid], function (err, row) {
            if(err){
                reject(err);
            }
            else {
                resolve();
            }
        })
    })
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
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (row) {

            var payload = {
                id: clientid,
                contact: row.contact
            };

            return saveToken(clientid, _auth.generateToken(payload));
        })
        .then(function (authkey) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    authkey: authkey
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function(err){
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

router.post('/update', function (request, response) {

   var clientid = request.body.clientid;
   var authkey = request.body.authkey;

   var params = {
       authkey: authkey
   };

   if(request.body.bio){
       params.bio = request.body.bio;
   }

   if(request.body.name){
        params.name = request.body.name;
   }

    if(request.body.email){
        params.email = request.body.email;
    }

    if(request.body.password){
        params.password = request.body.password;
    }

    if(request.body.contact){
        params.contact = request.body.contact;
    }

   _auth.clientAuthValid(clientid, authkey)
       .then(function () {
           return updateClientProfile(clientid, params);
       }, function () {
           response.send({
               tokenstatus: 'invalid'
           });
           response.end();
           throw new BreakPromiseChainError();
       })
       .then(function () {
           response.send({
               tokenstatus: 'valid',
               data: {
                   status: 'SUCCESS'
               }
           });
           response.end();
           throw new BreakPromiseChainError();
       })
       .catch(function (err) {
           if (err instanceof BreakPromiseChainError) {
               console.log('Broke out of a promise chain');
           }
           else {
               console.error(err);
               response.status(500).send({
                   error: 'Some error occurred at the server'
               }).end();
           }
       })

});

function updateClientProfile(clientid, params){
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Client SET ? WHERE clientid = ?', [params, clientid], function (err, row) {
            if(err){
                reject(err);
            }
            else{
                resolve();
            }
        });
    })
}

module.exports = router;