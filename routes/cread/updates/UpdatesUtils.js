/**
 * Created by avnee on 10-01-2018.
 */
'use-strict';

var utils = require('../utils/Utils');
var moment = require('moment');

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

function loadUpdates(connection, uuid, lastindexkey, limit){

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT Updates.*, User.firstname, User.lastname, Entity.type ' +
            'FROM Updates ' +
            'JOIN Entity ' +
            'ON (Entity.entityid = Updates.entityid) ' +
            'JOIN User ' +
            'ON (Updates.other_uuid = User.uuid) ' +
            'WHERE Updates.uuid = ? ' +
            'AND Updates.regdate < ? ' +
            'ORDER BY Updates.regdate DESC ' +
            'LIMIT ?', [uuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                if(rows.length > 0){

                    rows.map(function (element) {
                        if (element.entityid) {
                            if (element.type === 'SHORT') {

                            }
                            else if (element.type === 'CAPTURE') {

                            }
                        }
                    });

                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        items: rows
                    });
                }
                else {
                    resolve({
                        requestmore: false,
                        lastindexkey: null,
                        items: rows
                    });
                }
            }
        });
    });
}

module.exports = {
    loadUpdates: loadUpdates,
    addToUpdatesTable: addToUpdatesTable
};