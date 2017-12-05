/**
 * Created by avnee on 22-11-2017.
 */
'use-strict';

function retrieveShortDetails(connection, shoid, select) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT ' + select.join(', ') + ' ' +
            'FROM Short ' +
            'WHERE shoid = ?', [shoid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {
                    if(!element.font){
                        element.font = 'NA';
                    }
                });

                resolve(rows[0]);
            }
        });
    });
}

module.exports = {
    retrieveShortDetails: retrieveShortDetails
};