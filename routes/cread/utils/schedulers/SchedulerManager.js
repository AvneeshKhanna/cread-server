/**
 * Created by avnee on 10-04-2018.
 */
'use-strict';

const CronJob = require('cron').CronJob;
const moment = require('moment');
const async = require('async');

const config = require('../../../Config');
const consts = require('../Constants');
const post_type = consts.post_type;
const utils = require('../Utils');
const BreakPromiseChainError = require('../BreakPromiseChainError');
const userprofileutils = require('../../user-manager/UserProfileUtils');
const entityintrstutils = require('../../interests/EntityInterestsUtils');
const entityspecificutils = require('../../entity/EntitySpecificUtils');
const entityimgutils = require('../../entity/EntityImageUtils');
const _auth = require('../../../auth-token-management/AuthTokenManager');

const download_base_path = './images/downloads';

let update_latestposts_cache_job = new CronJob({
    cronTime: '00 00 01 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        let connection;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return new Promise(function (resolve, reject) {
                    connection.query('SELECT U.uuid ' +
                        'FROM User U ' +
                        'JOIN UserAnalytics UA ' +
                        'USING(uuid) ' +
                        'WHERE UA.quality_percentile_score >= ?', [consts.min_qpercentile_user_recommendation], function (err, rows) {
                        if (err) {
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
function updateLatestPostsAllCache(connection, users) {
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
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

const delete_stale_hotds_job = new CronJob({
    //Runs at 12:05 am
    cronTime: '00 05 00 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        let connection;

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

const reminder_hotd_job = new CronJob({
    //Runs at 12:05 am
    cronTime: '00 00 20 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        let connection;

        if (config.isProduction()) {
            config.getNewConnection()
                .then(function (conn) {
                    connection = conn;
                    return checkForScheduledHOTD(connection);
                })
                .then(function (isScheduled) {

                    if (isScheduled) {
                        console.log("HOTD scheduled for tomorrow");
                    }
                    else {
                        let toAddresses = [
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
        }
        else {
            //Development Mode. Do nothing
        }

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

const generate_new_web_token_job = new CronJob({
    //Runs at 12:05 am
    cronTime: '00 05 00 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        let connection;

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
const unlock_entities_job = new CronJob({
    //Runs every 1 hour
    cronTime: '00 00 * * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        let connection;

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
const add_product_images_job = new CronJob({
    //Runs at 06:00 am
    cronTime: '00 00 06 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        let connection;

        if (config.isProduction()) {
            config.getNewConnection()
                .then(function (conn) {
                    connection = conn;
                    return new Promise(function (resolve, reject) {
                        connection.query('SELECT entityid ' +
                            'FROM Entity ' +
                            'WHERE product_overlay = 0 ' +
                            'AND merchantable = 1 ' +
                            'AND status = "ACTIVE" ' +
                            'AND type <> "MEME" ' +
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

            let connection;

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
                return entityimgutils.createOverlayedImageCoffeeMug(edata.type === post_type.SHORT ? edata.shoid : edata.captureid, edata.uuid, edata.type, download_base_path + '/' + download_file_name)
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

/**
 * Cron job to shoot mail to team for help queries present in the last 3 hours
 * */
const help_queries_status_job = new CronJob({
    //Runs every 3 hours
    cronTime: '00 00 */3 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        let connection;

        if (config.isProduction()) {
            config.getNewConnection()
                .then(function (conn) {
                    connection = conn;
                    return getHelpQuesAnswersLastHr(connection);
                })
                .then(function (items) {

                    if (items.length > 0) {
                        let toAddresses = [
                            "admin@thetestament.com",
                            "nishantmittal2410@gmail.com"/*,
                            "avneesh.khanna92@gmail.com"*/
                        ];
                        return utils.sendAWSTextEmail("New Help Queries in the Last 3 Hours",
                            "Hi,\nYou have new queries for: \n\n" + items.map(function (item) {
                                return item.question + " (" + item.firstname + " " + item.lastname + ")";
                            }).join('\n\n'),
                            toAddresses);
                    }
                    else {
                        console.log('No help queries in the past 3 hours');
                        throw new BreakPromiseChainError();
                    }

                })
                .then(function () {
                    console.log("Queries Present: Mailed");
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
        else {
            //Development Mode. Do nothing
        }

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

function getHelpQuesAnswersLastHr(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT HQ.question, SUM(HQA.count), U.firstname, U.lastname ' +
            'FROM HelpQuesAns HQA ' +
            'JOIN HelpQues HQ ' +
            'USING(qid) ' +
            'JOIN User U ' +
            'ON(U.uuid = HQA.uuid) ' +
            'WHERE HQA.last_update_time > DATE_SUB(NOW(), INTERVAL 3 HOUR) ' +
            'GROUP BY HQ.qid', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

module.exports = {
    update_latestposts_cache_job: update_latestposts_cache_job,
    delete_stale_hotds_job: delete_stale_hotds_job,
    reminder_hotd_job: reminder_hotd_job,
    generate_new_web_token_job: generate_new_web_token_job,
    unlock_entities_job: unlock_entities_job,
    add_product_images_job: add_product_images_job,
    help_queries_status_job: help_queries_status_job
};