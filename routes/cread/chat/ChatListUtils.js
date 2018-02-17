/**
 * Created by avnee on 15-02-2018.
 */
'use-strict';

var moment = require('moment');

var utils = require('../utils/Utils');

function loadAllChats(connection, uuid, limit, lastindexkey){

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT Chat.*, Message.body ' +
            'FROM Chat ' +
            'LEFT JOIN Message ' +
            'ON (Chat.chat_id = Message.chat_id) ' +
            'WHERE (initiator_id = ? ' +
            'OR acceptor_id = ?) ' +
            'AND Message.regdate < ? ' +
            'GROUP BY Chat.chat_id ' +
            'ORDER BY Message.regdate DESC ' +
            'LIMIT ?', [uuid, uuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                if(rows.length > 0){
                    rows.map(function (element) {
                        if(element.initiator_id === uuid){
                            element.profilepicurl = utils.createSmallProfilePicUrl(element.accptr_uuid);
                        }
                        else{
                            element.profilepicurl = utils.createSmallProfilePicUrl(element.initiar_uuid);
                        }
                        return element;
                    });

                    resolve({
                        requestmore: rows.length >= limit,
                        chatlist: rows,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss')
                    });
                }
                else{
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

function markChatAsRead(connection, chat_id){
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Chat ' +
            'SET unread_status = false ' +
            'WHERE chat_id = ?', [chat_id], function (err, rows) {
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
    markChatAsRead: markChatAsRead,
    loadAllChats: loadAllChats
};