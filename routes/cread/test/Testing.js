/**
 * Created by avnee on 26-06-2017.
 */
'use strict';

var express = require('express');
var router = express.Router();

var moment = require('moment');
var uuidGen = require('uuid');
var async = require('async');
var uuidgen = require('uuid');

var gm = require('gm');

//--------------

var config = require('../../Config');
var connection = config.createConnection;

var envconfig = require('config');
var dbConfig = envconfig.get('rdsDB.dbConfig');

//--------------

var AWS = require('aws-sdk');

var transEmail = require('../dsbrd/wallet-management/TransactionEmailer');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

/*AWS.config.region = 'eu-west-1';
 AWS.config.credentials = new AWS.CognitoIdentityCredentials({
 IdentityPoolId: 'eu-west-1:d29fce0a-ac1a-4aaf-b3f6-0bc48b58b87e'
 });*/

var monitor = require('../security/UserActivityMonitor');
var feedutils = require('../feed/FeedUtils');

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

function restructureData(users) {

    var master = [];

    users.forEach(function (elem) {
        master.push([
            uuidgen.v4(),
            "405354ca-b37c-4bc5-9b19-ae6d02c0c22b",
            elem,
            moment().format('YYYY-MM-DD HH:mm:ss')
        ])
    });

    return master;
}

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

function performSearchUsers(connection, keyword) {
    console.log(keyword.split(" ").join("* ") + "*");
    return new Promise(function (resolve, reject) {
        connection.query('SELECT firstname, lastname ' +
            'FROM users ' +
            'WHERE MATCH(firstname) ' +
            'AGAINST(? IN BOOLEAN MODE)', [keyword.split(" ").join("* ") + "*"], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

router.post('/gm-test', function (request, response) {

    try{
        gm('./images/downloads/gm.jpg')
            .font('./public/fonts/ubuntu/Ubuntu-Medium.ttf')
            .drawText(50, 50, 'This is a test')
            .write('./images/downloads/gm1.jpg', function (err) {
                if (err){
                    console.error(err);
                    response.send(err).end();
                }
                else{
                    response.send('done').end();
                }
            });
    }
    catch(err){
        console.error(err);
        response.send(err).end();
    }

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

router.post('/cross-pattern-explore', function (request, response) {

    //TODO: Remove
    /*var rows = [
        {
            type: "SHORT",
            i: 0
        },
        {
            type: "CAPTURE",
            i: 1
        },
        {
            type: "CAPTURE",
            i: 2
        },
        {
            type: "CAPTURE",
            i: 3
        },
        {
            type: "SHORT",
            i: 4
        },
        {
            type: "SHORT",
            i: 5
        },
        {
            type: "CAPTURE",
            i: 6
        },
        {
            type: "SHORT",
            i: 7
        }
    ];*/
    var rows = [];

    feedutils.structureDataCrossPattern(rows)
        .then(function (rows) {
            response.send(rows);
        });

});

module.exports = router;

