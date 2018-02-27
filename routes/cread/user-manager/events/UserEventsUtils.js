/**
 * Created by avnee on 16-02-2018.
 */
'use-strict';

var async = require('async');

var config = require('../../../Config');
var notify = require('../../../notification-system/notificationFramework');

var time_range = {};
var time_unit;

if (config.envtype === 'PRODUCTION') {

    time_range = {
        min: 48,
        max: 144
    };

    time_unit = 'HOUR';
}
else {
    time_range = {
        min: 48,
        max: 168
    };

    time_unit = 'HOUR';
}

const friends_activity_cutoff_time = 168;
const friends_activity_cutoff_time_unit = 'HOUR';

const NOTIFICATION_CATEGORY_CREATE = "CREATE";
const NOTIFICATION_CATEGORY_COLLABORATE = "COLLABORATE";
const NOTIFICATION_CATEGORY_ENTITY_VIEW = "ENTITY_VIEW";

function saveUserEvents(connection, user_events) {
    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO UserEvents (actor_uuid, entityid, event_type, regdate) VALUES ?', [restructureForBulkInsert(user_events)], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function restructureForBulkInsert(user_events) {

    var masterArr = [];

    user_events.forEach(function (event) {

        var subArr = [
            event['actor_uuid'],
            event['entityid'],
            event['event_type'],
            event['regdate']
        ];

        masterArr.push(subArr);
    });

    return masterArr;
}

/**
 * Initiates the process of engagement notifications for all users on the app
 * */
function sendEngagementNotificationsForUsers(){

    var connection;
    var allUsers = [];

    return new Promise(function (resolve, reject) {
        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return getRecentCollaborators(connection);
            })
            .then(function (recentCollaborators) {

                recentCollaborators.forEach(function (recentCollaborator) {
                    allUsers.push({
                        uuid: recentCollaborator,
                        notif_category: NOTIFICATION_CATEGORY_COLLABORATE
                    });
                });

                return getRecentPosters(connection, recentCollaborators);
            })
            .then(function (recentPosters) {

                recentPosters.forEach(function (recentPoster) {
                    allUsers.push({
                        uuid: recentPoster,
                        notif_category: NOTIFICATION_CATEGORY_CREATE
                    });
                });

                return getRecentInactiveUsers(connection, allUsers);

                /*if(allUsers.length > 0){
                    return usereventsutils.assignNotificationDataToUsers(connection, allUsers);
                }
                else{
                    console.log('No users to send notification to');
                    throw new BreakPromiseChainError();
                }*/
            })
            .then(function (inactiveUsers) {

                inactiveUsers.forEach(function (inactiveUser) {
                    allUsers.push({
                        uuid: inactiveUser,
                        notif_category: NOTIFICATION_CATEGORY_ENTITY_VIEW
                    });
                });

                if(allUsers.length > 0){
                    return assignNotificationDataToUsers(connection, allUsers);
                }
                else{
                    console.log('No users to send notification to');
                    throw new BreakPromiseChainError();
                }
            })
            /*.then(function (recentCollaborators) {

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
            })*/
            .then(function (notif_data_users) {
                if(notif_data_users.length > 0){
                    return sendCustomNotificationEachUser(notif_data_users);
                }
                else {
                    console.log('No notification data for users');
                }
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if(err instanceof BreakPromiseChainError){
                    //Do nothing
                    resolve();
                }
                else{
                    reject(err);
                }
            });
    })
}

/**
 * This function is used to get the list of users who HAVE NOT posted anything in the last 48 hours but HAVE posted
 * something in the last 144 hours. Returns only those users who are NOT included in the recentCollaborators list
 * */
function getRecentPosters(connection, recentCollaborators) {

    var sql = 'SELECT DISTINCT U.uuid ' +
        'FROM Entity E ' +
        'LEFT JOIN Short S ' +
        'ON (E.entityid = S.entityid) ' +
        'LEFT JOIN Capture C ' +
        'ON (E.entityid = C.entityid) ' +
        'JOIN User U ' +
        'ON (U.uuid = S.uuid OR U.uuid = C.uuid) ' +
        'WHERE E.regdate BETWEEN DATE_SUB(NOW(), INTERVAL ? ' + time_unit + ') AND DATE_SUB(NOW(), INTERVAL ? ' + time_unit + ') ' +
        'AND E.regdate NOT BETWEEN NOW() AND DATE_SUB(NOW(), INTERVAL ? ' + time_unit + ')';

    var sqlparams = [
        time_range.max,
        time_range.min,
        time_range.min
    ];

    if(recentCollaborators && recentCollaborators.length > 0){
        sql += "AND U.uuid NOT IN (?)";
        sqlparams.push(recentCollaborators);
    }

    return new Promise(function (resolve, reject) {
        connection.query(sql, sqlparams, function (err, rows) {

            if (err) {
                reject(err);
            }
            else {
                resolve(rows.map(function (row) {
                    return row.uuid;
                }));
            }
        });
    });
}

/**
 * This function is used to get the list of users who HAVE NOT collaborated with anyone in the last 48 hours but HAVE
 * collaborated in the last 144 hours.
 * */
function getRecentCollaborators(connection) {

    return new Promise(function (resolve, reject) {
        connection.query('SELECT DISTINCT U.uuid ' +
            'FROM Entity E ' +
            'LEFT JOIN Short S ' +
            'ON (E.entityid = S.entityid) ' +
            'LEFT JOIN Capture C ' +
            'ON (E.entityid = C.entityid) ' +
            'JOIN User U ' +
            'ON (U.uuid = S.uuid OR U.uuid = C.uuid) ' +
            'WHERE E.regdate BETWEEN DATE_SUB(NOW(), INTERVAL ? ' + time_unit + ') AND DATE_SUB(NOW(), INTERVAL ? ' + time_unit + ') ' +
            'AND E.regdate NOT BETWEEN NOW() AND DATE_SUB(NOW(), INTERVAL ? ' + time_unit + ') ' +
            'AND (S.capid IS NOT NULL OR C.shoid IS NOT NULL) ', [
            time_range.max,
            time_range.min,
            time_range.min], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows.map(function (row) {
                    return row.uuid;
                }));
            }
        });
    });
}

/**
 * Returns the list of users who HAVE NOT been active on the app recently in any way in the past 48 hours but HAVE been active
 * in the past 144 hours
 * */
function getRecentInactiveUsers(connection, previousUsers) {

    var sql = 'SELECT DISTINCT actor_uuid AS uuid ' +
        'FROM UserEvents ' +
        'WHERE regdate BETWEEN DATE_SUB(NOW(), INTERVAL ? ' + time_unit + ') AND DATE_SUB(NOW(), INTERVAL ? ' + time_unit + ') ' +
        'AND regdate NOT BETWEEN NOW() AND DATE_SUB(NOW(), INTERVAL ? ' + time_unit + ') ';

    var sqlparams = [
        time_range.max,
        time_range.min,
        time_range.min
    ];

    if(previousUsers && previousUsers.length > 0){
        sql += 'AND actor_uuid NOT IN (?)';
        sqlparams.push(previousUsers);
    }

    return new Promise(function (resolve, reject) {
        connection.query(sql, sqlparams, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows.map(function (row) {
                    return row.uuid;
                }));
            }
        });
    });

}

function assignNotificationDataToUsers(connection, users) {

    var notif_data_users = [];

    return new Promise(function (resolve, reject) {

        async.each(users, function (user, callback) {

            getUserSpecificDataForNotification(connection, user)
                .then(function (result) {
                    notif_data_users.push(result);
                    callback();
                })
                .catch(function (err) {
                    callback(err);
                });

        }, function (err) {
            if (err) {
                console.error(err);
            }

            //If any of the element produces an error, the elements which have been processed till now would be sent back
            //via resolve();
            resolve(notif_data_users);
        });

    });
}

function getUserSpecificDataForNotification(connection, user) {

    var sql;
    var sqlparams;

    if (user.notif_category === NOTIFICATION_CATEGORY_CREATE) {
        //To query those unique USERS WHO HAVE RECENTLY COLLABORATED WITH the given user in the previous 144 hours
        sql = 'SELECT QueriedUsers.uuid, User.firstname ' +
            'FROM ' +
            '(SELECT DISTINCT U.uuid ' +
            'FROM User U ' +
            'LEFT JOIN Short S ' +
            'ON (U.uuid = S.uuid) ' +
            'LEFT JOIN Capture C ' +
            'ON (U.uuid = C.uuid) ' +
            'LEFT JOIN Short CS ' +
            'ON (C.shoid = CS.shoid) ' +
            'LEFT JOIN Capture CC ' +
            'ON (S.capid = CC.capid) ' +
            'LEFT JOIN Entity E ' +
            'ON (S.entityid = E.entityid OR C.entityid = E.entityid) ' +
            'WHERE E.status = "ACTIVE" ' +
            'AND (S.capid IS NOT NULL OR C.shoid IS NOT NULL) ' +
            'AND (CC.uuid = ? OR CS.uuid = ?) ' +
            'AND S.uuid <> ? ' +
            'AND C.uuid <> ? ' +
            'AND E.regdate BETWEEN DATE_SUB(NOW(), INTERVAL ? ' + friends_activity_cutoff_time_unit + ') AND NOW() ' +
            'ORDER BY E.regdate DESC) AS QueriedUsers ' +
            'JOIN User ' +
            'USING(uuid)';
        sqlparams = [
            user.uuid,
            user.uuid,
            user.uuid,
            user.uuid,
            friends_activity_cutoff_time
        ]
    }
    else if (user.notif_category === NOTIFICATION_CATEGORY_COLLABORATE) {
        //To query those unique USERS WHO THE GIVEN USER HAS RECENTLY COLLABORATED WITH in the previous 144 hours
        sql = 'SELECT QueriedUsers.uuid, User.firstname ' +
            'FROM ' +
            '(SELECT DISTINCT CU.uuid ' +
            'FROM User U ' +
            'LEFT JOIN Short S ' +
            'ON (U.uuid = S.uuid) ' +
            'LEFT JOIN Capture C ' +
            'ON (U.uuid = C.uuid) ' +
            'LEFT JOIN Short CS ' +
            'ON (C.shoid = CS.shoid) ' +
            'LEFT JOIN Capture CC ' +
            'ON (S.capid = CC.capid) ' +
            'LEFT JOIN User CU ' +
            'ON (CU.uuid = CS.uuid OR CU.uuid = CC.uuid) ' +
            'LEFT JOIN Entity E ' +
            'ON (CS.entityid = E.entityid OR CC.entityid = E.entityid) ' +
            'WHERE (S.capid IS NOT NULL OR C.shoid IS NOT NULL) ' +
            'AND (C.uuid = ? OR S.uuid = ?) ' +
            'AND CS.uuid <> ? ' +
            'AND CC.uuid <> ? ' +
            'AND E.regdate BETWEEN DATE_SUB(NOW(), INTERVAL ? ' + friends_activity_cutoff_time_unit + ') AND NOW() ' +
            'ORDER BY E.regdate DESC) AS QueriedUsers ' +
            'JOIN User ' +
            'USING(uuid)';
        sqlparams = [
            user.uuid,
            user.uuid,
            user.uuid,
            user.uuid,
            friends_activity_cutoff_time
        ]
    }
    else if(user.notif_category === NOTIFICATION_CATEGORY_ENTITY_VIEW){
        sql = 'SELECT U.uuid, U.firstname ' +
            'FROM Entity E ' +
            'LEFT JOIN Short S ' +
            'ON (S.entityid = E.entityid) ' +
            'LEFT JOIN Capture C ' +
            'ON (C.entityid = E.entityid) ' +
            'JOIN User U ' +
            'ON (U.uuid = S.uuid OR U.uuid = C.uuid) ' +
            'WHERE E.status = "ACTIVE" ' +
            'AND U.uuid <> ? ' +
            'AND E.regdate BETWEEN NOW() AND DATE_SUB(NOW(), INTERVAL ? ' + friends_activity_cutoff_time_unit + ') ' +
            'GROUP BY U.uuid ' +
            'LIMIT 20';
        sqlparams = [
            user.uuid,
            friends_activity_cutoff_time
        ]
    }

    return new Promise(function (resolve, reject) {
        connection.query(sql, sqlparams, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                var notifData = {
                    persistable: "No",
                    category: "engagement-notification"
                };

                if (rows.length === 0) {  //No queried users exist
                    if (user.notif_category === NOTIFICATION_CATEGORY_CREATE) {
                        notifData.message = "You have not posted in a while recently. You might want to check out the recent artwork on Cread";
                    }
                    else if (user.notif_category === NOTIFICATION_CATEGORY_COLLABORATE) {
                        notifData.message = "You have not collaborated with anyone recently. You might want to check out the recent artwork on Cread";
                    }
                    else if (user.notif_category === NOTIFICATION_CATEGORY_ENTITY_VIEW){
                        notifData.message = "Some interesting new content is available on Cread. You might want to check out";
                    }
                }
                else {   //Queried users exist
                    if (user.notif_category === NOTIFICATION_CATEGORY_CREATE) {
                        console.log("notification create rows are " + JSON.stringify(rows, null, 3));
                        notifData.message = rows[0].firstname + (rows[1] ? ", " + rows[1].firstname : "") + " and " + rows.length + " others might like to collaborate with you";
                    }
                    else if (user.notif_category === NOTIFICATION_CATEGORY_COLLABORATE) {
                        console.log("notification collaborate rows are " + JSON.stringify(rows, null, 3));
                        notifData.message = rows[0].firstname + (rows[1] ? ", " + rows[1].firstname : "") + " and " + rows.length + " others posted on Cread recently. You might want to check it out";
                    }
                    else if (user.notif_category === NOTIFICATION_CATEGORY_ENTITY_VIEW){
                        console.log("notification entity-view rows are " + JSON.stringify(rows, null, 3));
                        notifData.message = rows[0].firstname + (rows[1] ? ", " + rows[1].firstname : "") + " and " + rows.length + " others have posted something new on Cread recently. You might want to check it out";
                    }
                }

                resolve({
                    uuid: user.uuid,
                    notif_data: notifData
                });
            }
        });
    });
}

function sendCustomNotificationEachUser(notif_data_users) {
    return new Promise(function (resolve, reject) {
        async.eachSeries(notif_data_users, function (notif_data_user, callback) {
            notify.notificationPromise(new Array(notif_data_user.uuid), notif_data_user.notif_data)
                .then(function () {
                    callback();
                })
                .catch(function (err) {
                    callback(err);
                });
        }, function (err) {
            if (err) {
                console.log('Notification sent to only SOME users due to an error');
                reject(err);
            }
            else {
                resolve('Notification sent to ALL users');
            }
        })
    });
}

module.exports = {
    saveUserEvents: saveUserEvents,/*
    getRecentPosters: getRecentPosters,
    getRecentCollaborators: getRecentCollaborators,
    getRecentInactiveUsers: getRecentInactiveUsers,
    assignNotificationDataToUsers: assignNotificationDataToUsers,
    sendCustomNotificationEachUser: sendCustomNotificationEachUser,*/
    sendEngagementNotificationsForUsers: sendEngagementNotificationsForUsers/*,
    NOTIFICATION_CATEGORY_CREATE: NOTIFICATION_CATEGORY_CREATE,
    NOTIFICATION_CATEGORY_COLLABORATE: NOTIFICATION_CATEGORY_COLLABORATE,
    NOTIFICATION_CATEGORY_ENTITY_VIEW: NOTIFICATION_CATEGORY_ENTITY_VIEW*/
};