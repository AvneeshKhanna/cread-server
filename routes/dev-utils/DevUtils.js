/**
 * Created by avnee on 16-07-2017.
 */

/**
 * File which contains functions to perform back-end related tasks which don't have a direct implication on the product
 * */

var express = require('express');
var router = express.Router();

var config = require('../Config');

var request_client = require('request');
var async = require('async');

var chatconvoutils = require('../cread/chat/ChatConversationUtils');

var hrkuapptoken = '11abc5c3-dd3f-4d62-86df-9061a4c32e2d';
var hrkuappname = 'cread-dev-remote';

var notify = require('../notification-system/notificationFramework');
var utils = require('../cread/utils/Utils');

router.get('/restart-heroku', function (request, response) {

    request_client.delete({
        url: 'https://api.heroku.com/apps/' + hrkuappname + '/dynos/',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.heroku+json; version=3',
            'Authorization': 'Bearer ' + hrkuapptoken
        }
    }, function (err, res, body) {

        if (err) {
            response.status(500).send(err).end();
        }
        else {
            response.send('Heroku server restarted successfully').end();
        }

    });

});

/**
 * Created to test sending of notification to particular device tokens in development environment
 * */
router.post('/send-notification', function (request, response) {

    var fcmtokens = request.body.fcmtokens;
    var payload = request.body.payload;

    if (config.envtype === 'DEVELOPMENT') {
        if (!(payload instanceof Object)) {
            response.status(500).send({
                message: "Parameter payload should be of the type Object/Map"
            });
            response.end();
            return;
        }
        else if (!(fcmtokens instanceof Array)) {
            response.status(500).send({
                message: "Parameter fcmtokens should be of the type Array/List"
            });
            response.end();
            return;
        }
        else if (fcmtokens.length === 0) {
            response.status(500).send({
                message: "Parameter fcmtokens cannot be empty"
            });
            response.end();
            return;
        }
        else {

            notify.notifyTokens(fcmtokens, payload, function (err) {
                if (err) {
                    response.status(500).send(err);
                    response.end();
                }
                else {
                    response.status(200).send({
                        message: "notification sent"
                    });
                    response.end();
                }
            });

        }
    }
    else {
        response.status(403).send({
            message: "You are not authorised to perform this task"
        });
        response.end();
    }

});

router.get('/get-active-connections', function (request, response) {
    response.status(200).send({
        connections: chatconvoutils.connectedusers
    });
    response.end();
});

/**
 * Endpoint to send a chat message to all users from Cread Kalakaar's profile
 * */
router.post('/send-chat-msg-ckalakaar', function (request, response) {

    var message_body = request.body.message_body;
    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;

            return new Promise(function (resolve, reject) {
                connection.query('SELECT User.uuid, Chat.chatid ' +
                    'FROM User ' +
                    'JOIN Chat ' +
                    'ON (Chat.acceptor_id = User.uuid) ' +
                    'WHERE User.uuid <> ? ' +
                    'AND Chat.initiator_id = ?', [config.getCreadKalakaarUUID(), config.getCreadKalakaarUUID()], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(rows);
                    }
                });
            });

        })
        .then(function (users_data) {
            response.status(200).send("Process initiated").end();
            return sendAllChatMessageFromCreadKalakaar(connection, users_data, message_body);
        })
        .then(function () {
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

function sendAllChatMessageFromCreadKalakaar(connection, users_data, message_body) {
    return new Promise(function (resolve, reject) {
        async.eachSeries(users_data, function (user_data, callback) {
            utils.beginTransaction(connection)
                .then(function () {
                    return chatconvoutils.sendChatMessageFromCreadKalakaar(connection, user_data, message_body);
                })
                .then(function () {
                    callback();
                })
                /*.then(function () {
                    setTimeout(function () {
                        callback();
                    }, 1000);
                })*/
                .catch(function (err) {
                    callback(err);
                })
        }, function (err) {
            if (err) {
                utils.rollbackTransaction(connection, undefined, err)
                    .catch(function (err) {
                        reject(err);
                    });
            }
            else {
                utils.commitTransaction(connection)
                    .then(function () {
                        resolve();
                    })
                    .catch(function (err) {
                        utils.rollbackTransaction(connection, undefined, err)
                            .catch(function (err) {
                                reject(err);
                            });
                    });
            }
        })
    });
}

module.exports = router;