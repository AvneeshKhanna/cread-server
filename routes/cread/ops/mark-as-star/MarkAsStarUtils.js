/**
 * Created by avnee on 13-07-2018.
 */
'use-strict';

var moment = require('moment');
var utils = require('../../utils/Utils');

function loadMarkStarFeed(connection, limit, lastindexkey, starred)  {
    return new Promise(function (resolve, reject) {

        lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

        /*if(![mark_for_collab_cnsts.UNMARKED, mark_for_collab_cnsts.ACCEPTED, mark_for_collab_cnsts.REJECTED].includes(starred)){
            reject(new Error('Invalid argument "filterBy"'));
            return;
        }*/

        connection.query('SELECT E.entityid, E.uuid, E.starred, E.type, E.regdate, ' +
            'S.shoid, S.capid AS shcaptureid, C.capid, C.shoid AS cpshortid, ' +
            'CASE WHEN(E.status = "SHORT") THEN S.img_height ELSE C.img_height END AS img_height, ' +
            'CASE WHEN(E.status = "SHORT") THEN S.img_width ELSE C.img_width END AS img_width ' +
            'FROM Entity E ' +
            'LEFT JOIN Capture C ' +
            'USING(entityid) ' +
            'LEFT JOIN Short S ' +
            'ON(S.entityid = E.entityid) ' +
            'WHERE E.status = "ACTIVE" ' +
            'AND E.for_explore = 1 ' +
            'AND E.starred = ? ' +
            'AND E.regdate < ? ' +
            'ORDER BY E.regdate DESC ' +
            'LIMIT ?', [starred, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if(rows.length > 0){

                    rows.map(function (row) {
                        if (row.type === "SHORT") {
                            row.entityurl = utils.createSmallShortUrl(row.uuid, row.shoid);
                        }
                        else if(row.type === "CAPTURE") {
                            row.entityurl = utils.createSmallCaptureUrl(row.uuid, row.capid);
                        }

                        row.starred = String(row.starred === 1);

                        if(row.hasOwnProperty('uuid')){
                            delete row.uuid;
                        }

                        if(row.hasOwnProperty('capid')){
                            delete row.capid;
                        }

                        if(row.hasOwnProperty('shoid')){
                            delete row.shoid;
                        }

                    });

                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        items: rows
                    });
                }
                else{
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: "",
                        items: rows
                    });
                }
            }
        });
    });
}

function updateStarPost(connection, entityid, mark_as_star) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'SET starred = ? ' +
            'WHERE entityid = ?', [mark_as_star, entityid], function (err, rows) {
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
    loadMarkStarFeed: loadMarkStarFeed,
    updateStarPost: updateStarPost
};