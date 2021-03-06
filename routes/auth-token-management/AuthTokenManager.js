//This module validate the auth token in every user request.By taking uuid and auth Token as parameters in its arguments. 

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var jwt = require('jsonwebtoken');

var config = require('./../Config');
var _connection = config.createConnection;
var authtokenutils = require('./AuthTokenUtils');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/',function(request, response, next){
    
    console.log('authtokenValidation router ' + JSON.stringify(request.body, null, 3));
    
    var authKey = request.body.authtoken;
    var uuid = request.body.uuid;
    
    var authQuery = 'SELECT UUID FROM users WHERE UUID = ? AND Auth_key=?';
    
    _connection.query(authQuery,[uuid,authKey],function(error,result){
        if(error) throw error;
        
        var resultLength = result.length;
        
        if(result.length == 0){
            response.send(false);
            response.end();
        }
        else{
            response.send(true);
            response.end();
        }
    });
});

function generateToken(payload) {
    return jwt.sign(payload, config.secretKey);
}

function validateToken(token) {
    return new Promise(function (resolve, reject) {
        jwt.verify(token, config.secretKey, function (err, decoded) {
            if(err){
                reject(err);
            }
            else {
                resolve(decoded);
            }
        });
    });
}

var tokenValidation = function(uuid, auth_key, callback){

    var authQuery = 'SELECT UUID, firstname, lastname, phone, email FROM User WHERE uuid = ? AND authkey = ?';
    _connection.query(authQuery, [uuid, auth_key], function(error, row){
        
        console.log('Row in authtokenValidation.tokenValidation is ' + JSON.stringify(row, null, 3));
        
        if(error) {
            callback(error, null);
        }
        else{
            //checking happens
            //var rowLength = row.length;
            callback(null, row[0]);
        }
    });
};

/**
 * Function to check user's authtoken is valid or not
 * */
function authValid(uuid, authkey) {
    return new Promise(function (resolve, reject) {
        tokenValidation(uuid, authkey, function (err, details) {
            if(err){
                throw err;
            }
            else if(!details){
                reject();
            }
            else{
                resolve(details);
            }
        });

    });

}

/**
 * Function to check a client's authtoken is valid or not
 * */
function clientAuthValid(clientid, authkey) {

    return new Promise(function (resolve, reject) {

        _connection.query('SELECT * FROM Client WHERE clientid = ? AND authkey = ?', [clientid, authkey], function (err, row) {

            if(err){
                throw err;
            }
            else if(row.length === 0){
                reject();
            }
            else{
                resolve(row[0]);
            }

        });

    });

}

function authValidWeb(web_access_token) {
    return new Promise(function (resolve, reject) {
        if(!web_access_token){  //Since this authValidWeb is always called for endpoints that are also used for web, web_access_token could be undefined
            resolve();
        }
        else{
            authtokenutils.decryptPayloadAuth(decodeURIComponent(web_access_token))
                .then(resolve, reject);
        }
    });
}

function generateWebAccessToken(payload) {
    return new Promise(function (resolve, reject) {
        resolve(authtokenutils.encryptPayloadForAuth(payload));
    });
}

module.exports = router;
module.exports.checkToken = tokenValidation;
module.exports.authValid = authValid; //Promise version of tokenValidation
module.exports.clientAuthValid = clientAuthValid;
module.exports.generateToken = generateToken;
module.exports.validateToken = validateToken;
module.exports.authValidWeb = authValidWeb;
module.exports.generateWebAccessToken = generateWebAccessToken;