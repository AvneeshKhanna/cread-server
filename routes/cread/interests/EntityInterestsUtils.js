/**
 * Created by avnee on 09-05-2018.
 */
'use-strict';

var uuidGen = require('uuid');
var consts = require('../utils/Constants');
var entityutils = require('../entity/EntityUtils');

function loadInterestsByType(connection, entityid, type) {
    return new Promise(function (resolve, reject) {

        var sql;
        var sqlparams;

        if(entityid){
            if(type === 'ALL'){
                sql = 'SELECT I.intid, I.intname, (EI.eintid IS NOT NULL) AS selected ' +
                    'FROM Interests I ' +
                    'LEFT JOIN EntityInterests EI ' +
                    'ON(I.intid = EI.intid AND EI.entityid = ?) ' +
                    'WHERE I.superset IS NOT NULL';
            }
            else{
                sql = 'SELECT I.intid, I.intname, (EI.eintid IS NOT NULL) AS selected ' +
                    'FROM Interests I ' +
                    'LEFT JOIN EntityInterests EI ' +
                    'ON(I.intid = EI.intid AND EI.entityid = ?) ' +
                    'WHERE I.superset = "' + type + '"';
            }
            sqlparams = [
                entityid
            ]
        }
        else {
            if(type === 'ALL'){
                sql = 'SELECT I.*, 0 AS selected ' +
                    'FROM Interests I ' +
                    'WHERE superset IS NOT NULL';
            }
            else{
                sql = 'SELECT I.*, 0 AS selected ' +
                    'FROM Interests I ' +
                    'WHERE superset = "' + type + '"';
            }
            sqlparams = []
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
                    max_selection: consts.max_interest_selection,   //max permitted selections by a user to categorise a post
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
function loadEntityForInterestTag(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT E.entityid ' +
            'FROM Entity E ' +
            'LEFT JOIN EntityInterests EI ' +
            'USING(entityid) ' +
            'WHERE EI.eintid IS NULL ' +
            'AND E.locked = 0 ' +
            'AND E.status = "ACTIVE" ' +
            'GROUP BY E.entityid ' +
            'ORDER BY E.regdate DESC ' +
            'LIMIT 1', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                entityutils.loadEntityData(connection, rows[0].entityid)
                    .then(function (edata) {
                        resolve(edata);
                    })
                    .catch(function (err) {
                        reject(err);
                    });
            }
        });
    });
}

/**
 * Function to lock an entity while tagging interests/labels manually
 * */
function lockEntity(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'SET locked = 1, lock_time = NOW() ' +
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
 * Function to unlock an entity after tagging interests/labels manually
 * */
function unlockEntity(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Entity ' +
            'SET locked = 0, lock_time = ? ' +
            'WHERE entityid = ?', [null, entityid], function (err, rows) {
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
    loadEntityForInterestTag: loadEntityForInterestTag,
    lockEntity: lockEntity,
    unlockEntity: unlockEntity
};