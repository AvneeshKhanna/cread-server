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
        connection.query('SELECT Updates.*, User.firstname, User.lastname, Entity.type, Short.shoid, Capture.capid ' +
            'FROM Updates ' +
            'LEFT JOIN Entity ' +
            'ON (Entity.entityid = Updates.entityid) ' +
            'LEFT JOIN Short ' +
            'ON (Entity.entityid = Short.entityid) ' +
            'LEFT JOIN Capture ' +
            'ON (Entity.entityid = Capture.entityid) ' +
            'JOIN User ' +
            'ON (Updates.actor_uuid = User.uuid) ' +
            'WHERE Updates.uuid = ? ' +
            'AND Updates.regdate < ? ' +
            'ORDER BY Updates.regdate DESC ' +
            'LIMIT ?', [uuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                console.log("rows from load updates query is " + JSON.stringify(rows, null, 3));

                if(rows.length > 0){

                    rows.map(function (element) {
                        if(element.entityid) {
                            if (element.type === 'SHORT') {
                                element.entityurl = utils.createSmallShortUrl(element.actor_uuid, element.shoid);
                            }
                            else if (element.type === 'CAPTURE') {
                                element.entityurl = utils.createSmallCaptureUrl(element.actor_uuid, element.capid);
                            }
                        }

                        if(element.actor_uuid){
                            element.actor_profilepicurl = utils.createSmallProfilePicUrl(element.actor_uuid);
                            element.actorname = element.firstname + ' ' + element.lastname;
                        }

                        element.unread = (element.unread === 1);
                        element.other_collaborator = (element.other_collaborator === 1);

                        if(element.hasOwnProperty('type')){
                            delete element.type;
                        }

                        if(element.hasOwnProperty('shoid')){
                            delete element.shoid;
                        }

                        if(element.hasOwnProperty('capid')){
                            delete element.capid;
                        }

                        if(element.hasOwnProperty('firstname')){
                            delete element.firstname;
                        }

                        if(element.hasOwnProperty('lastname')){
                            delete element.lastname;
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