/**
 * Created by avnee on 16-02-2018.
 */
'use-strict';

var async = require('async');
var notify = require('../../../notification-system/notificationFramework');

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

function restructureForBulkInsert(user_events){

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
 * This function is used to get the list of users who HAVE NOT posted anything in the last 48 hours but HAVE posted
 * something in the last 144 hours
 * */
function getRecentPosters(connection){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT DISTINCT User.uuid ' +
            'FROM Entity E ' +
            'LEFT JOIN Short S ' +
            'ON (E.entityid = S.entityid) ' +
            'LEFT JOIN Capture C ' +
            'ON (E.entityid = C.entityid) ' +
            'JOIN User U ' +
            'ON (U.uuid = S.uuid OR U.uuid = C.uuid) ' +
            'WHERE E.regdate BETWEEN DATE_SUB(NOW(), INTERVAL 144 HOURS) AND DATE_SUB(NOW(), INTERVAL 48 HOURS) ' +
            'AND E.regdate NOT BETWEEN NOW() AND DATE_SUB(NOW(), INTERVAL 48 HOURS)', [null], function (err, rows) {
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
 * collaborated in the last 144 hours. Returns only those users who are NOT included in the recentPosts list
 * */
function getRecentCollaborators(connection, recentPosters){

    var sql = 'SELECT DISTINCT User.uuid ' +
        'FROM Entity E ' +
        'LEFT JOIN Short S ' +
        'ON (E.entityid = S.entityid) ' +
        'LEFT JOIN Capture C ' +
        'ON (E.entityid = C.entityid) ' +
        'JOIN User U ' +
        'ON (U.uuid = S.uuid OR U.uuid = C.uuid) ' +
        'WHERE E.regdate BETWEEN DATE_SUB(NOW(), INTERVAL 144 HOURS) AND DATE_SUB(NOW(), INTERVAL 48 HOURS) ' +
        'AND E.regdate NOT BETWEEN NOW() AND DATE_SUB(NOW(), INTERVAL 48 HOURS) ' +
        'AND (S.capid IS NOT NULL OR C.shoid IS NOT NULL) ';

    var sqlparams = [];

    if(recentPosters && recentPosters.length > 0){
        sql += "AND U.uuid NOT IN (?)";
        sqlparams = recentPosters;
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

function getRecentInactiveUsers(connection){

}

function saveUsersToRedis(inactiveUsers){

}

function assignNotificationDataToUsers(connection, users){

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
            if(err){
                console.error(err);
            }

            //If any of the element produces an error, the elements which have been processed till now would be sent back
            //via resolve();
            resolve(notif_data_users);
        });

    });
}

function getUserSpecificDataForNotification(connection, user){

    var sql;
    var sqlparams;

    if(user.notif_category === 'CREATE'){
        //To query those unique users who have recently collaborated with the given user in the previous 144 hours
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
                'WHERE (S.capid IS NOT NULL OR C.shoid IS NOT NULL) ' +
                'AND (CC.uuid = ? OR CS.uuid = ?) ' +
                'AND S.uuid <> ? ' +
                'AND C.uuid <> ? ' +
                'AND E.regdate BETWEEN (NOW(), DATE_SUB(NOW(), INTERVAL 144 HOURS)) ' +
                'ORDER BY E.regdate DESC) AS QueriedUsers ' +
            'JOIN User ' +
            'USING(uuid)';
        sqlparams = [
            user.uuid,
            user.uuid,
            user.uuid,
            user.uuid
        ]
    }
    else if(user.notif_category === 'COLLABORATE'){
        //To query those unique users who the given user has recently collaborated with in the previous 144 hours
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
            'ON (CS.entityid = E.entityid OR CC.entityid = E.entityid) ' +
            'WHERE (S.capid IS NOT NULL OR C.shoid IS NOT NULL) ' +
            'AND (C.uuid = ? OR S.uuid = ?) ' +
            'AND CS.uuid <> ? ' +
            'AND CC.uuid <> ? ' +
            'AND E.regdate BETWEEN (NOW(), DATE_SUB(NOW(), INTERVAL 144 HOURS)) ' +
            'ORDER BY E.regdate DESC) AS QueriedUsers ' +
            'JOIN User ' +
            'USING(uuid)';
        sqlparams = [
            user.uuid,
            user.uuid,
            user.uuid,
            user.uuid
        ]
    }

    return new Promise(function (resolve, reject) {
        connection.query(sql, [sqlparams], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                var notifData = {
                    persistable: "No",
                    category: "engagement-notification"
                };

                if(rows.length === 0){  //No queried users exist
                    if(user.notif_category === 'CREATE'){
                        notifData.message = "You have'nt posted in a while recently. You might want to check out the recent artwork on Cread";
                    }
                    else if(user.notif_category === 'COLLABORATE'){
                        notifData.message = "You have'nt collaborated with anyone recently. You might want to check out the recent artwork on Cread";
                    }
                }
                else{   //Queried users exist
                    if(user.notif_category === 'CREATE'){
                        notifData.message = "You have'nt posted in a while recently. " + rows[0].firstname + " and " + rows.length + " others might like to collaborate with you";
                    }
                    else if(user.notif_category === 'COLLABORATE'){
                        notifData.message = rows[0].firstname + " and " + rows.length + " others posted on Cread recently. You might want to check it out";
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
            if(err){
                console.error(err);
                resolve('Notification sent to only SOME users due to an error');
            }
            else{
                resolve('Notification sent to ALL users');
            }
        })
    });
}

module.exports = {
    saveUserEvents: saveUserEvents,
    getRecentPosters: getRecentPosters,
    getRecentCollaborators: getRecentCollaborators,
    getRecentInactiveUsers: getRecentInactiveUsers,
    assignNotificationDataToUsers: assignNotificationDataToUsers,
    sendCustomNotificationEachUser: sendCustomNotificationEachUser
};