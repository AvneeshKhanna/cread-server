/**
 * Created by avnee on 22-11-2017.
 */
'use-strict';

const utils = require('../utils/Utils');
const consts = require('../utils/Constants');
const post_type = consts.post_type;

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

    let sqlquery;

    if(type === post_type.SHORT){

        select = select.map(function (el) {
            el = 'S.' + el;
            return el;
        });

        sqlquery = 'SELECT C.entityid, C.uuid, S.txt AS text, ' + select.join(', ') + ' ' +
            'FROM Entity E ' +
            'JOIN Short S ' +
            'USING(entityid) ' +
            'LEFT JOIN Capture C ' +
            'ON (S.capid = C.capid) ' +
            'WHERE E.entityid = ?';

    }
    else if(type === post_type.CAPTURE) {

        select = select.map(function (el) {
            el = 'C.' + el;
            return el;
        });

        sqlquery = 'SELECT S.entityid, S.uuid, S.txt AS text, ' + select.join(', ') + ' ' +
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

                    if(element.capid){
                        element.captureurl = utils.createCaptureUrl(element.uuid, element.capid);
                    }
                    else{
                        element.captureurl = null;
                    }

                });

                resolve(rows[0]);
            }
        });
    });
}

function addShortToDb(connection, shortsqlparams, entityparams) {
    return new Promise(function (resolve, reject) {
        /*connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{


            }
        });*/

        entityparams.type = post_type.SHORT;

        connection.query('INSERT INTO Entity SET ?', [entityparams], function (err, edata) {
            if (err) {
                /*connection.rollback(function () {
                    reject(err);
                });*/
                reject(err);
            }
            else {
                connection.query('INSERT INTO Short SET ?', [shortsqlparams], function (err, rows) {
                    if (err) {
                        /*connection.rollback(function () {
                            reject(err);
                        });*/
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            }
        });

    });
}

function updateShortInDb(connection, shoid, shortsqlparams, entityid, entityparams){
    return new Promise(function (resolve, reject) {
        /*connection.beginTransaction(function (err) {
            if(err){
                connection.rollback(function () {
                    reject(err);
                });
            }
            else{


            }
        });*/

        connection.query('UPDATE Entity SET ? WHERE entityid = ?', [entityparams,  entityid], function (err, edata) {
            if (err) {
                reject(err);
            }
            else {
                connection.query('UPDATE Short SET ? WHERE shoid = ?', [shortsqlparams, shoid], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            }
        });

    });
}

module.exports = {
    retrieveShortDetails: retrieveShortDetails,
    addShortToDb: addShortToDb,
    updateShortInDb: updateShortInDb,
    getShortDetailsFromCollab: getShortDetailsFromCollab
};