/**
 * Created by avnee on 10-04-2018.
 */
'use-strict';

var CronJob = require('cron').CronJob;
var moment = require('moment');
var async = require('async');

var config = require('../../../Config');
var consts = require('../Constants');
var utils = require('../Utils');
var BreakPromiseChainError = require('../BreakPromiseChainError');
var userprofileutils = require('../../user-manager/UserProfileUtils');
var entityintrstutils = require('../../interests/EntityInterestsUtils');
var entityutils = require('../../entity/EntityUtils');
var entityimgutils = require('../../entity/EntityImageUtils');
var _auth = require('../../../auth-token-management/AuthTokenManager');

var download_base_path = './images/downloads';

var update_latestposts_cache_job = new CronJob({
    cronTime: '00 00 01 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        var connection;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return new Promise(function (resolve, reject) {
                    connection.query('SELECT U.uuid ' +
                        'FROM User U ' +
                        'JOIN UserAnalytics UA ' +
                        'USING(uuid) ' +
                        'WHERE UA.quality_percentile_score >= ?', [consts.min_qpercentile_user_recommendation], function (err, rows) {
                        if(err){
                            reject(err);
                        }
                        else {
                            var users = rows.map(function (r) {
                                return r.uuid;
                            });
                            resolve(users);
                        }
                    });
                });
            })
            .then(function (users) {
                return updateLatestPostsAllCache(connection, users);
            })
            .then(function () {
                console.log("update_latestposts_cache_job complete");
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if (err instanceof BreakPromiseChainError) {
                    //Do nothing
                }
                else {
                    console.error(err);
                }
            });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

/**
 * Update cache of all quality users for latest posts
 * */
function updateLatestPostsAllCache(connection, users){
    return new Promise(function (resolve, reject) {
        async.eachSeries(users, function (user, callback) {
            userprofileutils.updateLatestPostsCache(connection, user)
                .then(function (posts) {
                    callback();
                })
                .catch(function (err) {
                    callback(err);
                });
        }, function (err) {
            if(err){
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

var delete_stale_hotds_job = new CronJob({
    //Runs at 12:05 am
    cronTime: '00 05 00 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        var connection;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return removeStaleHOTDs(connection);
            })
            .then(function () {
                console.log("delete_stale_hotds_job complete");
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if (err instanceof BreakPromiseChainError) {
                    //Do nothing
                }
                else {
                    console.error(err);
                }
            });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

/**
 * Delete Hashtag-of-the-days which are older than today
 * */
function removeStaleHOTDs(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('DELETE FROM HTagOfTheDay ' +
            'WHERE for_date < DATE(NOW())', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

var reminder_hotd_job = new CronJob({
    //Runs at 12:05 am
    cronTime: '00 00 20 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        var connection;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return checkForScheduledHOTD(connection);
            })
            .then(function (isScheduled) {

                if(isScheduled){
                    console.log("HOTD scheduled for tomorrow");
                }
                else{
                    var toAddresses  = [
                        "admin@thetestament.com",
                        "nishantmittal2410@gmail.com",
                        "avneesh.khanna92@gmail.com"
                    ];
                    return utils.sendAWSTextEmail("Hashtag-Of-The-Day Not Scheduled",
                        "Hi,\nThis is to remind you that Hashtag-Of-The-Day is not scheduled for tomorrow on Cread. Please look into it",
                        toAddresses);
                }

            })
            .then(function () {
                console.log("reminder_hotd_job complete");
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if (err instanceof BreakPromiseChainError) {
                    //Do nothing
                }
                else {
                    console.error(err);
                }
            });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

function checkForScheduledHOTD(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT * FROM HTagOfTheDay WHERE for_date = DATE(DATE_ADD(NOW(), INTERVAL 1 DAY))', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(!!rows[0]);
            }
        });
    });
}

var generate_new_web_token_job = new CronJob({
    //Runs at 12:05 am
    cronTime: '00 05 00 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        var connection;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return _auth.generateWebAccessToken({
                    uuid: config.getCreadKalakaarUUID()
                });
            })
            .then(function (token) {
                return utils.updateS3ConfigFile(token);
            })
            .then(function () {
                console.log("generate_new_web_token_job complete");
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if (err instanceof BreakPromiseChainError) {
                    //Do nothing
                }
                else {
                    console.error(err);
                }
            });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

/**
 * Cron job to unlock entities that may have locked due to manual post categorising process using Cread Ops
 * */
var unlock_entities_job = new CronJob({
    //Runs every 1 hour
    cronTime: '00 00 * * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        var connection;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return entityintrstutils.unlockEntityMultiple(connection);
            })
            .then(function () {
                console.log("unlock_entities_job complete");
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if (err instanceof BreakPromiseChainError) {
                    //Do nothing
                }
                else {
                    console.error(err);
                }
            });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

/**
 * Cron job to add product overlay images
 * */
var add_product_images_job = new CronJob({
    //Runs at 06:00 am
    cronTime: '00 00 06 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        var connection;

        if(config.isProduction()){
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
                            'LIMIT 300', [false], function (err, rows) {
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
                    console.log("Process Initiated");
                    //config.disconnect(connection);  //Disconnecting connection early since createMultipleEntityProductImages() can be an hour long process
                    return createMultipleEntityProductImages(entities);
                })
                .then(function () {
                    console.log("add_product_images_job complete");
                    throw new BreakPromiseChainError();
                })
                .catch(function (err) {
                    config.disconnect(connection);
                    if (err instanceof BreakPromiseChainError) {
                        //Do nothing
                    }
                    else {
                        console.error(err);
                    }
                });
        }

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

function createMultipleEntityProductImages(entities) {
    return new Promise(function (resolve, reject) {
        //Limit async operations to 20 at a time as multiple SQL connections would be opened parallely
        async.eachOfLimit(entities, 20, function (entity, index, callback) {

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
                    config.disconnect(connection);
                    callback();
                })
                .catch(function (err) {
                    console.error(err);
                    config.disconnect(connection);
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

module.exports = {
    update_latestposts_cache_job: update_latestposts_cache_job,
    delete_stale_hotds_job: delete_stale_hotds_job,
    reminder_hotd_job: reminder_hotd_job,
    generate_new_web_token_job: generate_new_web_token_job,
    unlock_entities_job: unlock_entities_job,
    add_product_images_job: add_product_images_job
};