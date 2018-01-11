/**
 * Created by avnee on 10-01-2018.
 */
'use-strict';

var utils = require('../utils/Utils');
var moment = require('moment');

function deleteFromUpdatesTable(connection, where_col_names, where_col_values){
    return new Promise(function (resolve, reject) {

        var where_array = [];
        var sql_params = [];

        if(!(where_col_names instanceof Array) || !(where_col_values instanceof Array)){
            reject(new Error("where_col_names and where_col_values should be of type array"));
            return;
        }
        else if(where_col_values.length !== where_col_names.length){
            reject(new Error("Number of elements in where_col_names & where_col_values should be same"));
            return;
        }
        else if(where_col_values.length === 0 || where_col_names.length === 0){
            reject(new Error("where_col_names or where_col_values cannot be empty"));
            return;
        }

        for (var i = 0; i < where_col_names.length; i++) {
            var col_name = where_col_names[i];
            var col_value = where_col_values[i];
            where_array.push(col_name + " = ?");
            sql_params.push(col_value);
        }

        connection.query('DELETE FROM Updates WHERE ' + where_array.join(" AND "), sql_params, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function addToUpdatesTable(connection, params){
    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO Updates SET ?', [params], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function updateUpdatesUnreadStatus(connection, updateid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Updates ' +
            'SET unread = ? ' +
            'WHERE updateid = ?', [false, updateid], function (err, rows) {
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
    addToUpdatesTable: addToUpdatesTable,
    updateUpdatesUnreadStatus: updateUpdatesUnreadStatus,
    deleteFromUpdatesTable: deleteFromUpdatesTable
};