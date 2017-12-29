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

function getShortDetailsFromCollab(connection, entityid, type, select) {

    var sqlquery;

    if(type === 'SHORT'){

        select = select.map(function (el) {
            el = 'S.' + el;
            return el;
        });

        sqlquery = 'SELECT S.txt AS text, ' + select.join(', ') + ' ' +
            'FROM Entity E ' +
            'JOIN Short S ' +
            'USING(entityid) ' +
            'WHERE E.entityid = ?';

    }
    else if(type === 'CAPTURE') {

        select = select.map(function (el) {
            el = 'C.' + el;
            return el;
        });

        sqlquery = 'SELECT S.txt AS text, ' + select.join(', ') + ' ' +
            'FROM Entity E ' +
            'JOIN Capture C ' +
            'ON E.entityid = C.entityid ' +
            'JOIN Short S ' +
            'ON C.shoid = S.shoid ' +
            'WHERE E.entityid = ?';
    }

    return new Promise(function (resolve, reject) {
        connection.query(sqlquery, [entityid], function (err, rows) {
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
    retrieveShortDetails: retrieveShortDetails,
    getShortDetailsFromCollab: getShortDetailsFromCollab
};