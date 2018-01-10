/**
 * Created by avnee on 10-01-2018.
 */
'use-strict';

var utils = require('../utils/Utils');

function addToUpdatesTable(connection, params){
    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO Updates VALUES ?', [params], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function loadUpdates(connection, uuid){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Updates.*, User.firstname, User.lastname, Entity.type ' +
            'FROM Updates ' +
            'JOIN Entity ' +
            'ON (Entity.entityid = Updates.entityid) ' +
            'JOIN User ' +
            'ON (Updates.other_uuid = User.uuid) ' +
            'WHERE Updates.uuid = ? ' +
            'ORDER BY Updates.regdate DESC', [uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {
                    if(element.entityid){
                        if(element.type === 'SHORT'){

                        }
                        else if(element.type === 'CAPTURE'){

                        }
                    }
                });

                resolve();
            }
        });
    });
}

module.exports = {
    loadUpdates: loadUpdates,
    addToUpdatesTable: addToUpdatesTable
};