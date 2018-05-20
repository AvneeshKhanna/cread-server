/**
 * Created by avnee on 02-05-2018.
 */
'use-strict';

var uuidGen = require('uuid');
var utils = require('../utils/Utils');

function loadAllInterestsForUser(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT I.intid, I.intname, (UI.uintid IS NOT NULL) AS selected ' +
            'FROM Interests I ' +
            'LEFT JOIN UserInterests UI ' +
            'ON(I.intid = UI.intid AND UI.uuid = ?) ' +
            'WHERE I.superset <> "ALL" ' +
            'GROUP BY I.intid', [uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (row) {
                    row.intimgurl = utils.getInterestBgImgUrl(row.intname);
                    row.selected = row.selected === 1;
                    return row;
                });

                resolve({
                    requestmore: false, //Key not contributing to functionality
                    lastindexkey: 30,   //Key not contributing to functionality
                    interests: rows
                });
            }
        });
    });
}

function updateUserInterests(connection, uuid, interests, register) {
    return new Promise(function (resolve, reject) {
        if(register){
            saveUserInterests(connection, uuid, interests)
                .then(resolve, reject);
        }
        else{
            removeUserInterests(connection, uuid, interests)
                .then(resolve, reject);
        }
    })
}

function saveUserInterests(connection, uuid, interests) {
    return new Promise(function (resolve, reject) {

        var sqlParamArr = [];

        interests.map(function (i) {
            sqlParamArr.push([
                uuidGen.v4(),
                i,
                uuid
            ])
        });

        connection.query('INSERT IGNORE INTO UserInterests (uintid, intid, uuid) VALUES ?', [sqlParamArr], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function removeUserInterests(connection, uuid, interests) {
    return new Promise(function (resolve, reject) {
        connection.query('DELETE FROM UserInterests WHERE intid IN (?) AND uuid = ?', [interests, uuid], function (err, rows) {
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
    loadAllInterestsForUser: loadAllInterestsForUser,
    updateUserInterests: updateUserInterests
};