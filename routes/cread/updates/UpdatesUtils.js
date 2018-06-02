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

        params = restructureParamsForAddUpdates(params);

        connection.query('INSERT INTO Updates (uuid, actor_uuid, category, entityid, other_collaborator, productid) ' +
            'VALUES ?', [params], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function restructureParamsForAddUpdates(params){

    if(!params.hasOwnProperty("entityid")){
        params.entityid = null
    }

    if(!params.hasOwnProperty("other_collaborator")){
        params.other_collaborator = false
    }

    if(!params.hasOwnProperty("productid")){
        params.productid = null
    }

    if(!(params.uuid instanceof Array)){
        params.uuid = new Array(params.uuid);
    }

    var masterArr = [];

    params.uuid.forEach(function (uuid) {
        masterArr.push([
            uuid,
            params.actor_uuid,
            params.category,
            params.entityid,
            params.other_collaborator,
            params.productid
        ]);
    });

    return masterArr;
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

function updateUpdatesSeenStatus(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Updates ' +
            'SET unseen = ? ' +
            'WHERE uuid = ? AND unseen = 1', [false, uuid], function (err, rows) {
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
        connection.query('SELECT Updates.*, User.firstname, User.lastname, Entity.type, Short.shoid, Capture.capid, ' +
            'Product.type AS producttype ' +
            'FROM Updates ' +
            'LEFT JOIN Entity ' +
            'ON (Entity.entityid = Updates.entityid) ' +
            'LEFT JOIN Short ' +
            'ON (Entity.entityid = Short.entityid) ' +
            'LEFT JOIN Capture ' +
            'ON (Entity.entityid = Capture.entityid) ' +
            'JOIN User ' +
            'ON (Updates.actor_uuid = User.uuid) ' +
            'LEFT JOIN Product ' +
            'ON (Product.productid = Updates.productid) ' +
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
                        else{
                            element.entityurl = null;
                        }

                        if(element.actor_uuid){
                            element.actor_profilepicurl = utils.createSmallProfilePicUrl(element.actor_uuid);
                            element.actorname = element.firstname + ' ' + element.lastname;
                        }

                        element.unread = (element.unread === 1);
                        element.other_collaborator = (element.other_collaborator === 1);

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

function getNotificationAndChatSeenStatus(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT * ' +
            'FROM Updates ' +
            'WHERE uuid = ? ' +
            'AND unseen = 1 ' +
            'LIMIT 1; ' +
            'SELECT * ' +
            'FROM Chat ' +
            'WHERE (initiator_id = ? AND initr_unseen = 1) ' +
            'OR (acceptor_id = ? AND accptr_unseen = 1) ' +
            'LIMIT 1', [uuid, uuid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                var updates_data = rows[0][0];
                var chats_data = rows[1][0];

                resolve({
                    updates_unseen: !!updates_data,
                    chats_unseen: !!chats_data
                });
            }
        });
    });
}

module.exports = {
    loadUpdates: loadUpdates,
    addToUpdatesTable: addToUpdatesTable,
    updateUpdatesUnreadStatus: updateUpdatesUnreadStatus,
    deleteFromUpdatesTable: deleteFromUpdatesTable,
    getNotificationAndChatSeenStatus: getNotificationAndChatSeenStatus,
    updateUpdatesSeenStatus: updateUpdatesSeenStatus
};