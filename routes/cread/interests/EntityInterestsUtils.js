/**
 * Created by avnee on 09-05-2018.
 */
'use-strict';

var uuidGen = require('uuid');
var moment = require('moment');

var config = require('../../Config');
var consts = require('../utils/Constants');
var entityutils = require('../entity/EntityUtils');

function loadInterestsByType(connection, entityid, type) {
    return new Promise(function (resolve, reject) {

        var sql;
        var sqlparams;

        if(entityid){
            if(type === 'ALL'){ //Case of collaboration post
                sql = 'SELECT I.intid, I.intname, (EI.eintid IS NOT NULL) AS selected ' +
                    'FROM Interests I ' +
                    'LEFT JOIN EntityInterests EI ' +
                    'ON(I.intid = EI.intid AND EI.entityid = ?) ' +
                    'WHERE I.superset IS NOT NULL';
                sqlparams = [
                    entityid
                ]
            }
            else{   //Case of solo post
                sql = 'SELECT I.intid, I.intname, (EI.eintid IS NOT NULL) AS selected ' +
                    'FROM Interests I ' +
                    'LEFT JOIN EntityInterests EI ' +
                    'ON(I.intid = EI.intid AND EI.entityid = ?) ' +
                    'WHERE I.superset = ? OR I.superset = "ALL"';
                sqlparams = [
                    entityid,
                    type
                ]
            }

        }
        else {
            if(type === 'ALL'){ //Case of collaboration post
                sql = 'SELECT I.*, 0 AS selected ' +
                    'FROM Interests I ' +
                    'WHERE superset IS NOT NULL';
                sqlparams = []
            }
            else{   //Case of solo post
                sql = 'SELECT I.*, 0 AS selected ' +
                    'FROM Interests I ' +
                    'WHERE superset = ? OR superset = "ALL"';
                sqlparams = [
                    type
                ]
            }

        }

        connection.query(sql, sqlparams, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (row) {
                    row.selected = row.selected === 1;
                });

                resolve({
                    max_selection: Math.ceil(rows.length/consts.max_intrst_selectn_div),   //max permitted selections by a user to categorise a post
                    interests: rows
                });
            }
        });
    });
}

function saveEntityInterests(connection, entityid, interests) {
    return new Promise(function (resolve, reject) {

        var sqlParamArr = [];

        interests.map(function (i) {
            sqlParamArr.push([
                uuidGen.v4(),
                i,
                entityid
            ])
        });

        connection.query('INSERT IGNORE INTO EntityInterests (eintid, intid, entityid) VALUES ?', [sqlParamArr], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function deleteAllEntityInterests(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('DELETE FROM EntityInterests WHERE entityid = ?', [entityid], function (err, rows) {
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
 * Function to load an entity data for tagging interests/labels manually
 * */
function loadPostsForInterestTag(connection, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT E.entityid ' +
            'FROM Entity E ' +
            'LEFT JOIN EntityInterests EI ' +
            'USING(entityid) ' +
            'WHERE EI.eintid IS NULL ' +
            'AND E.locked = 0 ' +
            'AND E.status = "ACTIVE" ' +
            'AND E.regdate < ? ' +
            'GROUP BY E.entityid ' +
            'ORDER BY E.regdate DESC ' +
            'LIMIT ?', [lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                if(rows.length > 0){

                    var entityids = rows.map(function (r) {
                        return r.entityid;
                    });

                    entityutils.loadEntityDatMultiple(connection, config.getCreadKalakaarUUID(), entityids)
                        .then(function (items) {
                            resolve({
                                requestmore: rows.length >= limit,
                                lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                                candownvote: false,
                                items: items
                            });
                        })
                        .catch(function (err) {
                            reject(err);
                        });
                }
                else {
                    resolve({
                        requestmore: rows.length >= limit,
                        candownvote: false,
                        lastindexkey: null,
                        items: []
                    });
                }
            }
        });
    });
}

/**
 * Function to lock an entity while tagging interests/labels manually
 * */
function lockEntityMultiple(connection, entityids) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'SET locked = 1, lock_time = NOW() ' +
            'WHERE entityid IN (?)', [entityids], function (err, rows) {
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
 * Function to unlock entities after a regular interval of time after tagging interests/labels manually
 * */
function unlockEntityMultiple(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'SET locked = 0, lock_time = ? ' +
            'WHERE lock_time < DATE_SUB(NOW(), INTERVAL 1 HOUR)', [null], function (err, rows) {
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
    saveEntityInterests: saveEntityInterests,
    loadInterestsByType: loadInterestsByType,
    deleteAllEntityInterests: deleteAllEntityInterests,
    loadPostsForInterestTag: loadPostsForInterestTag,
    lockEntityMultiple: lockEntityMultiple,
    unlockEntityMultiple: unlockEntityMultiple
};