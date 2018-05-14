/**
 * Created by avnee on 26-09-2017.
 */

/**
 * This file takes care of tasks that have been executed only one-time (or very rarely) during the lifetime of this server codebase.
 * Example Task: Calculating and adding default values to a newly created column in a table for backward compatibility or data consistency
 * */

'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var utils = require('./Utils');
var entityutils = require('../entity/EntityUtils');
var entityimgutils = require('../entity/EntityImageUtils');
var followutils = require('../follow/FollowUtils');
var chatconvoutils = require('../chat/ChatConversationUtils');

var async = require('async');
var uuidGen = require('uuid');

var download_base_path = './images/downloads';

router.post('/add-entity-data', function (request, response) {

    var connection;

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

                    var entityid = uuidGen.v4();

                    config.connectionPool.getConnection(function (error, conn) {

                        if(error){
                            callback(error);
                        }
                        else{
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
                                                            if(data.indexOf(cmid) === data.length - 1){ //Last case of async.eachSeries
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
            if(err){
                utils.rollbackTransaction(connection, undefined, err)
                    .catch(function (err) {
                        reject(err);
                    });
            }
            else{
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
            if(err){
                utils.rollbackTransaction(connection, undefined, err)
                    .catch(function (err) {
                        reject(err);
                    });
            }
            else{
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
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                if(!response.headerSent){
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

        },function (err) {
            if(err){
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

        var edata;
        var download_file_name;

        entityutils.loadEntityData(connection, config.getCreadKalakaarUUID(), entityid)
            .then(function (ed) {
                edata = ed.entity;
                download_file_name = entityid + '-product-process.jpg';
                return utils.downloadFile(download_base_path, download_file_name, edata.entityurl);
            })
            .then(function (downloadpath) {
                return entityimgutils.createOverlayedImageJournal(edata.type === 'SHORT' ? edata.shoid : edata.captureid, edata.type, edata.uuid, download_base_path + '/' + download_file_name);
            })
            .then(function () {
                return entityimgutils.createOverlayedImageCoffeeMug(edata.type === 'SHORT' ? edata.shoid : edata.captureid, edata.uuid, edata.type, download_base_path + '/' + download_file_name)
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

module.exports = router;