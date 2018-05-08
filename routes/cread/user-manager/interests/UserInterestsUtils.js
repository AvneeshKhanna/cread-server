/**
 * Created by avnee on 02-05-2018.
 */
'use-strict';

function loadAllInterestsForUser(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT I.*, (UI.uintid IS NOT NULL) AS interested ' +
            'FROM Interests I ' +
            'LEFT JOIN UserInterests UI ' +
            'ON(I.intid = UI.intid AND UI.uuid = ?) ' +
            'GROUP BY I.intid', [uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (row) {
                    row.interested = row.interested === 1;
                    return row;
                });

                resolve({
                    interests: rows
                });
            }
        });
    });
}

function saveUserInterests(connection, uuid, interests) {
    return new Promise(function (resolve, reject) {

        var sqlParamArr = [];

        interests.map(function (i) {
            sqlParamArr.push([
                i,
                uuid
            ])
        });

        connection.query('INSERT INTO UserInterests UI (intid, uuid) VALUES ?', [sqlParamArr], function (err, rows) {
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
    saveUserInterests: saveUserInterests
};