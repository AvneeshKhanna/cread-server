/**
 * Created by avnee on 15-02-2018.
 */
'use-strict';

var connectedusers = [];
var moment = require('moment');
var uuidgen = require('uuid');

var utils = require('../utils/Utils');
var notify = require('../../notification-system/notificationFramework');

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

function deleteSocket(socket) {
    connectedusers.forEach(function (connecteduser) {
        if(connecteduser.socketid === socket.id){
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
    return new Promise(function (resolve, reject) {

        var messageparams = {
            messageid: uuidgen.v4(),
            from_uuid: message.from_uuid,
            to_uuid: message.to_uuid,
            body: message.body,
            chatid: message.chatid
        };

        connection.query('INSERT INTO Message SET ?', [messageparams], function (err, rows) {
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

function loadChatMessages(connection, from_uuid, to_uuid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    var chat_uuids = [
        from_uuid,
        to_uuid
    ];

    return new Promise(function (resolve, reject) {
        connection.query('SELECT * ' +
            'FROM Message ' +
            'WHERE from_uuid IN (?) ' +
            'AND to_uuid IN (?) ' +
            'AND regdate < ? ' +
            'ORDER BY regdate DESC ' +
            'LIMIT ?', [chat_uuids, chat_uuids, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                lastindexkey = rows.length > 0 ? moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss') : null;

                if(rows.length > 0){

                    //Reversing the order of messages as they will be displayed from bottom to top
                    rows.sort(function (a, b) {
                        if(a.regdate > b.regdate){
                            return 1
                        }
                        else{
                            return -1;
                        }
                    });

                    rows.map(function (element) {
                        element.unread = (element.unread === 1);
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
            }
        });
    });

}

function isReceiverFollowingSender(connection, msg_sender_uuid, msg_receiver_uuid){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Follow.followid ' +
            'FROM Follow ' +
            'WHERE followee = ? ' +
            'AND follower = ?', [msg_sender_uuid, msg_receiver_uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(!!rows[0]);
            }
        });
    });
}

function sendChatMessageNotification(connection, message){
    return new Promise(function (resolve, reject) {
        isReceiverFollowingSender(connection, message.from_uuid, message.to_uuid)
            .then(function (isFollowing) {

                var notif_category;

                if(isFollowing){
                    console.log('Personal chat notification sent');
                    notif_category = "personal-chat";
                }
                else{
                    notif_category = "personal-chat-request";
                    console.log('Message would be a request');
                }

                var notifData = {
                    message: message.body,
                    persistable: "No",
                    category: notif_category,
                    chatid: message.chatid,
                    from_name: message.from_name,
                    from_uuid: message.from_uuid,
                    from_profilepicurl: message.from_profilepicurl
                };

                return notify.notificationPromise(new Array(message.to_uuid), notifData);

            })
            .then(function () {
                resolve();
            })
            .catch(function (err) {
                reject(err);
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
    loadChatMessages: loadChatMessages,
    sendChatMessageNotification: sendChatMessageNotification
};