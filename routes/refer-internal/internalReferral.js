//one major thing is left is how to prevent error ie if all the users are duplicate then array send to notification framework is null and thenit shows error and terminates the server . one thing is done is check at notification framework if user array is null or not . 

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var Hashids = require('hashids');

var jobApplySchema = require('../Schema');
var config = require('../Config');
var authtokenvalidation = require('../auth-token-management/AuthTokenManager');   //module to authenticate user before making request
var sendNotification = require('../notification-system/notificationFramework');

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

var _jobApply = jobApplySchema.jobApply;
var _connection = config.createConnection;

router.post('/', function (request, response) {
    var uuid = request.body.uuid;
    var juuid = request.body.juuid;
    var auth_key = request.body.authkey;
    var referredUsers = request.body.referred_users;
    var name = request.body.name;
    var jobName = request.body.jobtitle;

    var notificationData = {
        Category: "Referral",
        AppModel: "1.0",
        Persist: "Yes",
        Referrer: name,
        jobID: juuid,
        JobName: jobName
    };

    var server_refUsers = new Array();

    var duplicationQuery = 'SELECT refUser FROM referredUsers WHERE Refcode = ?';

    authtokenvalidation.checkToken(uuid, auth_key, function (err, data) {
        if (err) throw err;

        else if (data == 0) {
            var invalidJson = {};
            invalidJson['tokenstatus'] = 'invalid';
            response.send(JSON.stringify(invalidJson));
            response.end();
        }

        else {
            //code for internal referral system

            //prevention of self reference
            if (referredUsers.indexOf(uuid) !== -1) {
                referredUsers.splice(referredUsers.indexOf(uuid), 1);
            }

            //Check if refcode for user and job exists

            //firstly it will check for the refcode for ajob and user exists already or not , if it exists than no need to create another. 

            checkRefCode(uuid, juuid, function (row, error) {
                if (error) throw error;

                else if (row.length !== 0) {
                    //Here the refcode exists so there is a chance that user may refer same user again ie. duplication of user So this method checks for user duplication.

                    var refCode = row[0].Refcode;
                    _connection.query(duplicationQuery, [refCode], function (error, result) {
                        if (error) throw error;

                        for (var x in result) {
                            server_refUsers.push(result[x].refUser);
                        }

                        var duplicationResult = duplicationMapping(server_refUsers, referredUsers, refCode);

                        console.log('Status Array-> ' + duplicationResult.statusArray);
                        console.log('New Referred Users Array-> ' + duplicationResult.updatedrefUser);

                        applyValidation(uuid, juuid, duplicationResult.updatedrefUser, function (userStatus, error) {
                            if (error) throw error;

                            console.log('In duplication call back');
                            for (var t in duplicationResult.statusArray) {
                                userStatus.Users.push(duplicationResult.statusArray[t]);
                            }

                            saveReferredUser(userStatus.uuidArray, refCode, function () {
                                sendNotification.notification(userStatus.uuidArray, notificationData, function (err) {

                                    if (err) {
                                        console.error(err);
                                        throw err;
                                    }
                                    else {
                                        var localJson = {};
                                        localJson['tokenstatus'] = 'valid';
                                        localJson['uuidstatus'] = userStatus.Users;
                                        response.send(JSON.stringify(localJson));
                                        response.end();
                                    }

                                });
                            });
                        });
                    });
                }

                else {
                    //This block is executed when refcode for a user and a job does not exists in referrals table.So it don't check for the duplication.

                    applyValidation(uuid, juuid, referredUsers, function (userStatus, error) {
                        if (error) throw error;

                        console.log('In call back');

                        saveReferrals(uuid, juuid, function (refcode, error) {
                            if (error) throw error;

                            saveReferredUser(userStatus.uuidArray, refcode, function () {
                                sendNotification.notification(userStatus.uuidArray, notificationData, function (err) {
                                    if (err) {
                                        console.error(err);
                                        throw err;
                                    }
                                    else {
                                        var localJson = {};
                                        localJson['tokenstatus'] = 'valid';
                                        localJson['uuidstatus'] = userStatus.Users;
                                        response.send(JSON.stringify(localJson));
                                        response.end();
                                    }
                                });
                            });
                        });
                    });
                }
            });
        }
    });
});


//This function maps the client users with server user who have been referred already and returns a json of updated userid ie. those who are not referred and status.

function duplicationMapping(server_refuser, referredusers, refcode) {
    var statusArray = new Array();
    var globalJson = {};

    for (var i = 0; i < server_refuser.length; i++) {
        if (referredusers.indexOf(server_refuser[i]) !== -1) {
            var localJson = {};

            localJson[server_refuser[i]] = 'Duplicate';
            statusArray.push(localJson);
            referredusers.splice(referredusers.indexOf(server_refuser[i]), 1);
        }
    }

    globalJson['statusArray'] = statusArray;
    globalJson['updatedrefUser'] = referredusers;

    return globalJson;
}

function checkRefCode(uuid, juuid, callback) {
    var refcodeQuery = 'SELECT Refcode FROM Referrals WHERE userid = ? AND jobid = ?';

    _connection.query(refcodeQuery, [uuid, juuid], function (error, row) {
        if (error) throw error;

        callback(row, error);
    });
}

//validate only for updated referred users if they have already applied for a job or not.

function applyValidation(uuid, juuid, referredUsers, callback) {
    var applyValidationQuery = 'SELECT userid FROM apply WHERE jobid = ?';
    var serverapply_refUsers = new Array();

    _connection.query(applyValidationQuery, [juuid], function (error, row) {
        if (error) throw error;

        for (var j in row) {
            serverapply_refUsers.push(row[j].userid);
        }
        var usersStatus = applyMapping(referredUsers, serverapply_refUsers);
        callback(usersStatus, error);
    });
}

//This function is for mapping the result returned by apply table and the userid client have send and returns the jsonof userid and their status.

function applyMapping(referredusers, serverusers) {
    var validUsers = new Array();
    var validuuidArray = new Array();
    var globalJson = {};

    console.log(referredusers);

    for (var k = 0; k < referredusers.length; k++) {
        if (serverusers.indexOf(referredusers[k]) !== -1) {
            var localJson = {};
            localJson[referredusers[k]] = 'Applied';
            validUsers.push(localJson);
        }
        else {
            var localJson = {};

            localJson[referredusers[k]] = 'Success';
            validUsers.push(localJson);
            validuuidArray.push(referredusers[k]);
        }
    }

    console.log('Users Status->' + validUsers)

    globalJson['Users'] = validUsers;
    globalJson['uuidArray'] = validuuidArray;

    return globalJson;
}

//This method save refcod if user not referred anybdy for job in past.

function saveReferrals(uuid, juuid, callback) {
    var hashkey = uuid + juuid;
    var hashid = new Hashids(hashkey, 10);
    var refCode = hashid.encode(1);
    var insertrefCode = 'INSERT INTO Referrals SET ?';
    var data = {Refcode: refCode, userid: uuid, jobid: juuid};

    _connection.query(insertrefCode, data, function (error, result) {
        if (error) throw error;

        console.log(result);

        callback(refCode, error);
    });
}

//This function saves the referred users and their refcode in referredUsers table.

function saveReferredUser(referredUsers, refcode, callback) {
    var insertReferredusers = 'INSERT INTO referredUsers SET ?';

    console.log(referredUsers);

    for (var z in referredUsers) {
        var data = {Refcode: refcode, refUser: referredUsers[z]};
        _connection.query(insertReferredusers, data, function (error, result) {
            if (error) throw error;

            console.log(result);
        });
    }

    callback();
}

module.exports = router;