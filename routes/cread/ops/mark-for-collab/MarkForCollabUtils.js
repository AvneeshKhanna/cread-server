/**
 * Created by avnee on 24-05-2018.
 */
'use-strict';

var moment = require('moment');
var utils = require('../../utils/Utils');
const consts = require('../../utils/Constants');
const mark_for_collab_cnsts = consts.mark_for_collab;

function loadMarkCollabFeed(connection, limit, lastindexkey, filterBy) {
    return new Promise(function (resolve, reject) {

        lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

        if(![mark_for_collab_cnsts.UNMARKED, mark_for_collab_cnsts.ACCEPTED, mark_for_collab_cnsts.REJECTED].includes(filterBy)){
            reject(new Error('Invalid argument "filterBy"'));
            return;
        }

        connection.query('SELECT E.entityid, E.uuid, E.mark_for_collab, E.regdate, C.capid, C.shoid, C.img_height, C.img_width ' +
            'FROM Entity E ' +
            'JOIN Capture C ' +
            'USING(entityid) ' +
            'WHERE E.status = "ACTIVE" ' +
            'AND E.for_explore = 1 ' +
            'AND E.mark_for_collab = ? ' +
            'AND E.regdate < ? ' +
            'ORDER BY E.regdate DESC ' +
            'LIMIT ?', [filterBy, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if(rows.length > 0){

                    rows.map(function (row) {
                        if (row.shoid) {  //Case where the capture was added on an existing writing as a collaboration
                            row.entityurl = utils.createCaptureUrl(row.uuid, row.capid);
                        }
                        else {   //Case where the capture was added as solo (without collaboration)
                            row.entityurl = utils.createSmallCaptureUrl(row.uuid, row.capid);
                        }

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

function updateMarkCollab(connection, entityid, mark_for_collab) {
    return new Promise(function (resolve, reject) {

        if(!([mark_for_collab_cnsts.ACCEPTED, mark_for_collab_cnsts.REJECTED].includes(mark_for_collab))){
            reject(new Error('Invalid argument "mark_for_collab"'));
            return;
        }

        connection.query('UPDATE Entity ' +
            'SET mark_for_collab = ? ' +
            'WHERE entityid = ?', [mark_for_collab, entityid], function (err, rows) {
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
    loadMarkCollabFeed: loadMarkCollabFeed,
    updateMarkCollab: updateMarkCollab
};