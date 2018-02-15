/**
 * Created by avnee on 15-02-2018.
 */
'use-strict';

var utils = require('../utils/Utils');

function loadAllChats(connection, uuid, lastindexkey){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Chat.*, Message.body ' +
            'FROM Chat ' +
            'LEFT JOIN Message ' +
            'ON (Chat.chat_id = Message.chat_id) ' +
            'WHERE initiar_uuid = ? ' +
            'OR accptr_uuid = ? ' +
            'GROUP BY Chat.chat_id ' +
            'ORDER BY Message.regdate DESC', [uuid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {
                    if(element.initiar_uuid === uuid){
                        element.profilepicurl = utils.createSmallProfilePicUrl(element.accptr_uuid);
                    }
                    else{
                        element.profilepicurl = utils.createSmallProfilePicUrl(element.initiar_uuid);
                    }
                    return element;
                });

                resolve(rows);
            }
        });
    });
}

function markChatAsRead(connection, chat_id){
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Chat SET unread_status = false WHERE chat_id = ?', [chat_id], function (err, rows) {
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