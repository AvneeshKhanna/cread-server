/**
 * Created by avnee on 26-06-2017.
 */
'use strict';

var express = require('express');
var router = express.Router();

var moment = require('moment');
var uuidGen = require('uuid');

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

router.post('/monitor-user', function (request, response) {

    monitor.checkForMultipleAccOnDevice();
    response.send("Done").end();

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

router.post('/sql-trans-1', function (req, res) {

    var time = req.body.time;
    var rerror = req.body.rerror;
    var phoneNo = req.body.phoneNo;

    // pool.getConnection(function (err, connection) {
    //     if(err){
    //         console.error(err);
    //         res.send(err);
    //         res.end();
    //     }
    //     else{
    //         connection.beginTransaction(function (err) {
    //             if(err){
    //                 connection.rollback(function () {
    //                     connection.release();
    //                     console.error(err);
    //                 });
    //             }
    //             else{
    //                 connection.query('UPDATE users SET firstname = ? WHERE phoneNo = ?', [phoneNo + ' step-1', phoneNo], function (err, data) {
    //                     if(err){
    //                         connection.rollback(function () {
    //                             connection.release();
    //                             console.error(err);
    //                         });
    //                     }
    //                     else{
    //
    //                         console.log('Step 1 executed successfully');
    //
    //                         setTimeout(function () {
    //                             connection.query('UPDATE users SET firstname = ? WHERE phoneNo = ?', [phoneNo + ' step-2', phoneNo], function (err, data) {
    //
    //                                 if(rerror){
    //                                     connection.rollback(function () {
    //                                         connection.release();
    //                                         console.error(new Error("Forced error"));
    //                                     });
    //                                 }
    //                                 else{
    //                                     if(err){
    //                                         connection.rollback(function () {
    //                                             connection.release();
    //                                             console.error(err);
    //                                         });
    //                                     }
    //                                     else{
    //                                         connection.commit(function (err) {
    //                                             if(err){
    //                                                 connection.rollback(function () {
    //                                                     connection.release();
    //                                                     console.error(err);
    //                                                 });
    //                                             }
    //                                             else{
    //                                                 connection.release();
    //                                                 console.log("TRANSACTION COMMITTED");
    //                                                 res.send('done');
    //                                                 res.end();
    //                                             }
    //                                         })
    //                                     }
    //                                 }
    //                             });
    //                         }, time);
    //                     }
    //                 });
    //             }
    //         });
    //     }
    // })

    connection.beginTransaction(function (err) {
        if(err){
            connection.rollback(function () {
                // connection.release();
                console.error(err);
            });
        }
        else{
            connection.query('UPDATE users SET firstname = ? WHERE phoneNo = ?', [phoneNo + ' step-1', phoneNo], function (err, data) {
                if(err){
                    connection.rollback(function () {
                        // connection.release();
                        console.error(err);
                    });
                }
                else{

                    console.log('Step 1 executed successfully');

                    setTimeout(function () {
                        connection.query('UPDATE users SET firstname = ? WHERE phoneNo = ?', [phoneNo + ' step-2', phoneNo], function (err, data) {

                            if(rerror){
                                connection.rollback(function () {
                                    // connection.release();
                                    console.error(new Error("Forced error"));
                                });
                            }
                            else{
                                if(err){
                                    connection.rollback(function () {
                                        // connection.release();
                                        console.error(err);
                                    });
                                }
                                else{
                                    connection.commit(function (err) {
                                        if(err){
                                            connection.rollback(function () {
                                                // connection.release();
                                                console.error(err);
                                            });
                                        }
                                        else{
                                            // connection.release();
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
    })

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

