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
    user_events.forEach(function (event) {
        event = new Array(event);
        return event;
    });

    return user_events;
}

module.exports = {
    saveUserEvents: saveUserEvents
};