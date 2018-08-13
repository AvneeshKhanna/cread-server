/**
 * Created by avnee on 26-09-2017.
 */

/**
 * This file takes care of tasks that have been executed only one-time (or very rarely) during the lifetime of this server codebase.
 * Example Task: Calculating and adding default values to a newly created column in a table for backward compatibility or data consistency
 * */

'use-strict';

const express = require('express');
const router = express.Router();

const config = require('../../Config');
const _auth = require('../../auth-token-management/AuthTokenManager');
const BreakPromiseChainError = require('../utils/BreakPromiseChainError');
const utils = require('./Utils');
const entityspecificutils = require('../entity/EntitySpecificUtils');
const entityimgutils = require('../entity/EntityImageUtils');
const followutils = require('../follow/FollowUtils');
const chatconvoutils = require('../chat/ChatConversationUtils');
let usranlytcsutils = require('../user-manager/analytics/UserAnalyticsUtils');
const consts = require('./Constants');
const post_type = consts.post_type;

const async = require('async');
const uuidGen = require('uuid');

let download_base_path = './images/downloads';

router.post('/add-entity-data', function (request, response) {

    let connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return addEntityData(connection);
        })
        .then(function (result) {
            response.send(result).end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            if (err instanceof BreakPromiseChainError) {
                console.log('BreakPromiseChainError called');
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        })

});

function addEntityData(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT cmid FROM Campaign WHERE entityid IS NOT NULL', null, function (err, data) {
            if (err) {
                reject(err);
            }
            else {

                config.disconnect(connection);

                async.eachSeries(data, function (cmid, callback) {

                    let entityid = uuidGen.v4();

                    config.connectionPool.getConnection(function (error, conn) {

                        if (error) {
                            callback(error);
                        }
                        else {
                            conn.beginTransaction(function (err) {
                                if (err) {
                                    conn.rollback(function () {
                                        console.log('TRANSACTION ROLLBACKED');
                                        config.disconnect(conn);
                                        callback(err);
                                    });
                                }
                                else {
                                    conn.query('INSERT INTO Entity SET entityid = ?, type = "CAMPAIGN"', [entityid], function (err, row) {
                                        if (err) {
                                            conn.rollback(function () {
                                                console.log('TRANSACTION ROLLBACKED');
                                                config.disconnect(conn);
                                                callback(err);
                                            });
                                        }
                                        else {
                                            conn.query('UPDATE Campaign SET entityid = ? WHERE cmid = ?', [entityid, cmid.cmid], function (err, row2) {
                                                if (err) {
                                                    conn.rollback(function () {
                                                        console.log('TRANSACTION ROLLBACKED');
                                                        config.disconnect(conn);
                                                        callback(err);
                                                    });
                                                }
                                                else {
                                                    conn.commit(function (err) {
                                                        if (err) {
                                                            conn.rollback(function () {
                                                                console.log('TRANSACTION ROLLBACKED');
                                                                config.disconnect(conn);
                                                                callback(err);
                                                            });
                                                        }
                                                        else {
                                                            console.log('TRANSACTION COMMITTED');
                                                            config.disconnect(conn);
                                                            callback();
                                                            if (data.indexOf(cmid) === data.length - 1) { //Last case of async.eachSeries
                                                                resolve("Process completed. Please check if there are any inconsistencies in the database");
                                                            }
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }

                    });

                }, function (err) {
                    if (err) {
                        console.error(err);
                    }
                });
            }
        });
    });
}

router.post('/load-capture-urls', function (request, response) {

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return loadCaptureUrls(connection);
        })
        .then(function (data) {
            response.send(data.map(function (e) {
                return e.captureurl;
            }));
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

function loadCaptureUrls(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT capid, uuid FROM Capture WHERE shoid IS NOT NULL ORDER BY capid', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                rows.map(function (element) {
                    element.captureurl = utils.createSmallCaptureUrl(element.uuid, element.capid);
                    return element;
                });

                resolve(rows);
            }
        });
    });
}

router.post('/default-follow-cread-kalakaar', function (request, response) {

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;

            return new Promise(function (resolve, reject) {
                connection.query('SELECT DISTINCT uuid FROM User WHERE uuid <> ?', [config.getCreadKalakaarUUID()], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        console.log("users are " + JSON.stringify(rows, null, 3));

                        resolve(rows.map(function (row) {
                            return row.uuid;
                        }));
                    }
                });
            });

        })
        .then(function (user_uuids) {
            response.status(200).send("Process initiated").end();
            return registerAllFollowCreadKalakaar(connection, user_uuids);
        })
        .then(function () {
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

function registerAllFollowCreadKalakaar(connection, user_uuids) {
    return new Promise(function (resolve, reject) {
        async.eachSeries(user_uuids, function (user_uuid, callback) {
            utils.beginTransaction(connection)
                .then(function () {
                    return followutils.registerFollowForCreadKalakaar(connection, user_uuid)
                })
                .then(function () {
                    setTimeout(function () {
                        callback();
                    }, 1000);
                })
                .catch(function (err) {
                    callback(err);
                });
        }, function (err) {
            if (err) {
                utils.rollbackTransaction(connection, undefined, err)
                    .catch(function (err) {
                        reject(err);
                    });
            }
            else {
                utils.commitTransaction(connection)
                    .then(function () {
                        resolve();
                    });
            }
        })
    });
}

router.post('/default-chat-cread-kalakaar', function (request, response) {
    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;

            return new Promise(function (resolve, reject) {
                connection.query('SELECT DISTINCT uuid FROM User WHERE uuid <> ?', [config.getCreadKalakaarUUID()], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        console.log("users are " + JSON.stringify(rows, null, 3));

                        resolve(rows.map(function (row) {
                            return row.uuid;
                        }));
                    }
                });
            });

        })
        .then(function (user_uuids) {
            response.status(200).send("Process initiated").end();
            return addAllDefaultMessageFromCreadKalakaar(connection, user_uuids);
        })
        .then(function () {
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

function addAllDefaultMessageFromCreadKalakaar(connection, user_uuids) {
    return new Promise(function (resolve, reject) {
        async.eachSeries(user_uuids, function (user_uuid, callback) {
            utils.beginTransaction(connection)
                .then(function () {
                    return chatconvoutils.addDefaultMessageFromCreadKalakaar(connection, user_uuid);
                })
                .then(function () {
                    setTimeout(function () {
                        callback();
                    }, 1000);
                })
                .catch(function (err) {
                    callback(err);
                })
        }, function (err) {
            if (err) {
                utils.rollbackTransaction(connection, undefined, err)
                    .catch(function (err) {
                        reject(err);
                    });
            }
            else {
                utils.commitTransaction(connection)
                    .then(function () {
                        resolve();
                    });
            }
        })
    });
}

router.post('/add-product-images', function (request, response) {

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return new Promise(function (resolve, reject) {
                connection.query('SELECT entityid ' +
                    'FROM Entity ' +
                    'WHERE product_overlay = 0 ' +
                    'AND merchantable = 1 ' +
                    'AND status = "ACTIVE" ' +
                    'ORDER BY regdate DESC ' +
                    'LIMIT 7', [false], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(rows);
                    }
                });
            });
        })
        .then(function (entities) {
            response.send("Process Initiated").end();
            return createMultipleEntityProductImages(entities);
        })
        .then(function () {
            console.log("PROCESS OVER");
            //response.send("Process Initiated").end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                if (!response.headerSent) {
                    response.status(500).send({
                        message: 'Some error occurred at the server'
                    });
                    response.end();
                }
            }
        });

});

function createMultipleEntityProductImages(entities) {
    return new Promise(function (resolve, reject) {
        async.eachOf(entities, function (entity, index, callback) {

            var connection;

            config.getNewConnection()
                .then(function (conn) {
                    connection = conn;
                    return utils.beginTransaction(connection);
                })
                .then(function () {
                    return createEntityProductImage(connection, entity.entityid);
                })
                .then(function () {
                    return utils.commitTransaction(connection);
                }, function (err) {
                    return utils.rollbackTransaction(connection, undefined, err);
                })
                .then(function () {
                    callback();
                })
                .catch(function (err) {
                    console.error(err);
                    console.log("createMultipleEntityProductImages() -> " + entity.entityid + " created an error");
                    callback();
                })

        }, function (err) {
            if (err) {
                console.log('All data could not be processed');
                reject(err);
            }
            else {
                console.log('All data processed');
                resolve();
            }
        })
    });
}

function createEntityProductImage(connection, entityid) {
    return new Promise(function (resolve, reject) {

        let edata;
        let download_file_name;

        entityspecificutils.loadEntityData(connection, config.getCreadKalakaarUUID(), entityid)
            .then(function (ed) {
                edata = ed.entity;
                download_file_name = entityid + '-product-process.jpg';
                return utils.downloadFile(download_base_path, download_file_name, edata.entityurl);
            })
            .then(function (downloadpath) {
                return entityimgutils.createOverlayedImageJournal(edata.type === post_type.SHORT ? edata.shoid : edata.captureid, edata.type, edata.uuid, download_base_path + '/' + download_file_name);
            })
            .then(function () {
                return entityimgutils.createOverlayedImageCoffeeMug(edata.type === post_type.SHORT ? edata.shoid : edata.captureid, edata.uuid, edata.type, download_base_path + '/' + download_file_name);
            })
            .then(function () {
                return new Promise(function (resolve, reject) {
                    connection.query('UPDATE Entity ' +
                        'SET product_overlay = ? ' +
                        'WHERE entityid = ?', [true, entityid], function (err, rows) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                    });
                });
            })
            .then(resolve, reject);
    });
}

router.post('/populate-help-ques', function (request, response) {
    var ques = [
        "What is the app about?",
        "How do I post something?",
        "What does it mean to 'collaborate'?",
        "How do I collaborate?",
        "I don't want others to collaborate on my art. What to do?",
        "I can't find new people on the app. What to do?",
        "Who are 'Featured Artists'?",
        "How do I become a featured artist?",
        "What is 'Hashtag of the Day'?",
        "I want better 'Hashtag of the Day's to post on",
        "Can I chat with other users on the app?",
        "I am having difficulties with chatting on app. What to do?",
        "The app is really buggy. What to do?",
        "I really like writing on the app. But it is not very smooth. What to do?",
        "I really like uploading photos on the app. But I need better features around it. What to do?",
        "I don't get much notifications. What to do?",
        "Can I earn anything on the app? How?",
        "Where I can view my earnings?",
        "I can't find good posts on the app. What to do?",
        "How do I get more followers? ",
        "Who is Cread Kalakaar and how to reach them?"
    ];

    var ans = [
        "Cread is an app which celebrates art by giving artists a platform to express themselves. Artists can do that by uploading a graphic art (example a drawing, a sketch, a photograph etc.) or by writing on the app (example a quote, a poem, a story, an experience etc.) That's not all, artists can collaborate with others by mixing two forms of art. If you're uploading a graphic art, you can use somebody else's writing to place on your art. If you're writing, you use somebody's visual art to place on your writing. It's a community of beautiful artists who create, collaborate and also earn from their great work. ",
        "You can do that by tapping the 'Add' option in the bottom menu bar. Select 'Writing' if you want to write or 'Add a Graphic Art' if you want to upload a graphic art. ",
        "You can post something by collaborating with other artists' works. If you're writing something, you can use other artists' graphic art to place it on your writing. If you're uploading a graphic art, you can use other artists' writings to place it on your photo. Collaboration makes things beautiful! ",
        "If you tap on any post, there is a 'Collaborate' button on top right of the screen. Tap the button to start collaboration. Moreover, when you click on 'Add' button  on the bottom menu bar and select 'Writing', the next screen also gives you a lot of options of graphic art to select and place behind. All the art here belongs to artists on Cread, so if you use any one of them, you collaborate! Collaboration is love! ",
        "Currently, we are working on giving privacy controls to artists who don't want others to use their art for collaboration. We are planning to include options where users can turn on 'No-Collaboration' settings for individual posts or restrict collaborations to only people who they follow. Currently, everything you post is up for collaboration. ",
        "We have a search option on top of 'Feed' screen and 'Explore' screen. You can tap on the 'magnifying glass' icon to search for new users. You can also follow artists directly from 'Explore' screen by tapping on any post and clicking the 'Follow' button just below the artist's profile picture.",
        "Featured artists are users who post good content on the app. Artists's who receive good comments, collaborations and hats-offs on their work have higher chances of becoming a featured artist. Artists get featured every 24 hours on Cread!",
        "There are no specific steps to follow to become a featured artist. Just keep on posting good work and if other users like your work, you might become a featured artist the next day",
        "To bring the community of artists closer together, we provide meaningful, fun topics in the form of a hashtag to everyone. Whenever somebody uses that hashtag in their post caption, their post gets featured under that Hashtag's screen. You can find the 'Hashtag of the Day' on top of your 'Feed' screen. It brings everyone together. ",
        "We always try to provide the best and most engaging hashtags to our community to inspire them. However, if you somehow don't find them interesting enough, you can message about it to Cread Kalakaar by tapping on the 'message' icon on top of 'Me' screen. We're always listening!",
        "Yes, you can! When you visit somebody's profile, there is a 'chat' icon just on the right of the 'Follow' button below their name. However, you need to follow the other user to send them a chat message. If they follow you back, they will also be able to respond to your messages. ",
        "We're working hard to improve our chatting system. However, if you still face difficulties, you can message about it to Cread Kalakaar. We'd love to help you out!",
        "We're working hard to make our systems bug-free. However, if you still face difficulties, you can message about it to Cread Kalakaar. We really want to hear from you!",
        "We're working hard to make our systems smooth-er. However, if you still face difficulties, you can message about it to Cread Kalakaar. We can make the community better, together!",
        "We're working to add more features for graphic artists. We're planning to add some animation effects which can really add an interesting twist to the photos. However, if you still feel things need improvement, you can message about it to Cread Kalakaar. Your feedback is gold!",
        "It could be because your phone settings don't allow notifications to arrive when Cread is running in the background. You could try changing your phone settings by reading this helpful link: https://support.google.com/android/answer/6111294?hl=en",
        "Yes, you can! Every artwork a user posts, is available for others to buy as merchandize (Coffee Mugs, Posters, etc.). To be eligble or printouts, our post's image resolution should be above 1800x180 px. Anyone can buy by tapping on the post and clicking on the 'Buy' button on the bottom right portion. You should share your work on Cread with everyone you know! You never know who buys. ",
        "Under 'Me' screen, you can tap on the 'wallet' icon on top to view who all have purchased your artwork. You can also redeem your earnings directly to our PaTM wallet from there.",
        "The key to finding good posts is following good artists on the app. We recommend you to follow as many good artists as you can find. Moreover, you post good artwork, it will show high up on the content list in 'Explore' screen thus making it easy for other good artists to connect with you.",
        "The best way to get appreciation is by appreciating others' work. Artists feel really nice when you appreciate their hard work. And when they feel nice, they appreciate you back! So appreciate others' work by giving them Hats-offs and Comments! You'll get a lot of love and great number of followers. Love multiplies!  ",
        "Cread Kalakaar is an artist like you who is there to provide you any kind of support you need. You can directly contact them for any queries by tapping the 'message' icon on top of 'Me' screen or tapping the 'Chat with us' option under 'Settings' screen"
    ];

    var action_txt = [
        "I still don't get it",
        "I still don't get it",
        "I still don't get it",
        "I still don't get it",
        "Notify me about this in future",
        "I still can't find",
        "I still don't get it",
        "I still don't get it",
        "I still don't get it",
        "Notify me about this in future",
        "I still don't get it",
        "Notify me about this in future",
        "Notify me about this in future",
        "Notify me about this in future",
        "Notify me about this in future",
        "I still don't get notifications",
        "I still don't get it",
        "I still can't find",
        "I still can't find",
        "I want to learn more",
        "I still can't find"
    ];

    var sqlparams = [];

    for (var i = 0; i < ques.length; i++) {
        var q = ques[i];
        sqlparams.push([
            q,
            ans[i],
            action_txt[i]
        ]);
    }

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return addDataToHelpQues(connection, sqlparams);
        })
        .then(function () {
            response.send({
                status: 'done'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

function addDataToHelpQues(connection, sqlparams) {
    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO HelpQues (question, answer, action_txt) VALUES ?', [sqlparams], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

router.post('/update-users-analytics', (request, response) => {

    let connection;

    config.getNewConnection()
        .then((conn) => {
            connection = conn;
            return getAllUsers(connection);
        })
        .then((users) => {
            updateUserAnalytics(users)
                .then(() => {
                    console.log(`${updateUserAnalytics} completed executing`);
                })
                .catch(err => {
                    console.error(err);
                });
            response.send({
                status: 'process initiated'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch((err) => {
            config.disconnect(connection);
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

function getAllUsers(connection){
    return new Promise((resolve, reject) => {
        connection.query('SELECT uuid ' +
            'FROM User ' +
            'ORDER BY regdate DESC', [], (err, rows) => {

            if(err){
                reject(err);
            }
            else{
                resolve(rows);
            }
        });
    });
}

function updateUserAnalytics(users) {
    return new Promise((resolve, reject) => {
        async.eachLimit(users, 25, function (user, callback) {

            let uuid = user.uuid;
            let connection;

            config.getNewConnection()
                .then(function (conn) {
                    connection = conn;
                    return usranlytcsutils.updateUserTotalPosts(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserFeaturedCount(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserFeaturedCountConsec(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserCommentsGiven(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserCommentsReceived(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserHatsoffGiven(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserHatsoffsReceived(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserShortCollabDone(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserShortWrittenOn(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserCaptureCollabDone(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserCaptureAddedOn(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserLongFormSolo(connection, uuid);
                })
                .then(() => {
                    return usranlytcsutils.updateUserLongFormCollab(connection, uuid);
                })
                .then(() => {
                    console.log(`updateUserAnalytics for ${user.uuid} is complete`);
                    config.disconnect(connection);
                    callback();
                })
                .catch((err) => {
                    config.disconnect(connection);
                    callback(err);
                });

        }, function (err) {
            if(err){
                reject(err);
            }
            else{
                resolve();
            }
        });
    });
}

module.exports = router;