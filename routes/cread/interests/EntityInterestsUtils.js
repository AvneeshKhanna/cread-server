/**
 * Created by avnee on 09-05-2018.
 */
'use-strict';

var uuidGen = require('uuid');

function loadInterestsByType(connection, entityid, type) {
    return new Promise(function (resolve, reject) {

        var sql;
        var sqlparams;

        if(entityid){
            sql = 'SELECT I.intid, I.intname, (EI.eintid IS NOT NULL) AS selected ' +
                'FROM Interests I ' +
                'LEFT JOIN EntityInterests EI ' +
                'ON(I.intid = EI.intid AND EI.entityid = ?) ' +
                'WHERE I.superset = ?';
            sqlparams = [
                entityid,
                type
            ]
        }
        else {
            sql = 'SELECT I.*, 0 AS selected ' +
                'FROM Interests I ' +
                'WHERE superset = ?';
            sqlparams = [
                type
            ]
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

        connection.query('INSERT INTO EntityInterests (eintid, intid, entityid) VALUES ?', [sqlParamArr], function (err, rows) {
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

module.exports = {
    saveEntityInterests: saveEntityInterests,
    loadInterestsByType: loadInterestsByType,
    deleteAllEntityInterests: deleteAllEntityInterests
};