/**
 * Created by avnee on 16-02-2018.
 */
'use-strict';

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

module.exports = {
    saveUserEvents: saveUserEvents,
    getRecentPosters: getRecentPosters,
    getRecentCollaborators: getRecentCollaborators,
    getRecentInactiveUsers: getRecentInactiveUsers
};