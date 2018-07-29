/**
 * Created by avnee on 25-07-2018.
 */
'use-strict';

let badgeutils = require('../../badges/BadgeUtils');

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
                '(SELECT uuid, COUNT(*) AS user_posts ' +
                'FROM Entity ' +
                'WHERE uuid = ? ' +
                'AND status = "ACTIVE" ' +
                'GROUP BY uuid) AS UP ' +
            'ON DUPLICATE KEY ' +
            'UPDATE total_uploads = UP.user_posts', [uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                badgeutils.updateBadgeCountCacheFromDB(connection, uuid)
                    .then(resolve, reject);
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
            "SELECT ?, fcount " +
            "FROM (" +
                "SELECT uuid, COUNT(uuid) AS fcount " +
                "FROM FeaturedArtists " +
                "WHERE uuid = ?" +
                "GROUP BY uuid) FA " +
            "ON DUPLICATE KEY " +
            "UPDATE featured = FA.fcount", [uuid, uuid], (err, rows) => {

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
 * Function to update UserAnalytics table whether a user has been featured 3 times consecutively or not
 * */
function updateUserFeaturedCountConsec(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query("INSERT INTO UserAnalytics (uuid, featured_3_consctve) " +
            "SELECT FC.uuid, CASE WHEN FC.consec_count IS NULL THEN false ELSE true END AS f_consec_status" +
            "FROM (" +
                "SELECT U.uuid, COUNT(FA.featured_id) AS consec_count " +
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
                'SELECT C.uuid, COUNT(C.commid) AS comment_count ' +
                'FROM Comment C ' +
                'JOIN Entity E ' +
                'USING(entityid) ' +
                'WHERE C.uuid = ? ' +
                'AND E.uuid <> ? ' +
                'GROUP BY C.uuid) AS CG ' +
            'ON DUPLICATE KEY ' +
            'UPDATE comment_given = CG.comment_count', [uuid, uuid], (err, rows) => {

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

function updateUserCommentsReceived(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, comment_received) ' +
            'SELECT uuid, comment_count ' +
            'FROM (' +
                'SELECT E.uuid, COUNT(C.commid) AS comment_count ' +
                'FROM Comment C ' +
                'JOIN Entity E ' +
                'USING(entityid) ' +
                'WHERE C.uuid <> ? ' +
                'AND E.uuid = ?' +
                'GROUP BY E.uuid) AS CR ' +
            'ON DUPLICATE KEY ' +
            'UPDATE comment_received = CR.comment_count', [uuid, uuid], (err, rows) => {
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

function updateUserHatsoffGiven(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, hatsoff_given) ' +
            'SELECT uuid, hatsoff_count ' +
            'FROM (' +
                'SELECT H.uuid, COUNT(H.hoid) AS hatsoff_count ' +
                'FROM HatsOff H ' +
                'JOIN Entity E ' +
                'USING(entityid) ' +
                'WHERE H.uuid = ? ' +
                'AND E.uuid <> ?' +
                'GROUP BY H.uuid) AS HG ' +
            'ON DUPLICATE KEY ' +
            'UPDATE hatsoff_given = HG.hatsoff_count', [uuid, uuid], (err, rows) => {

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

function updateUserHatsoffsReceived(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, hatsoff_received) ' +
            'SELECT uuid, hatsoff_count ' +
            'FROM (' +
                'SELECT E.uuid, COUNT(H.hoid) AS hatsoff_count ' +
                'FROM HatsOff H ' +
                'JOIN Entity E ' +
                'USING(entityid) ' +
                'WHERE H.uuid <> ? ' +
                'AND E.uuid = ? ' +
                'AND E.status = "ACTIVE" ' +
                'GROUP BY E.uuid) AS HR ' +
            'ON DUPLICATE KEY ' +
            'UPDATE hatsoff_received = HR.hatsoff_count', [uuid, uuid], (err, rows) => {

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
 * Function to update collaborated writings done by the user
 * */
function updateUserShortCollabDone(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, short_collab_done) ' +
            'SELECT ?, short_collab_count ' +
            'FROM (' +
                'SELECT COUNT(subQ.shoid) AS short_collab_count ' +
                'FROM (' +
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
                ') AS SCC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE short_collab_done = SCC.short_collab_count', [uuid, uuid, uuid], (err, rows) => {

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
 * Function to update writing collaborated on photos of the user
 * */
function updateUserShortWrittenOn(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, short_written_on) ' +
            'SELECT ?, short_written_count ' +
            'FROM (' +
                'SELECT COUNT(subQ.shoid) AS short_written_count ' +
                'FROM (' +
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
                    ') AS subQ' +
                ') AS SWC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE short_written_on = SWC.short_written_count', [uuid, uuid, uuid], (err, rows) => {

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
 * Function to update collaborated photos uploaded by the user
 * */
function updateUserCaptureCollabDone(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, capture_collab_done) ' +
            'SELECT ?, capture_collab_count ' +
            'FROM (' +
                'SELECT COUNT(capid) AS capture_collab_count ' +
                'FROM (' +
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
            ') AS CCC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE capture_collab_done = CCC.capture_collab_count', [uuid, uuid, uuid], (err, rows) => {

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
 * Function to update photos collaborated on writings of the user
 * */
function updateUserCaptureAddedOn(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, capture_added_on) ' +
            'SELECT ?, capture_added_count ' +
            'FROM (' +
                'SELECT COUNT(capid) AS capture_added_count ' +
                'FROM (' +
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
                ') AS CAC ' +
            'ON DUPLICATE KEY ' +
            'UPDATE capture_added_on = CAC.capture_added_count', [uuid, uuid, uuid], (err, rows) => {

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
 * Function to update collaborated long-form writings done by the user
 * */
function updateUserLongFormCollab(connection, uuid) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO UserAnalytics (uuid, long_form_collab) ' +
            'SELECT ?, long_form_collab_count ' +
            'FROM (' +
                'SELECT COUNT(shoid) AS long_form_collab_count ' +
                'FROM (' +
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
                    ') AS subQ' +
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
            'SELECT ?, long_form_solo_count ' +
            'FROM (' +
                'SELECT COUNT(subQ.shoid) AS long_form_solo_count ' +
                'FROM (' +
                    'SELECT S.uuid, S.shoid ' +
                    'FROM Short S ' +
                    'JOIN Entity E ' +
                    'ON(S.entityid = E.entityid) ' +
                    'WHERE E.status = "ACTIVE" ' +
                    'AND S.text_long IS NOT NULL ' +
                    'AND S.uuid = ? ' +
                    'AND S.capid IS NULL ' +
                    'GROUP BY S.shoid' +
                ') AS subQ' +
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