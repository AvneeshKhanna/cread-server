/**
 * Created by avnee on 15-02-2018.
 */
'use-strict';

var chatconvoutils = require('./ChatConversationUtils');
var chatlistutils = require('./ChatListUtils');
var config = require('../../Config');
var notify = require('../../notification-system/notificationFramework');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var async = require('async');
var uuidgen = require('uuid');

var utils = require('../utils/Utils');

function initialiseSocket(io){

    io.on('connection', function(socket){

        var delete_msg_conn;

        //Adding the user to the list of active socket connections
        chatconvoutils.addToConnectedUsers(socket);

        console.log("connectedusers are " + JSON.stringify(chatconvoutils.getConnectedUsers(), null, 3));

        console.log("connected sockets are " + JSON.stringify(Object.keys(io.sockets.sockets)));

        //When a user sends a message in the conversation
        socket.on('send-message', function (message) {

            var chat_msg_conn;
            var mark_chats_unseen;

            mark_chats_unseen = !chatconvoutils.isUserConnected(message.to_uuid);
            message.unread = !chatconvoutils.isUserConnected(message.to_uuid);
            message.from_profilepicurl = utils.createSmallProfilePicUrl(message.from_uuid);

            config.getNewConnection()
                .then(function (conn) {
                    chat_msg_conn = conn;
                    return utils.beginTransaction(chat_msg_conn);
                })
                .then(function () {
                    console.log("message received is " + JSON.stringify(message, null, 3));
                    if(!message.chatid){   //Case where this is the first message of the chat
                        return chatlistutils.createNewChat(chat_msg_conn, message);
                    }
                })
                .then(function (chatid) {
                    if(chatid){
                        message.chatid = chatid;
                    }
                    return chatconvoutils.addMessageToDb(chat_msg_conn, message);
                })
                .then(function () {
                    if(mark_chats_unseen){
                        return chatlistutils.updateChatsUnseenStatus(chat_msg_conn, true, message.to_uuid);
                    }
                })
                .then(function () {
                    return utils.commitTransaction(chat_msg_conn);
                }, function (err) {
                    return utils.rollbackTransaction(chat_msg_conn, undefined, err);
                })
                .then(function () {
                    if(chatconvoutils.isUserConnected(message.to_uuid)){ //User is online i.e. is on the chat screen

                        console.log("User online. Send a message");

                        /*chatconvoutils.getUserSockets(message.to_uuid).forEach(function (usersocket) {

                            console.log("getUserSockets block called");

                            return new Promise(function (resolve, reject) {
                                io.to(usersocket)
                                    .emit('send-message', message);

                                resolve();
                            });
                        });*/

                        async.eachSeries(chatconvoutils.getUserSockets(message.to_uuid), function (usersocket, callback) {
                            console.log("async block for getUserSockets called with socket " + usersocket);
                            io.to(usersocket)
                                .emit('send-message', message);
                            callback();
                        }, function (err) {
                            return new Promise(function (resolve, reject) {
                                if(err){
                                    // One of the iterations produced an error.
                                    // All processing will now stop.
                                    reject(err);
                                }
                                else{
                                    resolve();
                                }
                            });
                        })

                    }
                    else{   //User is offline i.e is not on the chat screen
                        console.log("User offline. Send a notification!");
                        return chatconvoutils.sendChatMessageNotification(chat_msg_conn, message)
                    }
                })
                .then(function () {
                    throw new BreakPromiseChainError(); //To release server connection
                })
                .catch(function (err) {
                    config.disconnect(chat_msg_conn);
                    if(err instanceof BreakPromiseChainError){
                        //Do nothing
                    }
                    else{
                        console.error(err);
                    }
                });

        });

        //When a user deletes his/her message from the conversation
        socket.on('delete-message', function (message) {
            config.getNewConnection()
                .then(function (conn) {
                    delete_msg_conn = conn;
                    return chatconvoutils.deleteMessageFromDb(delete_msg_conn, message);
                })
                .then(function () {
                    if(chatconvoutils.isUserConnected(message.to)){ //User is online i.e. is on the chat screen

                        console.log("isUserConnected block called");

                        //TODO: Change loop mechanism to make it Promise callback compatible
                        chatconvoutils.getUserSockets(message.to).forEach(function (usersocket) {

                            console.log("getUserSockets block called");

                            return new Promise(function (resolve, reject) {

                                io.to(usersocket)
                                    .emit('delete-message', message);

                                resolve();
                            });
                        });
                    }

                })
                .catch(function (err) {
                    config.disconnect(delete_msg_conn);
                    if(err instanceof BreakPromiseChainError){
                        //Do nothing
                    }
                    else{
                        console.error(err);
                    }
                });
        });

        socket.on('disconnect', function () {
            chatconvoutils.deleteSocket(socket);
            console.log('User disconnected. Connected users now are ' + JSON.stringify(chatconvoutils.getConnectedUsers(), null, 3))
        });

        socket.on('connection_error', function () {
            chatconvoutils.deleteSocket(socket);
            console.log('Socket connection failed. Connected users now are ' + JSON.stringify(chatconvoutils.getConnectedUsers(), null, 3));
        })

    });

}

module.exports = {
    initialiseSocket: initialiseSocket
};


