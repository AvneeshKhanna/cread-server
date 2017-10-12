/**
 * Method to send a notification to users in batches of 1000 (because of FCM limit)
 * */

var dynamo_marshal = require('dynamodb-marshaler');    //package to convert plain JS/JSON objects to DynamoDB JSON
var AWS = require('aws-sdk');
var gcm = require('node-gcm');

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff'
});

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var docClient = new AWS.DynamoDB.DocumentClient();

/**
 * Function to call the AWS SNS API to send push notifications to users using FCM Tokens
 * */
function sendNotification(data, cities, callback) {

    getTokens(cities, function (registrationTokens) {
        if (registrationTokens.length === 0) {
            callback();
        }
        else {
            // var message = new gcm.Message();
            var message = new gcm.Message({
                data: data
            });

            var sender = new gcm.Sender('AIzaSyDUbtCYGKI-kLl7oSVQoW_sZqo2VZBFeKQ');

            const batchsize = 1000;  //FCM limits the no of users to 1,000 which can be sent a notification in one-go

            batchTokenHandler(registrationTokens, batchsize, 0, sender, message, function (err) {
                callback(err);
            });
        }
    });
}

/**
 * Function to get the FCM Tokens of all the users from the DynamoDB table. An optional city filter is also catered
 * */
function getTokens(cities, callback) {
    var table = userstbl_ddb;

    var params = {
        TableName: table,
        AttributesToGet: ['Fcm_token']
    };

    if (cities !== undefined) {

        params.ScanFilter = {
            City: {
                ComparisonOperator: 'IN', /* required */
                AttributeValueList: cities
            }
        }
    }

    console.log(JSON.stringify(params, null, 3));

    docClient.scan(params, function (error, data) {
        if (error) throw error;

        console.log('Data from DynamoDB scan is ' + JSON.stringify(data, null, 3));
        var fcmTokens = pushTokens(data.Items);
        /*var fcmTokens = data.Items.reduce(
            function (a, b) {
                return a.concat(b);
            }, []);*/
        callback(fcmTokens);
    });
}

/**
 * Function to formulate an array of FCM Tokens as received using getTokens(cities, callback) function
 * */
function pushTokens(tokens) {

    var finalTokens = [];

    for (var j = 0; j < tokens.length; j++) {
        for (var z = 0; z < tokens[j].Fcm_token.length; z++) {
            finalTokens.push(tokens[j].Fcm_token[z]);
        }
    }

    return finalTokens;
}

/**
 Method to send notification to FCM tokens in a batch using recursive loop
 */
function batchTokenHandler(tokens, batchsize, counter, sender, message, callback) {

    function recursive(tokens, batchsize, counter, sender, message, toRepeat) {

        if (toRepeat) {
            var iterations = Math.floor(tokens.length / batchsize) + ((tokens.length % batchsize) !== 0 ? 1 : 0);
            console.log('No of tokens are ' + tokens.length);
            console.log('No of iterations are ' + JSON.stringify(iterations, null, 3));

            if (counter === (iterations - 1)) { //Last iteration
                var lastitemindex = tokens.length;
            }
            else {
                var lastitemindex = batchsize * (counter + 1);
            }

            var batchtokens = tokens.slice(batchsize * counter, lastitemindex);
            console.log('Batch ' + (counter + 1) + ' is ' + JSON.stringify(batchtokens, null, 3));

            sender.send(message, {registrationTokens: batchtokens}, 3, function (err, res) {

                if (err) {
                    callback(err);
                }
                else {
                    if (counter === (iterations - 1)) {
                        recursive(tokens, batchsize, counter, sender, message, false);
                    }
                    else {
                        counter++;
                        recursive(tokens, batchsize, counter, sender, message, true);
                    }
                }

            });
        }
        else {
            callback();
        }

    }

    recursive(tokens, batchsize, counter, sender, message, true);
}

module.exports.sendNotification = sendNotification;