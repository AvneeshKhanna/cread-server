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

module.exports = {
    saveUserEvents: saveUserEvents
};