/**
 * Created by avnee on 09-11-2017.
 */
'use-strict';

var utils = require('../utils/Utils');

var moment = require('moment');
var feedutils = require('../feed/FeedUtils');
var updatesutils= require('../updates/UpdatesUtils');
var userprofileutils = require('../user-manager/UserProfileUtils');
var consts = require('../utils/Constants');

function retrieveShortDetails(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Short.shoid, Short.uuid AS shortuuid, Short.capid, Short.entityid, Short.txt, Short.textsize, Short.textcolor, Short.textgravity, Short.dx, Short.dy, Short.txt_width, Short.txt_height, Short.img_height, Short.img_width, Capture.uuid AS captureuuid ' +
            'FROM Short ' +
            'JOIN Capture ' +
            'ON Short.capid = Capture.capid ' +
            'WHERE Short.entityid = ?', [entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows[0]);
            }
        });
    });
}

function getEntityDetailsForPrint(connection, entityids) {
    return new Promise(function (resolve, reject) {

        /*'E.type, E.entityid, S.uuid, S.shoid, S.capid, S.bold, S.italic, S.dx, S.dy, S.bgcolor, S.font, ' +
        'S.txt AS text, S.textsize, S.textcolor, S.textgravity, S.img_width, S.img_height, S.txt_width, S.txt_height, ' +
        'C.bold, C.italic, C.dx, C.dy, C.bgcolor, C.font, C.text, C.textsize, C.textcolor, C.textgravity, C.img_width, ' +
        'C.img_height, C.txt_width, C.txt_height, C.uuid, C.capid, C.shoid, CS.uuid, CS.capid';*/

        var sqloptions = {
            sql: 'SELECT * ' +
            'FROM Entity AS E ' +
            'LEFT JOIN Short AS S ' +
            'ON E.entityid = S.entityid ' +
            'LEFT JOIN Capture AS C ' +
            'ON E.entityid = C.entityid ' +
            'LEFT JOIN Capture AS CS ' +
            'ON S.capid = CS.capid ' +
            'WHERE E.entityid IN (?) ' +
            'GROUP BY E.entityid',
            nestTables: true    //To segregate same column names under multiple tables
        };

        /*if(type === 'SHORT'){
            query = 'SELECT * FROM Short WHERE entityid IN (?)';
        }
        else if(type === 'CAPTURE'){
            query = 'SELECT * FROM Capture WHERE entityid IN (?)';
        }*/

        connection.query(sqloptions, [entityids], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                console.log("rows from query {nestTables:true} is " + JSON.stringify(rows, null, 3));

                rows.map(function (element) {

                    var E = element.E;
                    var S = element.S;
                    var C = element.C;
                    var CS = element.CS;

                    if(E.type === 'SHORT'){

                        if(S.hasOwnProperty('regdate')){
                            delete S.regdate;
                        }

                        for (var key in S) {
                            element[key] = S[key];
                        }

                        element.entityurl = utils.createSmallShortUrl(S.uuid, S.shoid);

                        if(S.capid){
                            element.highresurl = utils.createCaptureUrl(CS.uuid, CS.capid);
                        }
                        else{
                            element.highresurl = null;
                        }

                    }
                    else if(E.type === 'CAPTURE'){

                        if(C.hasOwnProperty('regdate')){
                            delete C.regdate;
                        }

                        for (var key in C) {
                            element[key] = C[key];
                        }

                        element.entityurl = utils.createSmallCaptureUrl(C.uuid, C.capid);
                        element.highresurl = utils.createCaptureUrl(C.uuid, C.capid);
                    }

                    if(element.textgravity === 'East'){
                        element.textgravity = 'Right';
                    }
                    else if(element.textgravity === 'West'){
                        element.textgravity = 'Left';
                    }

                    if(element.hasOwnProperty('txt')){
                        utils.changePropertyName(element, 'txt', 'text');
                    }

                    if(element.hasOwnProperty('E')){
                        delete element.E;
                    }

                    if(element.hasOwnProperty('S')){
                        delete element.S;
                    }

                    if(element.hasOwnProperty('C')){
                        delete element.C;
                    }

                    if(element.hasOwnProperty('CS')){
                        delete element.CS;
                    }

                });

                resolve(rows);
            }
        });
    });
}

function loadCollabDetails(connection, entityid, entitytype, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    var query;

    if(entitytype === 'SHORT'){
        query = 'SELECT User.firstname, User.lastname, User.uuid, Capture.capid, Capture.entityid, Capture.regdate ' +
            'FROM Short ' +
            'JOIN Capture ' +
            'USING (shoid) ' +
            'JOIN Entity ' +
            'ON Entity.entityid = Capture.entityid ' +
            'JOIN User ' +
            'ON Capture.uuid = User.uuid ' +
            'WHERE Entity.status = "ACTIVE" ' +
            'AND Short.entityid = ? ' +
            'AND Capture.regdate < ? ' +
            'ORDER BY Capture.regdate DESC ' +
            'LIMIT ?'
    }
    else {
        query = 'SELECT User.firstname, User.lastname, User.uuid, Short.shoid, Short.entityid, Short.regdate ' +
            'FROM Capture ' +
            'JOIN Short ' +
            'USING (capid) ' +
            'JOIN Entity ' +
            'ON Entity.entityid = Short.entityid ' +
            'JOIN User ' +
            'ON Short.uuid = User.uuid ' +
            'WHERE Entity.status = "ACTIVE" ' +
            'AND Capture.entityid = ? ' +
            'AND Short.regdate < ? ' +
            'ORDER BY Short.regdate DESC ' +
            'LIMIT ?'
    }

    return new Promise(function (resolve, reject) {
        connection.query(query, [entityid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {
                    element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                    element.name = element.firstname + ' ' + element.lastname;

                    if(entitytype === 'SHORT'){
                        element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.capid);
                    }
                    else{
                        element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                    }

                    /*if(element.capid){
                        delete element.capid;
                    }

                    if(element.shoid){
                        delete element.shoid;
                    }*/

                    if(element.firstname){
                        delete element.firstname;
                    }

                    if(element.lastname){
                        delete element.lastname;
                    }

                });

                if(rows.length > 0){
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        items: rows
                    });
                }
                else{
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        items: rows
                    });
                }
            }
        });
    });
}

function loadEntityData(connection, requesteruuid, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.caption, Entity.entityid, Entity.merchantable, Entity.type, Entity.regdate, Short.shoid, Capture.capid AS captureid, ' +
            'Capture.shoid AS cpshortid, Short.capid AS shcaptureid, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.text_long IS NOT NULL ELSE Capture.text_long IS NOT NULL END AS long_form, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS fbinarycount, ' +
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
            'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount, ' +
            'COUNT(DISTINCT Comment.commid) AS commentcount, ' +
            'User.uuid, User.firstname, User.lastname ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'LEFT JOIN Comment ' +
            'ON Comment.entityid = Entity.entityid ' +
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = Entity.entityid ' +
            'LEFT JOIN Downvote D ' +
            'ON D.entityid = Entity.entityid ' +
            'LEFT JOIN Follow ' +
            'ON User.uuid = Follow.followee ' +
            'WHERE Entity.entityid = ?', [requesteruuid, requesteruuid, requesteruuid, entityid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                row.map(function (element) {
                    element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);

                    if(element.type === 'CAPTURE'){
                        element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                    }
                    else{
                        element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                    }

                    element.creatorname = element.firstname + ' ' + element.lastname;
                    element.hatsoffstatus = element.hbinarycount > 0;
                    element.followstatus = element.fbinarycount > 0;
                    element.downvotestatus = element.dbinarycount > 0;
                    element.merchantable = (element.merchantable !== 0);
                    element.long_form = (element.long_form === 1);

                    /*if(element.capid) {
                        delete element.capid;
                    }*/

                    /*if(element.shoid) {
                        delete element.shoid;
                    }*/

                    if(element.firstname) {
                        delete element.firstname;
                    }

                    if(element.lastname) {
                        delete element.lastname;
                    }

                    if (element.hasOwnProperty('hbinarycount')) {
                        delete element.hbinarycount;
                    }

                    if (element.hasOwnProperty('dbinarycount')) {
                        delete element.dbinarycount;
                    }

                    if(element.hasOwnProperty('fbinarycount')) {
                        delete element.fbinarycount;
                    }

                    return element;
                });

                var candownvote;

                userprofileutils.getUserQualityPercentile(connection, requesteruuid)
                    .then(function (result) {
                        candownvote = result.quality_percentile_score >= consts.min_percentile_quality_user;
                        return feedutils.getCollaborationData(connection, row);
                    })
                    .then(function (row) {

                        /*rows.map(function (e) {
                            e.collabcount = 0;
                            return e;
                        });*/

                        return feedutils.getCollaborationCounts(connection, row, [entityid]);
                    })
                    .then(function (row) {
                        resolve({
                            candownvote: candownvote,
                            entity: row[0]
                        });
                    })
                    .catch(function (err) {
                        reject(err);
                    });

                /*resolve({
                    entity: row[0]
                });*/
            }
        });
    });
}

/**
 * Load textual data and image's url separately from a collaborated entityid
 * */
function loadEntityDataSeparate(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT E.type, C.* ' +
            'FROM Entity E ' +
            'LEFT JOIN Capture C ' +
            'USING(entityid) ' +
            'WHERE E.entityid = ?;' +
            'SELECT E.type, S.*, C.uuid, C.capid ' +    //Note: Here, 'uuid' and 'capid' values retrieved will be overwritten for those in Short table
            'FROM Entity E ' +
            'LEFT JOIN Short S ' +
            'USING(entityid) ' +
            'LEFT JOIN Capture C ' +
            'ON (S.capid = C.capid)' +
            'WHERE E.entityid = ?', [entityid, entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                var row;

                if(rows[0][0].type === 'CAPTURE'){
                    row = rows[0];
                }
                else{
                    row = rows[1];
                }

                row.map(function (element) {
                    if(element.capid) {
                        element.entityurl = utils.createCaptureUrl(element.uuid, element.capid);
                    }
                    else{
                        element.entityurl = null;
                    }

                    if(element.txt){
                        utils.changePropertyName(element, "txt", "text");
                    }

                    element.text = element.text + '\n' + element.text_long;

                    if(element.hasOwnProperty('text_long')){
                        delete element.text_long;
                    }

                });

                resolve(row[0])
            }
        });
    });
}

/**
 * Retrieves the creator and collaborator's (if exists) uuids from entityid
 * */
function getEntityUsrDetailsForNotif(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.type, Creator.uuid AS creatoruuid, ' +
            'CollabC.uuid AS collabcuuid, CollabS.uuid AS collabsuuid ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'JOIN User AS Creator ' +
            'ON (Creator.uuid = Short.uuid OR Creator.uuid = Capture.uuid)  ' +
            'LEFT JOIN Capture AS CollabC ' +
            'ON Short.capid = CollabC.capid ' +
            'LEFT JOIN Short AS CollabS ' +
            'ON Capture.shoid = CollabS.shoid ' +
            'WHERE Entity.entityid = ?', [entityid], function(err, rows){
            if(err){
                reject(err);
            }
            else{

                rows.map(function (el) {
                    if(el.type === 'SHORT'){
                        if(el.collabcuuid){
                            el.collabuuid = el.collabcuuid;
                        }
                    }
                    else if(el.type === 'CAPTURE'){
                        if(el.collabsuuid){
                            el.collabuuid = el.collabsuuid;
                        }
                    }
                });

                resolve(rows[0]);
            }
        });
    })
}

function deactivateEntity(connection, entityid, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'LEFT JOIN Short ' +
            'USING(entityid) ' +
            'LEFT JOIN Capture ' +
            'USING(entityid) ' +
            'SET Entity.status = "DEACTIVE" ' +
            'WHERE Entity.entityid = ? ', [entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function updateEntityCaption(connection, entityid, caption) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'SET caption = ? ' +
            'WHERE entityid = ?', [caption, entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function updateEntityCollabDataForUpdates(connection, entityid, uuid, actor_uuid){
    return new Promise(function (resolve, reject) {
        var updateparams = {
            category: "collaborate",
            actor_uuid: actor_uuid,
            uuid: uuid,
            entityid: entityid
        };
        updatesutils.addToUpdatesTable(connection, updateparams)
            .then(resolve, reject);
    });
}

function removeEntityFromExplore(connection, entityid){
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'SET for_explore = 0 ' +
            'WHERE entityid = ?', [entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function putEntityToExplore(connection, entityid){
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'SET for_explore = 1 ' +
            'WHERE entityid = ?', [entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/**
 * Updates the last_event_time in Entity table to current time if the creator of the entityid is not the same
 * performing the event
 * */
function updateLastEventTimestamp(connection, entityid, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'LEFT JOIN Short ' +
            'ON (Short.entityid = Entity.entityid) ' +
            'LEFT JOIN Capture ' +
            'ON (Capture.entityid = Entity.entityid) ' +
            'SET Entity.last_event_time = NOW()' +
            'WHERE Entity.entityid = ?' +
            'AND ((Short.uuid IS NOT NULL AND Short.uuid <> ?) OR (Capture.uuid IS NOT NULL AND Capture.uuid <> ?)) ', [entityid, uuid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/**
 * Updates the last_event_time in Entity table to current time if the creator of the entityid is not the same
 * performing the event. Executes this function based on the shoid (or capid) provided
 *
 * @param typeid shoid or capid whichever is provided
 * */
function updateLastEventTimestampViaType(connection, typeid, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'LEFT JOIN Short ' +
            'ON (Short.entityid = Entity.entityid) ' +
            'LEFT JOIN Capture ' +
            'ON (Capture.entityid = Entity.entityid) ' +
            'SET Entity.last_event_time = NOW()' +
            'WHERE (Short.shoid = ? OR Capture.capid = ?) ' +
            'AND ((Short.uuid IS NOT NULL AND Short.uuid <> ?) OR (Capture.uuid IS NOT NULL AND Capture.uuid <> ?)) ',
            [typeid, typeid, uuid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = {
    updateEntityCollabDataForUpdates: updateEntityCollabDataForUpdates,
    loadEntityData: loadEntityData,
    loadEntityDataSeparate: loadEntityDataSeparate,
    retrieveShortDetails: retrieveShortDetails,
    loadCollabDetails: loadCollabDetails,
    updateEntityCaption: updateEntityCaption,
    getEntityDetailsForPrint: getEntityDetailsForPrint,
    getEntityUsrDetailsForNotif: getEntityUsrDetailsForNotif,
    deactivateEntity: deactivateEntity,
    removeEntityFromExplore: removeEntityFromExplore,
    putEntityToExplore: putEntityToExplore,
    updateLastEventTimestamp: updateLastEventTimestamp,
    updateLastEventTimestampViaType: updateLastEventTimestampViaType
};