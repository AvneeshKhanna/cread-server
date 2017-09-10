/**
 * Created by avnee on 26-06-2017.
 */
'use strict';

var express = require('express');
var router = express.Router();

var moment = require('moment');
var uuidGen = require('uuid');
var async = require('async');

//--------------

var config = require('../../Config');
var connection = config.createConnection;

var envconfig = require('config');
var dbConfig = envconfig.get('rdsDB.dbConfig');

//--------------

var AWS = require('aws-sdk');

var transEmail = require('../dsbrd/wallet-management/TransactionEmailer');

/*AWS.config.region = 'eu-west-1';
 AWS.config.credentials = new AWS.CognitoIdentityCredentials({
 IdentityPoolId: 'eu-west-1:d29fce0a-ac1a-4aaf-b3f6-0bc48b58b87e'
 });*/

var monitor = require('../security/UserActivityMonitor');

var interestTableData = {
    'Arts & Entertainment': [
        'Art',
        'Culture',
        'Film',
        'Food',
        'Humor',
        'Music',
        'Photography',
        'Social Media',
        'Sports'
    ],
    'Industry': [
        'Business',
        'Economy',
        'Entrepreneurship',
        'Marketing',
        'Freelancing',
        'Productivity',
        'Work'
    ],
    'Innovation & Tech': [
        'Artificial Intelligence',
        'Cyber Security',
        'Data Science',
        'Digital Design',
        'Math',
        'NeuroScience',
        'Programming',
        'Science',
        'Software Engineering',
        'Space',
        'Technology',
        'UI/UX'
    ],
    'Life': [
        'Creativity',
        'Family',
        'Health',
        'Mental Health & Wellness',
        'Psychology',
        'Relationships',
        'Self',
        'Sexuality',
        'Spirituality',
        'Travel',
        'Wellness'
    ],
    'Society': [
        'Education',
        'Environment',
        'Future',
        'History',
        'Media',
        'Philosophy',
        'Politics',
        'World'
    ]
};

router.post('/update-checkrate', function (request, response) {
    config.getNewConnection()
        .then(function (connection) {
            connection.query('UPDATE Checks SET checkrate = (CASE WHEN (responses = "verified") THEN 2.5 ELSE 1 END)', [], function (err, data) {
                config.disconnect(connection);
                if(err){
                    console.error(err);
                    response.status(500).send(err).end();
                }
                else{
                    response.send(data).end();
                }
            });
        });
});

router.post('/send-bulk-sms', function (request, response) {

    var users = [
        {
            name: "Vishal",
            number: "9999656496"
        },
        {
            name: "Shivam",
            number: "8586904878"
        },
        {
            name: "Shivam",
            number: "8512008435"
        },
        {
            name: "Shivam",
            number: "9198697174"
        },
        {
            name: "Shivam",
            number: "8090392031"
        },
        {
            name: "Amit",
            number: "9919630078"
        },
        {
            name: "Prince",
            number: "7503370436"
        },
        {
            name: "Sanjay",
            number: "9717491076"
        },
        {
            name: "Prince",
            number: "7011582488"
        },
        {
            name: "Shivam",
            number: "8005011881"
        },
        {
            name: "Shivam",
            number: "8756479132"
        },
        {
            name: "Ashok",
            number: "9871122780"
        },
        {
            name: "Shivam",
            number: "8700760237"
        },
        {
            name: "Manorama",
            number: "7531075543"
        },
        {
            name: "Shivam",
            number: "9716280720"
        }
    ];

    var sns = new AWS.SNS();

    var params = {
        attributes : {
            DefaultSMSType : 'Transactional'
        }
    };

    async.eachSeries(users, function(user, callback){

        sns.setSMSAttributes(params, function(err, data){

            if(err){
                callback(err);
            }
            else{

                var params = {

                    Message : "Hi " + user.name + ",\nWe have noticed some unusual usage activity from your Cread account linked to this number. Please make sure that you are not using multiple accounts to use the platform. " +
                    "We appreciate following fair practices of use and we hope you do as well. Failing to do so might result in deactivation of your account. You can read more about our terms of service here: https://goo.gl/m1NFVq.\n\n" +
                    "For any queries, you can mail us at: admin@cread.in. We would like to serve you in the best possible way.\n\n" +
                    "Team Cread",
                    PhoneNumber : '+91' + user.number
                };

                console.log('sns request sending');

                sns.publish(params, function(err, data){

                    if(err){
                        callback(err);
                    }
                    else{
                        console.log(data);
                        callback();
                    }

                });
            }
        });

    }, function (err) {
        if(err){
            console.error(err);
        }
    });

    response.send('Initiated').end();

});

router.post('/lock', function (request, response) {

    var shareid = request.body.shareid;

    connection.query('UPDATE Share SET locked = ?, locked_at = NOW() WHERE shareid = ?', [true, shareid], function (err, rows) {

        if (err) {
            console.error(err);
            throw err;
        }
        else {
            response.send('Locked');
            response.end();
        }

    })

});

router.post('/emailer', function (request, response) {

    transEmail.sendTransactionEmail('SUCCESS', {
            clientname: "Avneesh",
            clientemail: "avneesh.khanna92@gmail.com"
        }, "Hello",
        {paymentid: 'random', amount: "1000"},
        {billingname: "avneesh", billingcontact: "9999"},
        function (err, data) {

            if (err) {
                console.error(err);
                response.send(err);
                response.end();
            }
            else {
                console.log(data);
                response.send(data);
                response.end();
            }

        });

});

router.post('/sql-trans-deadlock', function (request, response) {
    var name = request.body.name;
    var time = request.body.time;
    var phone = request.body.phone;
    var isErr = request.body.isErr;

    console.log("request is " + JSON.stringify(request.body, null, 3));

    config.getNewConnection()
        .then(function (connection) {

            connection.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ', null, function (err, data) {
                if(err){
                    throw err;
                }
                else{
                    connection.beginTransaction(function (err) {
                        if (err) {
                            connection.rollback(function () {
                                connection.release();
                                console.error(err);
                            });
                        }
                        else {
                            connection.query('SELECT UUID FROM users WHERE phoneNo <> ? FOR UPDATE', [phone], function (err, row) {

                                console.log('SELECT FOR UPDATE query executed ' + name +  ' with row ' + JSON.stringify(row, null, 3));

                                if (err) {
                                    connection.rollback(function () {
                                        connection.release();
                                        console.error(err);
                                    });
                                }
                                else {
                                    setTimeout(function () {
                                        connection.query('UPDATE users SET firstname = ? WHERE uuid = ?', [name, row[0].UUID], function (err, data) {

                                            console.log('UPDATE query executed ' + name);

                                            if(err){
                                                connection.rollback(function () {
                                                    connection.release();
                                                    console.error(err);
                                                });
                                            }
                                            else{
                                                connection.commit(function (err) {
                                                    if(err){
                                                        connection.rollback(function () {
                                                            connection.release();
                                                            console.error(err);
                                                        });
                                                    }
                                                    else {
                                                        connection.release();
                                                        console.log("Sending response for " + name);
                                                        response.send(data).end();
                                                    }
                                                });
                                            }
                                        });
                                    }, time);
                                }
                            });
                        }
                    });
                }
            });

        });

});

router.post('/sql-trans-commit', function (req, res) {
    var time = req.body.time;
    var phoneNo = req.body.phoneNo;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;

            connection.beginTransaction(function (err) {
                if (err) {
                    connection.rollback(function () {
                        connection.release();
                        console.error(err);
                    });
                }
                else {
                    connection.query('UPDATE users SET firstname = ? WHERE phoneNo = ?', [phoneNo + ' changed', phoneNo], function (err, data) {
                        if (err) {
                            connection.rollback(function () {
                                connection.release();
                                console.error(err);
                            });
                        }
                        else {
                            connection.commit(function (err) {
                                if (err) {
                                    connection.rollback(function () {
                                        connection.release();
                                        console.error(err);
                                    });
                                }
                                else {
                                    connection.release();
                                    console.log('/sql-trans-commit: COMMITTED');
                                    res.send('completed').end();
                                }
                            });
                        }
                    });
                }
            });

        });

});

router.post('/sql-trans-1', function (req, res) {

    var time = req.body.time;
    var rerror = req.body.rerror;
    var phoneNo = req.body.phoneNo;

    config.connectionPool.getConnection(function (err, connection) {
        if(err){
            console.error(err);
            res.send(err);
            res.end();
        }
        else{
            connection.beginTransaction(function (err) {
                if(err){
                    connection.rollback(function () {
                        connection.release();
                        console.error(err);
                    });
                }
                else{
                    connection.query('UPDATE users SET firstname = ? WHERE phoneNo = ?', [phoneNo + ' step-1', phoneNo], function (err, data) {
                        if(err){
                            connection.rollback(function () {
                                connection.release();
                                console.error(err);
                            });
                        }
                        else{

                            console.log('Step 1 executed successfully');

                            setTimeout(function () {
                                connection.query('UPDATE users SET firstname = ? WHERE phoneNo = ?', [phoneNo + ' step-2', phoneNo], function (err, data) {

                                    if(rerror){
                                        connection.rollback(function () {
                                            connection.release();
                                            console.error(new Error("Forced error"));
                                        });
                                    }
                                    else{
                                        if(err){
                                            connection.rollback(function () {
                                                connection.release();
                                                console.error(err);
                                            });
                                        }
                                        else{
                                            connection.commit(function (err) {
                                                if(err){
                                                    connection.rollback(function () {
                                                        connection.release();
                                                        console.error(err);
                                                    });
                                                }
                                                else{
                                                    connection.release();
                                                    console.log("TRANSACTION COMMITTED");
                                                    res.send('done');
                                                    res.end();
                                                }
                                            })
                                        }
                                    }
                                });
                            }, time);
                        }
                    });
                }
            });
        }
    });

    // connection.beginTransaction(function (err) {
    //     if (err) {
    //         connection.rollback(function () {
    //             // connection.release();
    //             console.error(err);
    //         });
    //     }
    //     else {
    //         connection.query('UPDATE users SET firstname = ? WHERE phoneNo = ?', [phoneNo + ' step-1', phoneNo], function (err, data) {
    //             if (err) {
    //                 connection.rollback(function () {
    //                     // connection.release();
    //                     console.error(err);
    //                 });
    //             }
    //             else {
    //
    //                 console.log('Step 1 executed successfully');
    //
    //                 setTimeout(function () {
    //                     connection.query('UPDATE users SET firstname = ? WHERE phoneNo = ?', [phoneNo + ' step-2', phoneNo], function (err, data) {
    //
    //                         if (rerror) {
    //                             connection.rollback(function () {
    //                                 // connection.release();
    //                                 console.error(new Error("Forced error"));
    //                             });
    //                         }
    //                         else {
    //                             if (err) {
    //                                 connection.rollback(function () {
    //                                     // connection.release();
    //                                     console.error(err);
    //                                 });
    //                             }
    //                             else {
    //                                 connection.commit(function (err) {
    //                                     if (err) {
    //                                         connection.rollback(function () {
    //                                             // connection.release();
    //                                             console.error(err);
    //                                         });
    //                                     }
    //                                     else {
    //                                         // connection.release();
    //                                         console.log("TRANSACTION COMMITTED");
    //                                         res.send('done');
    //                                         res.end();
    //                                     }
    //                                 })
    //                             }
    //                         }
    //                     });
    //                 }, time);
    //             }
    //         });
    //     }
    // })

});

router.post('/unlock', function (request, response) {

    var shareid = request.body.shareid;

    connection.query('UPDATE Share SET locked = ?, locked_at = ? WHERE shareid = ?', [false, null, shareid], function (err, rows) {

        if (err) {
            console.error(err);
            throw err;
        }
        else {
            response.send('Unlocked');
            response.end();
        }

    })

});

router.post('/user-details', function (request, response) {

    console.log("Request headers are " + JSON.stringify(request.headers, null, 3));
    console.log("Request body is " + JSON.stringify(request.body, null, 3));

    var params = {
        ua_string: request.header('user-agent'),
        public_ip: request.header('x-forwarded-for'),
        private_ip: request.body.private_ip_addr,
        hostemail: request.body.id
    };

    console.log("Params are " + JSON.stringify(params, null, 3));

    connection.query('INSERT INTO FbReach SET ?', params, function (err, rows) {
        if (err) {
            throw err;
        }
        else {
            response.send('Thank you for visiting');
            response.end();
        }
    });

});

router.post('/err', function (req, res) {

    connection.query('SELECT * FROM Share WHERE shareid = ?', ["abc"], function (err, data) {

        if (err) {
            console.error(err);
            throw err;
        }

        res.send(data);
        res.end();
    });

});

router.post('/upload-interests', function (request, response) {

    var values = restructureInterestList(interestTableData);

    connection.query('INSERT INTO Interests VALUES ?', [values], function (err, data) {

        if (err) {
            throw err;
        }
        else {
            response.send('Done');
            response.end();
        }

    });

});

function restructureInterestList(interestTableData) {

    var masterArr = [];

    var categories = Object.keys(interestTableData);

    categories.forEach(function (category) {

        for (var i = 0; i < interestTableData[category].length; i++) {

            masterArr.push([
                uuidGen.v4(),
                interestTableData[category][i],
                category,
                undefined,
                moment.utc().format('YYYY-MM-DD HH:mm:ss')
            ]);

        }

    });

    /*var masterArr = [];

     console.log("interestlist  is " + JSON.stringify(interestlist, null, 3));

     interestlist.forEach(function (interest) {
     var subArr = [uuid, interest];
     masterArr.push(subArr);
     });*/

    return masterArr;
}

router.post('/send-email', function (request, response) {

    var startDate = moment().format('x');

    var emails = request.body.emailaddresses;

    var ses = new AWS.SES();

    var params = {
        Destination: {
            ToAddresses: emails
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: "This message body contains HTML formatting. It can, contain links like this one: <a class=\"ulink\" href=\"http://docs.aws.amazon.com/ses/latest/DeveloperGuide\" target=\"_blank\">Amazon SES Developer Guide</a>."
                },
                Text: {
                    Charset: "UTF-8",
                    Data: "This is the message body in text format."
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: "Test email"
            }
        },
        Source: "avneesh.khanna92@gmail.com"
    };

    ses.sendEmail(params, function (err, data) {
        if (err) {  // an error occurred
            console.error(err, err.stack);
            //throw err;
        }
        else {  // successful response
            // console.log("data is " + JSON.stringify(data, null, 3));

            var stopDate = moment().format('x');

            response.send({
                startDate: startDate,
                stopDate: stopDate,
                aws: data
            });
        }


        /*
         data = {
         MessageId: "EXAMPLE78603177f-7a5433e7-8edb-42ae-af10-f0181f34d6ee-000000"
         }
         */
    });


});

module.exports = router;

