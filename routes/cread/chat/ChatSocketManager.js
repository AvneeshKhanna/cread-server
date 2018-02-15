/**
 * Created by avnee on 15-02-2018.
 */
'use-strict';

var chatconvoutils = require('./ChatConversationUtils');
var config = require('../../Config');
var notify = require('../../notification-system/notificationFramework');

function initialiseSocket(io){

    io.on('connection', function(socket){

        var chat_msg_conn;
        var delete_msg_conn;

        console.log('Connected with socketid ' + socket.id);
        console.log('Connected with uuid ' + socket.handshake.query['uuid']);

        chatconvoutils.addToConnectedUsers(socket);

        console.log("connectedusers are " + JSON.stringify(chatconvoutils.getConnectedUsers(), null, 3));

        //When a user sends a message in the conversation
        socket.on('send-message', function (message) {

            config.getNewConnection()
                .then(function (conn) {
                    chat_msg_conn = conn;
                    //return chatconvoutils.addMessageToDb(chat_msg_conn, message);
                })
                .then(function () {
                    if(chatconvoutils.isUserConnected(message.to)){ //User is online i.e. is on the chat screen

                        console.log("isUserConnected block called");

                        //TODO: Change loop mechanism to make it Promise callback compatible
                        chatconvoutils.getUserSockets(message.to).forEach(function (usersocket) {

                            console.log("getUserSockets block called");

                            return new Promise(function (resolve, reject) {

                                io.to(usersocket)
                                    .emit('send-message', message);

                                resolve();
                            });
                        });
                    }
                    else{   //User is offline i.e is not on the chat screen
                        //TODO: Send a push notification
                        console.log("No user present!");

                        /*var notifData = {
                            message: message.text,
                            persistable: "No",
                            category: "personal-chat"
                        };

                        return notify.notificationPromise(new Array(message.to), notifData);*/
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
                })

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
            chatconvoutils.deleteSocket(socket.id);
            console.log('User deleted. Connected users now are ' + JSON.stringify(chatconvoutils.getConnectedUsers(), null, 3))
        });

    });

}

module.exports = {
    initialiseSocket: initialiseSocket
};


