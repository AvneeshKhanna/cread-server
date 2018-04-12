/**
 * Created by avnee on 10-04-2018.
 */
'use-strict';

var CronJob = require('cron').CronJob;
var moment = require('moment');
var async = require('async');

var config = require('../../../Config');
var consts = require('../Constants');
var BreakPromiseChainError = require('../BreakPromiseChainError');
var userprofileutils = require('../../user-manager/UserProfileUtils');

var update_latestposts_cache_job = new CronJob({
    cronTime: '00 59 21 * * *', //second | minute | hour | day-of-month | month | day-of-week
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

module.exports = {
    update_latestposts_cache_job: update_latestposts_cache_job,
    delete_stale_hotds_job: delete_stale_hotds_job
};