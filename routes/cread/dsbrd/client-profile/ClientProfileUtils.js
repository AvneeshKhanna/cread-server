/**
 * Created by avnee on 31-08-2017.
 */
'use-strict';

var config = require('../../../Config');

function updateClientProfile(clientid, params, connection) {
    return new Promise(function (resolve, reject) {

        if (!connection) {
            connection = config.createConnection;
        }

        connection.query('UPDATE Client SET ? WHERE clientid = ?', [params, clientid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
}

module.exports = {
    updateClientProfile: updateClientProfile
};