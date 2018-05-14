/**
 * Created by avnee on 14-05-2018.
 */
'use-strict';

function loadMacroInterests(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT MI.mintid, MI.mintname, MI.type ' +
            'FROM MacroInterests MI', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve({
                    items: rows
                });
            }
        });
    });
}

module.exports = {
    loadMacroInterests: loadMacroInterests
};