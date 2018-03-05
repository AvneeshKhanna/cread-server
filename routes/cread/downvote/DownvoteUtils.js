/**
 * Created by avnee on 05-03-2018.
 */
'use-strict';

var uuidgen = require('uuid');

function registerDownvote(connection, register, uuid, entityid) {

    var sqlquery;
    var sqlparams;

    if(register){
        sqlquery = 'INSERT IGNORE INTO Downvote SET ?';
        sqlparams = {
            downvoteid: uuidgen.v4(),
            uuid: uuid,
            entityid: entityid
        }
    }
    else{
        sqlquery = 'DELETE FROM Downvote WHERE uuid = ? AND entityid = ?';
        sqlparams = [
            uuid,
            entityid
        ]
    }

    return new Promise(function (resolve, reject) {
        connection.query(sqlquery, sqlparams, function (err, rows) {
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
    registerDownvote: registerDownvote
}