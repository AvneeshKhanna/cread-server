/**
 * Created by avnee on 25-07-2018.
 */
'use-strict';

let badgeutils = require('../../badges/BadgeUtils');
const badgenames = require('../../utils/Constants').badgenames;

/**
 * Creates a new entry into UserAnalytics table
 * */
function createUserAnalyticsRecord(connection, uuid) {
    return new Promise((resolve, reject) => {

        let sqlparams = {
            uuid: uuid
        };

        connection.query("INSERT INTO UserAnalytics SET ?", [sqlparams], (err, rows) => {
            if(err){
                reject(err);
            }
            else{
                resolve();
            }
        });
    });
}

function updateUserTotalPosts(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO UserAnalytics (uuid, total_uploads) ' +
            'SELECT uuid, user_posts ' +
            'FROM ' +
                '(SELECT U.uuid, COUNT(E.entityid) AS user_posts ' +
                'FROM User U ' +
                'LEFT JOIN Entity E ' +
                'ON(U.uuid = E.uuid AND E.status = "ACTIVE") ' +
                'WHERE U.uuid = ? ' +
                'GROUP BY U.uuid) AS UP ' +
            'ON DUPLICATE KEY ' +
            'UPDATE total_uploads = UP.user_posts', [uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "total_uploads", uuid);
                    })
                    .then((value) => {
                        if(value === 1){
                            badgeutils.sendBadgeNotification(uuid, badgenames.FIRST_POST)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }
        });
    });
}

/**
 * Function to update the number of times a user has become a featured artist
 * */
function updateUserFeaturedCount(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query("INSERT INTO UserAnalytics (uuid, featured) " +
            "SELECT uuid, fcount " +
            "FROM (" +
                "SELECT U.uuid, COUNT(F.uuid) AS fcount " +
                "FROM User U " +
                "LEFT JOIN FeaturedArtists F " +
                "USING(uuid) " +
                "WHERE U.uuid = ?" +
                "GROUP BY U.uuid) FA " +
            "ON DUPLICATE KEY " +
            "UPDATE featured = FA.fcount", [uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "featured", uuid);
                    })
                    .then((value) => {
                        if(value === 1){
                            badgeutils.sendBadgeNotification(uuid, badgenames.FEATURED_ONCE)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }

        });
    });
}

/**
 * Function to update UserAnalytics table whether a user has been featured 3 times consecutively or not
 * */
function updateUserFeaturedCountConsec(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query("INSERT INTO UserAnalytics (uuid, featured_3_consctve) " +
            "SELECT FC.uuid, FC.f_consec_status " +
            "FROM (" +
                "SELECT U.uuid, CASE WHEN FSQ.consec_count IS NULL THEN false ELSE true END AS f_consec_status " +
                "FROM User U " +
                "LEFT JOIN (" +
                    "SELECT FA.uuid, COUNT(FA.featured_id) AS consec_count " +
                    "FROM FeaturedArtists FA " +
                    "WHERE FA.uuid = ? " +
                    "GROUP BY UNIX_TIMESTAMP(FA.regdate) DIV (3*24*60*60), FA.uuid " +
                    "HAVING consec_count >= 3 " +
                    "LIMIT 1) FSQ " +
                "USING(uuid) " +
                "WHERE U.uuid = ?) AS FC " +
            "ON DUPLICATE KEY " +
            "UPDATE featured_3_consctve = FC.f_consec_status", [uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                //TODO: Notification system
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(resolve, reject);
            }

        });
    });
}

function updateUserCommentsGiven(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, comment_given) ' +
            'SELECT uuid, comment_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(C.commid) AS comment_count ' +
                'FROM User U ' +
                'LEFT JOIN Comment C ' +
                'ON (C.uuid = U.uuid) ' +
                'LEFT JOIN Entity E ' +
                'ON(E.entityid = C.entityid AND E.uuid <> ?) ' +
                'WHERE U.uuid = ? ' +
                'GROUP BY U.uuid) AS CG ' +
            'ON DUPLICATE KEY ' +
            'UPDATE comment_given = CG.comment_count', [uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "comment_given", uuid);
                    })
                    .then((value) => {
                        if(value === 30){
                            badgeutils.sendBadgeNotification(uuid, badgenames.COMMENT_GIVEN)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }
        });
    });
}

function updateUserCommentsReceived(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, comment_received) ' +
            'SELECT uuid, comment_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(C.commid) AS comment_count ' +
                'FROM User U ' +
                'LEFT JOIN Entity E ' +
                'ON(U.uuid = E.uuid AND E.status = "ACTIVE") ' +
                'LEFT JOIN Comment C ' +
                'ON(C.entityid = E.entityid AND C.uuid <> ?) ' +
                'WHERE U.uuid = ? ' +
                'GROUP BY U.uuid) AS CR ' +
            'ON DUPLICATE KEY ' +
            'UPDATE comment_received = CR.comment_count', [uuid, uuid], (err, rows) => {
            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "comment_received", uuid);
                    })
                    .then((value) => {
                        if(value === 15){
                            badgeutils.sendBadgeNotification(uuid, badgenames.COMMENT_RECEIVED)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }
        });
    });
}

function updateUserHatsoffGiven(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, hatsoff_given) ' +
            'SELECT uuid, hatsoff_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(H.hoid) AS hatsoff_count ' +
                'FROM User U ' +
                'LEFT JOIN HatsOff H ' +
                'ON(U.uuid = H.uuid) ' +
                'LEFT JOIN Entity E ' +
                'ON(E.entityid = H.entityid AND E.uuid <> ?) ' +
                'WHERE U.uuid = ? ' +
                'GROUP BY U.uuid) AS HG ' +
            'ON DUPLICATE KEY ' +
            'UPDATE hatsoff_given = HG.hatsoff_count', [uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "hatsoff_given", uuid);
                    })
                    .then((value) => {
                        if(value === 50){
                            badgeutils.sendBadgeNotification(uuid, badgenames.HATSOFF_GIVEN)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }
        });
    });
}

function updateUserHatsoffsReceived(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, hatsoff_received) ' +
            'SELECT uuid, hatsoff_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(H.hoid) AS hatsoff_count ' +
                'FROM User U ' +
                'LEFT JOIN Entity E ' +
                'ON(U.uuid = E.uuid AND E.status = "ACTIVE") ' +
                'LEFT JOIN HatsOff H ' +
                'ON(E.entityid = H.entityid AND H.uuid <> ?) ' +
                'WHERE U.uuid = ? ' +
                'GROUP BY U.uuid) AS HR ' +
            'ON DUPLICATE KEY ' +
            'UPDATE hatsoff_received = HR.hatsoff_count', [uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "hatsoff_received", uuid);
                    })
                    .then((value) => {
                        if(value === 25){
                            badgeutils.sendBadgeNotification(uuid, badgenames.HATSOFF_RECEIVED)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }
        });
    });
}

/**
 * Function to update collaborated writings done by the user
 * */
function updateUserShortCollabDone(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, short_collab_done) ' +
            'SELECT uuid, short_collab_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(subQ.shoid) AS short_collab_count ' +
                'FROM User U ' +
                'LEFT JOIN (' +
                    'SELECT S.uuid, S.shoid ' +
                    'FROM Short S ' +
                    'JOIN Capture CC ' +
                    'ON(S.capid = CC.capid) ' +
                    'JOIN Entity E ' +
                    'ON(S.entityid = E.entityid) ' +
                    'WHERE E.status = "ACTIVE" ' +
                    'AND S.uuid = ? ' +
                    'AND CC.uuid <> ? ' +
                    'GROUP BY S.shoid ' +
                    ') AS subQ ' +
                'ON(U.uuid = subQ.uuid) ' +
                'WHERE U.uuid = ? ' +
                ') AS SCC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE short_collab_done = SCC.short_collab_count', [uuid, uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "short_collab_done", uuid);
                    })
                    .then((value) => {
                        if(value === 1){
                            badgeutils.sendBadgeNotification(uuid, badgenames.SHORT_COLLAB_DONE)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }

        });
    });
}

/**
 * Function to update writing collaborated on photos of the user
 * */
function updateUserShortWrittenOn(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, short_written_on) ' +
            'SELECT uuid, short_written_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(subQ.shoid) AS short_written_count ' +
                'FROM User U ' +
                'LEFT JOIN (' +
                    'SELECT CC.uuid, S.shoid ' +
                    'FROM Short S ' +
                    'JOIN Capture CC ' +
                    'USING(capid) ' +
                    'JOIN Entity E ' +
                    'ON(CC.entityid = E.entityid) ' +
                    'WHERE E.status = "ACTIVE" ' +
                    'AND CC.uuid = ? ' +
                    'AND S.uuid <> ? ' +
                    'GROUP BY S.shoid' +
                    ') AS subQ ' +
                'ON(U.uuid = subQ.uuid) ' +
                'WHERE U.uuid = ? ' +
                ') AS SWC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE short_written_on = SWC.short_written_count', [uuid, uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "short_written_on", uuid);
                    })
                    .then((value) => {
                        if(value === 3){
                            badgeutils.sendBadgeNotification(uuid, badgenames.SHORT_WRITTEN_ON)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }

        });
    });
}

/**
 * Function to update collaborated photos uploaded by the user
 * */
function updateUserCaptureCollabDone(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, capture_collab_done) ' +
            'SELECT uuid, capture_collab_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(capid) AS capture_collab_count ' +
                'FROM User U ' +
                'LEFT JOIN (' +
                    'SELECT C.uuid, C.capid ' +
                    'FROM Capture C ' +
                    'JOIN Short CS ' +
                    'ON(C.shoid = CS.shoid) ' +
                    'JOIN Entity E ' +
                    'ON(C.entityid = E.entityid) ' +
                    'WHERE E.status = "ACTIVE" ' +
                    'AND C.uuid = ? ' +
                    'AND CS.uuid <> ? ' +
                    'GROUP BY C.capid ' +
                ') AS subQ ' +
                'ON(U.uuid = subQ.uuid) ' +
                'WHERE U.uuid = ? ' +
            ') AS CCC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE capture_collab_done = CCC.capture_collab_count', [uuid, uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "capture_collab_done", uuid);
                    })
                    .then((value) => {
                        if(value === 1){
                            badgeutils.sendBadgeNotification(uuid, badgenames.CAPTURE_COLLAB_DONE)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }

        });
    });
}

/**
 * Function to update photos collaborated on writings of the user
 * */
function updateUserCaptureAddedOn(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, capture_added_on) ' +
            'SELECT uuid, capture_added_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(capid) AS capture_added_count ' +
                'FROM User U ' +
                'LEFT JOIN (' +
                    'SELECT CS.uuid, C.capid ' +
                    'FROM Capture C ' +
                    'JOIN Short CS ' +
                    'USING(shoid) ' +
                    'JOIN Entity E ' +
                    'ON(CS.entityid = E.entityid) ' +
                    'WHERE E.status = "ACTIVE" ' +
                    'AND CS.uuid = ? ' +
                    'AND C.uuid <> ? ' +
                    'GROUP BY C.capid) ' +
                    'AS subQ ' +
                'ON(U.uuid = subQ.uuid) ' +
                'WHERE U.uuid = ? ' +
                ') AS CAC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE capture_added_on = CAC.capture_added_count', [uuid, uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(() => {
                        return getParameterFromUserAnalytics(connection, "capture_added_on", uuid);
                    })
                    .then((value) => {
                        if(value === 3){
                            badgeutils.sendBadgeNotification(uuid, badgenames.CAPTURE_ADDED_ON)
                        }
                        resolve();
                    }, reject)
                    .catch(err => {
                        console.error(err);
                    });
            }

        });
    });
}

/**
 * Function to update collaborated long-form writings done by the user
 * */
function updateUserLongFormCollab(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, long_form_collab) ' +
            'SELECT uuid, long_form_collab_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(shoid) AS long_form_collab_count ' +
                'FROM User U ' +
                'LEFT JOIN (' +
                    'SELECT S.uuid, S.shoid ' +
                    'FROM Short S ' +
                    'JOIN Capture CC ' +
                    'ON(S.capid = CC.capid) ' +
                    'JOIN Entity E ' +
                    'ON(S.entityid = E.entityid) ' +
                    'WHERE E.status = "ACTIVE" ' +
                    'AND S.text_long IS NOT NULL ' +
                    'AND S.uuid = ? ' +
                    'AND CC.uuid <> ? ' +
                    'GROUP BY S.shoid' +
                    ') AS subQ ' +
                'ON(U.uuid = subQ.uuid) ' +
                'WHERE U.uuid = ? ' +
                ') AS LFCC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE long_form_collab = LFCC.long_form_collab_count', [uuid, uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(resolve, reject);
            }

        });
    });
}

/**
 * Function to update long-form writings (without collab) done by the user
 * */
function updateUserLongFormSolo(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, long_form_solo) ' +
            'SELECT uuid, long_form_solo_count ' +
            'FROM (' +
                'SELECT U.uuid, COUNT(subQ.shoid) AS long_form_solo_count ' +
                'FROM User U ' +
                'LEFT JOIN (' +
                    'SELECT S.uuid, S.shoid ' +
                    'FROM Short S ' +
                    'JOIN Entity E ' +
                    'ON(S.entityid = E.entityid) ' +
                    'WHERE E.status = "ACTIVE" ' +
                    'AND S.text_long IS NOT NULL ' +
                    'AND S.uuid = ? ' +
                    'AND S.capid IS NULL ' +
                    'GROUP BY S.shoid' +
                ') AS subQ ' +
            'ON(U.uuid = subQ.uuid) ' +
            'WHERE U.uuid = ? ' +
            ') AS LFSC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE long_form_solo = long_form_solo_count', [uuid, uuid], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(resolve, reject);
            }

        });
    });
}

/**
 * Function to fetch a particular param/column from UserAnalytics table for a particular user
 * */
function getParameterFromUserAnalytics(connection, param, uuid) {
    return new Promise((resolve, reject) => {
        connection.query(`SELECT ${param} 
        FROM UserAnalytics 
        WHERE uuid = ?`, [uuid], (err, rows) => {
            if(err){
                reject(err);
            }
            else {
                resolve(rows[0][param]);
            }
        });
    });
}

module.exports = {
    createUserAnalyticsRecord: createUserAnalyticsRecord,
    updateUserTotalPosts: updateUserTotalPosts,
    updateUserFeaturedCount: updateUserFeaturedCount,
    updateUserFeaturedCountConsec: updateUserFeaturedCountConsec,
    updateUserCommentsGiven: updateUserCommentsGiven,
    updateUserCommentsReceived: updateUserCommentsReceived,
    updateUserHatsoffGiven: updateUserHatsoffGiven,
    updateUserHatsoffsReceived: updateUserHatsoffsReceived,
    updateUserShortCollabDone: updateUserShortCollabDone,
    updateUserShortWrittenOn: updateUserShortWrittenOn,
    updateUserCaptureCollabDone: updateUserCaptureCollabDone,
    updateUserCaptureAddedOn: updateUserCaptureAddedOn,
    updateUserLongFormSolo: updateUserLongFormSolo,
    updateUserLongFormCollab: updateUserLongFormCollab
};