/**
 * Created by avnee on 14-05-2018.
 */
'use-strict';

function loadMacroInterests(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT MI.mintid, MI.mintname, ' +
            'CASE WHEN MI.type = "GENERAL" THEN "FEEL" ELSE MI.type END AS type ' +
            'FROM MacroInterests MI', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.push({ //For explore feed filters
                    mintid: "",
                    mintname: "All",
                    type: "DEFAULT"
                });

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