/**
 * Created by avnee on 22-11-2017.
 */
'use-strict';

function retrieveShortDetails(connection, shoid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT dx, dy, textcolor, textsize, txt AS text ' +
            'FROM Short ' +
            'WHERE shoid = ?', [shoid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows[0]);
            }
        });
    });
}

module.exports = {
    retrieveShortDetails: retrieveShortDetails
};