/**
 * Created by avnee on 15-02-2018.
 */
'use-strict';

var moment = require('moment');
var uuidgen = require('uuid');

var utils = require('../utils/Utils');

/**
 * To load only those chat of a user where they are following the other person
 * */
function loadPermittedChats(connection, uuid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT UserChats.*, CONCAT_WS(" ", User.firstname, User.lastname) AS receivername ' +
            //'CASE WHEN(Follow.followid IS NOT NULL) THEN "FOLLOWING" ELSE "NOT_FOLLOWING" END AS followstatus ' +
            'FROM ' +
                '(SELECT Chat.chatid, CASE WHEN(Message.from_uuid = ?) THEN 0 ELSE Message.unread END AS unread, ' + //Sub query
                'Message.regdate, Message.body AS lastmessage, ' +
                'CASE WHEN(Chat.initiator_id = ?) THEN Chat.acceptor_id ELSE Chat.initiator_id END AS receiveruuid ' +
                'FROM Chat ' +
                'LEFT JOIN Message ' +
                'ON (Chat.chatid = Message.chatid) ' +
                'JOIN (SELECT MAX(Message.regdate) AS regdate, Message.chatid FROM Chat JOIN Message USING(chatid) GROUP BY Chat.chatid) AS Msg ' + //Nested sub query
                'ON (Message.regdate = Msg.regdate AND Message.chatid = Msg.chatid) ' +
                'WHERE (Chat.initiator_id = ? ' +
                'OR Chat.acceptor_id = ?) ' +
                'GROUP BY Chat.chatid) AS UserChats ' +
            'JOIN User ' +
            'ON (User.uuid = UserChats.receiveruuid) ' +
            'LEFT JOIN Follow ' +
            'ON (Follow.followee = UserChats.receiveruuid) ' +
            'WHERE UserChats.regdate < ? ' +
            'AND Follow.follower = ? ' +    //To load only those chats where the user is following the other person
            'GROUP BY UserChats.chatid ' +
            'ORDER BY UserChats.regdate DESC ' +
            'LIMIT ?', [uuid, uuid, uuid, uuid, lastindexkey, uuid, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if (rows.length > 0) {
                    rows.map(function (element) {

                        element.profilepicurl = utils.createSmallProfilePicUrl(element.receiveruuid);
                        element.unread = element.unread === 1;

                        return element;
                    });

                    resolve({
                        requestmore: rows.length >= limit,
                        chatlist: rows,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss')
                    });
                }
                else {
                    resolve({
                        requestmore: rows.length >= limit,
                        chatlist: rows,
                        lastindexkey: null
                    });
                }
            }
        });
    });
}

function loadChatRequests(connection, uuid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT UserChats.*, CONCAT_WS(" ", User.firstname, User.lastname) AS receivername ' +
            //'CASE WHEN(Follow.followid IS NOT NULL) THEN "FOLLOWING" ELSE "NOT_FOLLOWING" END AS followstatus ' +
            'FROM ' +
                '(SELECT Chat.chatid, CASE WHEN(Message.from_uuid = ?) THEN 0 ELSE Message.unread END AS unread, ' +
                'Message.regdate, Message.body AS lastmessage, ' +
                'CASE WHEN(Chat.initiator_id = ?) THEN Chat.acceptor_id ELSE Chat.initiator_id END AS receiveruuid ' +
                'FROM Chat ' +
                'LEFT JOIN Message ' +
                'ON (Chat.chatid = Message.chatid) ' +
                'JOIN (SELECT MAX(Message.regdate) AS regdate, Message.chatid FROM Chat JOIN Message USING(chatid) GROUP BY Chat.chatid) AS Msg ' + //Nested sub query
                'ON (Message.regdate = Msg.regdate AND Message.chatid = Msg.chatid) ' +
                'WHERE (Chat.initiator_id = ? ' +
                'OR Chat.acceptor_id = ?) ' +
                'GROUP BY Chat.chatid ' +
                //'ORDER BY regdate DESC' +
                ') AS UserChats ' +
            'JOIN User ' +
            'ON (User.uuid = UserChats.receiveruuid) ' +
            'LEFT JOIN Follow ' +
            'ON (Follow.followee = UserChats.receiveruuid AND Follow.follower = ?) ' +
            'WHERE UserChats.regdate < ? ' +
            'AND Follow.followid IS NULL ' +    //To load only those chats where the user is not following the other person
            'GROUP BY UserChats.chatid ' +
            'ORDER BY UserChats.regdate DESC ' +
            'LIMIT ?', [uuid, uuid, uuid, uuid, uuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                if (rows.length > 0) {
                    rows.map(function (element) {

                        element.profilepicurl = utils.createSmallProfilePicUrl(element.receiveruuid);
                        element.unread = element.unread === 1;

                        return element;
                    });

                    resolve({
                        requestmore: rows.length >= limit,
                        chatlist: rows,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss')
                    });
                }
                else {
                    resolve({
                        requestmore: rows.length >= limit,
                        chatlist: rows,
                        lastindexkey: null
                    });
                }
            }
        });
    });
}

function markChatAsRead(connection, chatid, requesteruuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Message ' +
            'SET unread = false ' +
            'WHERE chatid = ? ' +
            'AND from_uuid <> ?', [chatid, requesteruuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function markChatsSeen(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Chat SET', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function updateChatsUnseenStatus(connection, unseen, to_uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Chat ' +
            'SET accptr_unseen = CASE WHEN (acceptor_id = ?) THEN ? ELSE accptr_unseen END, ' +
            'initr_unseen = CASE WHEN(initiator_id = ?) THEN ? ELSE initr_unseen END ', [to_uuid, unseen, to_uuid, unseen], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function createNewChat(connection, message) {
    return new Promise(function (resolve, reject) {

        var chat_uuids = [
            message.from_uuid,
            message.to_uuid
        ];

        connection.query('SELECT * ' +
            'FROM Chat ' +
            'WHERE initiator_id IN (?) ' +
            'AND acceptor_id IN (?)', [chat_uuids, chat_uuids], function (err, rows) {
            if(err){
                reject(err);
            }
            else{
                //Chat exists already. Skip creating a new chat
                if(rows.length > 0){
                    resolve(rows[0].chatid);
                    console.log('Chat already exists');
                }
                //Chat doesn't exists. Create new chat
                else{

                    var newchatparams = {
                        chatid : uuidgen.v4(),
                        initiator_id: message.from_uuid,
                        acceptor_id: message.to_uuid
                    };

                    connection.query('INSERT INTO Chat SET ?', [newchatparams], function (err, rows) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(newchatparams.chatid);
                        }
                    });
                }
            }
        });

    });
}

function getChatRequestsCount(connection, uuid){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(DISTINCT UserChats.chatid) AS requestcount ' +
            'FROM ' +
                '(SELECT DISTINCT Chat.chatid, ' +
                'CASE WHEN(Chat.initiator_id = ?) THEN Chat.acceptor_id ELSE Chat.initiator_id END AS receiveruuid ' +
                'FROM Chat ' +
                'WHERE (Chat.initiator_id = ? ' +
                'OR Chat.acceptor_id = ?)) AS UserChats ' +
            'LEFT JOIN Follow ' +
            'ON (Follow.followee = UserChats.receiveruuid AND Follow.follower = ?) ' +
            'WHERE Follow.followid IS NULL ', [uuid, uuid, uuid, uuid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {
                console.log("row from requestcount query  is " + JSON.stringify(row, null, 3));
                var requestcount = !row[0] ? 0 : row[0].requestcount;
                resolve(requestcount);
            }
        });
    });
}

module.exports = {
    markChatAsRead: markChatAsRead,
    updateChatsUnseenStatus: updateChatsUnseenStatus,
    loadPermittedChats: loadPermittedChats,
    loadChatRequests: loadChatRequests,
    createNewChat: createNewChat,
    getChatRequestsCount: getChatRequestsCount
};