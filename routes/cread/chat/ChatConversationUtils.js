/**
 * Created by avnee on 15-02-2018.
 */
'use-strict';

var connectedusers = [];
var moment = require('moment');

function isUserConnected(uuid){
    /*return connectedusers.filter(function (connecteduser) {
        return connecteduser.uuid === uuid
    }).length !== 0;*/
    return getUserSockets(uuid).length !== 0;
}

function getUserSockets(uuid){

    var users = connectedusers.filter(function (connecteduser) {
        return connecteduser.uuid === uuid
    });

    return users.map(function (user) {
        return user["socketid"];
    });
}

function deleteSocket(socketid) {
    connectedusers.forEach(function (connecteduser) {
        if(connecteduser.socketid === socketid){
            connectedusers.splice(connectedusers.indexOf(connecteduser), 1);
        }
    });
}

function addToConnectedUsers(socket) {

    var socketdata = {
        uuid: socket.handshake.query['uuid'],
        socketid: socket.id
    };

    connectedusers.push(socketdata);
}

function getConnectedUsers() {
    return connectedusers;
}

function addMessageToDb(connection, message) {

    var messageparams = {
        messageid: uuidgen.v4(),
        from_uuid: message.from_uuid,
        to_uuid: message.to_uuid,
        text: message.text
    };

    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO Message VALUES ?', [messageparams], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function deleteMessageFromDb(connection, message) {
    return new Promise(function (resolve, reject) {
        connection.query('DELETE FROM Message WHERE messageid = ?', [message.messageid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function loadChatMessages(connection, chat_id, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT * ' +
            'FROM Message ' +
            'WHERE chat_id = ? ' +
            'AND regdate > ? ' +
            'ORDER BY regdate DESC' +
            'LIMIT ?', [chat_id, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                lastindexkey = rows.length > 0 ? moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss') : null;

                if(rows.length > 0){

                    //Reversing the order of messages as they will be displayed from bottom to top
                    rows.sort(function (a, b) {
                        if(a.regdate > b.regdate){
                            return -1
                        }
                        else{
                            return 1;
                        }
                    });

                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: lastindexkey,
                        messages: rows
                    });
                }
                else{
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: lastindexkey,
                        messages: rows
                    });
                }

                resolve({
                    requestmore: rows.length >= limit,
                    lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                    messages: rows
                });
            }
        });
    });

}

module.exports = {
    isUserConnected: isUserConnected,
    getUserSockets: getUserSockets,
    deleteSocket: deleteSocket,
    addToConnectedUsers: addToConnectedUsers,
    getConnectedUsers: getConnectedUsers,
    addMessageToDb: addMessageToDb,
    deleteMessageFromDb: deleteMessageFromDb,
    loadChatMessages: loadChatMessages
};