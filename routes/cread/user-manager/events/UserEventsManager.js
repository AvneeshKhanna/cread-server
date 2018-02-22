/**
 * Created by avnee on 16-02-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

var usereventsutils = require('./UserEventsUtils');

var moment = require('moment');

router.post('/save', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var user_events = request.body.user_events;

    user_events.map(function (event) {
        event.regdate = moment(event.regdate, moment.ISO_8601).utc().format('YYYY-MM-DD HH:mm:ss');
        return event;
    });

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            if(user_events.length > 0){
                return usereventsutils.saveUserEvents(connection, user_events);
            }
            else{
                console.log('No user events present');
            }
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
            config.disconnect(connection);
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        })

});

function sendEngagementNotificationsForUsers(){

    var connection;
    var allUsers = [];

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return usereventsutils.getRecentPosters(connection);
        })
        .then(function (recentPosters) {

            recentPosters.forEach(function (recentPoster) {
                allUsers.push({
                    uuid: recentPoster,
                    notif_category: 'CREATE'
                });
            });

            return usereventsutils.getRecentCollaborators(connection, recentPosters);
        })
        .then(function (recentCollaborators) {

            recentCollaborators.forEach(function (recentCollaborator) {
                allUsers.push({
                    uuid: recentCollaborator,
                    notif_category: 'COLLABORATE'
                });
            });

            if(allUsers.length > 0){
                return usereventsutils.assignNotificationDataToUsers(connection, allUsers);
            }
            else{
                console.log('No users to send notification to');
                throw new BreakPromiseChainError();
            }
        })
        .then(function (notif_data_users) {
            if(notif_data_users.length > 0){
                return usereventsutils.sendCustomNotificationEachUser(notif_data_users);
            }
            else {
                console.log('No notification data for users');
            }
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            console.error(err);
        });

}

module.exports = router;