/**
 * Created by avnee on 01-11-2017.
 */
'use-strict';

function deleteEntity(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('', [], function (err, rows) {
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
    deleteEntity: deleteEntity
};