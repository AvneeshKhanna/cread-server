var express = require('express');
var app = express();
var router = express.Router();
var expressJwt = require('express-jwt');
var Jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var passport = require('passport');
var localStrategy = require('passport-local');
var mysql = require('mysql');
var uuidGenerator = require('uuid');
var AWS = require('aws-sdk');

var userSchema = require('./Schema');
var _auth = require('./Authentication');
var config = require('./Config');
var notify = require('./notification-system/notify');

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff'
});

var docClient = new AWS.DynamoDB.DocumentClient();
var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var _User = userSchema.User;
var _connection = config.createConnection;
config.connectDb();

//we use res.send when data is to be send once only and res.write used when we have to send multiple data to client 

router.post('/register', function (request, response, next) {
    var firstname = request.body.firstname;
    var lastname = request.body.lastname;
    var password = request.body.password;
    var phoneNo = request.body.contactnumber;
    var emailid = request.body.emailid;
    var city = request.body.city;
    var fcmToken = request.body.fcmtoken;
    var key = password + phoneNo;
    var name = firstname + ' ' + lastname;

    //checking if user already exists in db use deasync
    _connection.query('SELECT UUID FROM users WHERE phoneNo=?', [phoneNo], function (error, row) {

        var localJson = {};

        if (error) throw error;

        else if (row.length == 1) {

            localJson['authtoken'] = 'false';
            localJson['uuid'] = 'false';
            response.send(JSON.stringify(localJson));
            response.end();
        }
        else {

            //Send OTP for verification of phonenumber to user
            var uuid = uuidGenerator.v4();
            var Id = _auth.getToken(key);
            localJson['authtoken'] = Id;
            localJson['uuid'] = uuid;

            var user = {
                UUID: uuid,
                password: password,
                firstname: firstname,
                lastname: lastname,
                email: emailid,
                phoneNo: phoneNo,
                Auth_key: Id
            };

            /*var user = new _User({
             UUID: uuid,
             password: password,
             firstname: firstname,
             lastname: lastname,
             email: emailid,
             phoneNo: phoneNo,
             Auth_key: Id
             });*/

            console.log('user details are ' + JSON.stringify(user, null, 3));

            _connection.query('INSERT INTO users SET ?', user, function (err, result) {
                if (err) throw err;

                notify.registerFCM(uuid, fcmToken, localJson, name, emailid, phoneNo, city, response);
            });
        }
    });
});

router.post('/sign-in', function (request, response, next) {

    var phoneNo = request.body.contactnumber;
    var password = request.body.password;
    var fcmtoken = request.body.fcmtoken;

    console.log(JSON.stringify(request.body, null, 3));

    _connection.query('SELECT Auth_key, UUID, firstname, lastname, password ' +
        'FROM users ' +
        'WHERE phoneNo = ?', [phoneNo], function (err, result) {

        var localJson = {};

        if (err) {
            throw err;
        }
        else if (result.length == 0) {  //Case of unidentified contact

            localJson = {
                status: 'invalid-contact'
            };

            /*localJson['authtoken'] = 'false';
             localJson['uuid'] = 'false';
             localJson['name'] = 'false';*/
            response.send(localJson);
            response.end();
        }
        else if (result[0].password != password) {   //Case of unidentified password

            localJson = {
                status: 'invalid-password'
            };

            response.send(localJson);
            response.end();
        }
        else {

            localJson = {
                status: 'success',
                data: {
                    uuid: result[0].UUID,
                    authtoken: result[0].Auth_key,
                    name: result[0].firstname + " " + result[0].lastname
                }
            };

            /*localJson['uuid'] = result[0].UUID;
             localJson['authtoken'] = result[0].Auth_key;
             localJson['name'] = result[0].firstname + " " + result[0].lastname;*/
//            response.send(result[0].Auth_key);
            notify.loginFCM(result[0].UUID, fcmtoken, localJson, response);
        }
    });
});

//For backward compatibility
router.post('/login', function (request, response, next) {

    var phoneNo = request.body.contactnumber;
    var password = request.body.password;
    var fcmtoken = request.body.fcmtoken;

    console.log(JSON.stringify(request.body));

    _connection.query('SELECT Auth_key, UUID, firstname, lastname FROM users WHERE phoneNo=? AND password=?', [phoneNo, password], function (err, result) {

        var localJson = {};

        if (err) {
            throw err;
        }
        else if (result.length == 0) {

            localJson['authtoken'] = 'false';
            localJson['uuid'] = 'false';
            localJson['name'] = 'false';

            response.send(localJson);
            response.end();

        }
        else {

            localJson['uuid'] = result[0].UUID;
            localJson['authtoken'] = result[0].Auth_key;
            localJson['name'] = result[0].firstname + " " + result[0].lastname;

            //response.send(result[0].Auth_key);

            notify.loginFCM(result[0].UUID, fcmtoken, localJson, response);
        }
    });
});

router.post('/logout', function (request, response, next) {

    var uuid = request.body.uuid;
    var fcmToken = request.body.fcmtoken;
    var table = userstbl_ddb;

    console.log(JSON.stringify(request.body, null, 3));
    console.log('users/logout Request is ' + uuid);

    var deleteParams = {
        TableName: table,
        Key: {
            UUID: uuid
        },
        AttributesToGet: [
            'Fcm_token'
        ]
    };

    docClient.get(deleteParams, function (error, data) {
        if (error) {
            throw error;
        }
        else {
            deleteupdateItem(data.Item.Fcm_token, fcmToken, uuid, response);
        }
    });
});

router.post('/refreshfcmtoken', function (request, response) {

    var newFcm = request.body.newfcmtoken;
    var oldFcm = request.body.oldfcmtoken;
    var uuid = request.body.uuid;
    var table = userstbl_ddb;

    var getParams = {
        TableName: table,
        Key: {
            UUID: uuid
        },
        AttributesToGet: [
            'Fcm_token'
        ]
    };

    docClient.get(getParams, function (error, data) {
        if (error) throw error;

        refreshToken(uuid, newFcm, oldFcm, data.Item.Fcm_token, response);

    });
});

function refreshToken(uuid, newFcm, oldFcm, items, response) {
    items.splice(items.indexOf(oldFcm), 1, newFcm);

    var table = userstbl_ddb;

    var refreshParams = {
        TableName: table,
        Key: {
            UUID: uuid
        },
        AttributeUpdates: {
            Fcm_token: {
                Action: 'PUT',
                Value: items
            }
        }
    };

    docClient.update(refreshParams, function (error, data) {
        if (error) throw error;

        console.log(data);
        response.send('Token is refreshed');
        response.end();
    });
}

function deleteupdateItem(items, fcmtoken, uuid, response) {
    items.splice(items.indexOf(fcmtoken), 1);

    var table = userstbl_ddb;
    var addParams = {
        TableName: table,
        Key: {
            UUID: uuid
        },
        AttributeUpdates: {
            Fcm_token: {
                Action: 'PUT',
                Value: items
            }
        }
    };

    docClient.update(addParams, function (error, data) {
        if (error) throw error;

        console.log(JSON.stringify(data, null, 3));
        response.send('Logged out');
        response.end();
    });
}

module.exports = router;
