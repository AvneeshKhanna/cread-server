/**
 * Created by avnee on 27-07-2017.
 */

var notifyUsers = require('./NotificationUtils');
var notify = require('./notificationFramework');
var CronJob = require('cron').CronJob;
var moment = require('moment');
var async = require('async');

var config = require('../Config');
var BreakPromiseChainError = require('../cread/utils/BreakPromiseChainError');
var featuredartistutils = require('../cread/featured-artists/FeaturedArtistsUtils');

var top_givers_notification = new CronJob({
    cronTime: '00 30 20 * * 5', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function() {
        /*
         * Runs every Friday
         * at 08:30:00 PM
         */

        var data = {
            Category: 'top_givers',
            Message: 'Check out the top givers of this week on Cread',
            AppModel: '2.0',
            Persist: "No"
        };

        notifyUsers.sendNotification(data, undefined, function (err) {
            if(err){
                console.error(err);
            }
            else {
                console.log('Successfully notified all users about the top givers of the week');
            }
        });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

var top_post_notification = new CronJob({
    cronTime: '00 30 20 */3 * 5', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function() {
        /*
         * Runs every third day of the month
         * at 08:30:00 PM
         */

        var connection;
        var entity;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return getTopPost(connection);
            })
            .then(function (ent) {

                entity = ent;

                if(entity){
                    return categoriseUsers(connection, entity);
                }
                else {
                    console.log('No new post');
                    throw new BreakPromiseChainError();
                }
            })
            .then(function (users) {

                var notifData = {
                    category: 'top-post',
                    message: 'There is new post trending on Cread. We thought you might like it',
                    persistable: "Yes",
                    entityid: entity.entityid
                };

                var filteredUsers = users.filter(function (el) {
                    return el.to_send_notif;
                });

                if(filteredUsers.length > 0){
                    return notify.notificationPromise(filteredUsers, notifData);
                }
                else{
                    console.log('No users to send notification to');
                    throw new BreakPromiseChainError();
                }
            })
            .catch(function (err) {
                config.disconnect(connection);
                if(err instanceof BreakPromiseChainError){
                    //Do nothing
                }
                else{
                    console.error(err);
                }
            });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

var featured_artist_notification = new CronJob({
    cronTime: '00 00 9 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function() {

        var connection;
        var featuredartists;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return featuredartistutils.getFeaturedArtists(connection);
            })
            .then(function (result) {

                featuredartists = result.featuredlist;

                console.log("featuredartists are " + JSON.stringify(featuredartists, null, 3));

                var notifData = {
                    persistable: "No",
                    category: "featured-artist",
                    message: "Congratulations! You have been chosen as a featured artist on Cread!"
                };

                var users = featuredartists.map(function (item) {
                    return item.uuid;
                });

                if(featuredartists.length > 0){
                    return notify.notificationPromise(users, notifData);
                }
                else{
                    throw new BreakPromiseChainError();
                }
            })
            .then(function () {
                if(featuredartists.length > 0){
                    return featuredartistutils.sendFeaturedArtistNotifToFollowers(connection, featuredartists);
                }
                else{
                    throw new BreakPromiseChainError();
                }
            })
            .then(function () {
                console.log('Notification for featured artist sent');
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if(err instanceof BreakPromiseChainError){
                    //Do nothing
                }
                else{
                    console.error(err);
                }
            });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

/**
 * Returns the entityid, type and the hatsoffcount of the Entity that has more than 3 hats-offs within the last scan date
 * */
function getTopPost(connection) {

    var lastscandate = moment.utc().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss');

    return new Promise(function (resolve, reject) {
        connection.query('SELECT E.type, E.entityid, COUNT(DISTINCT H.entityid, H.uuid) AS hatsoffcount ' +
            'FROM Entity E ' +
            'LEFT JOIN HatsOff H ' +
            'USING(entityid) ' +
            'WHERE E.regdate > ? ' +
            'GROUP BY E.entityid ' +
            'ORDER BY hatsoffcount DESC', [lastscandate], function(err, rows){
            if(err){
                reject(err);
            }
            else{
                if(rows[0] && rows[0].hatsoffcount >= 3){
                    resolve(rows[0]);
                }
                else {
                    resolve();
                }
            }
        });
    })
}

/**
 * Categorises users whether to send the notification or not based on their activity on the app and the type of top post
 *
 * If type of post = 'SHORT', then the notification is sent to only those users who have uploaded more captures than shorts (and vice-versa)
 * */
function categoriseUsers(connection, entity) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT U.uuid, ' +
            'SUM(CASE WHEN(C.capid IS NOT NULL) THEN 1 ELSE 0 END) AS capturecount, ' +
            'SUM(CASE WHEN(S.shoid IS NOT NULL) THEN 1 ELSE 0 END) AS shortcount ' +
            'FROM Users U ' +
            'LEFT JOIN Capture C ' +
            'ON U.uuid = C.uuid ' +
            'LEFT JOIN Capture S ' +
            'ON U.uuid = S.uuid ' +
            'GROUP BY U.uuid', null, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {

                    if(entity.type === 'SHORT'){
                        element.to_send_notif = (capturecount >= shortcount && capturecount !== 0)
                    }
                    else if(entity.type === 'CAPTURE'){
                        element.to_send_notif = (shortcount >= capturecount && shortcount !== 0)
                    }

                });

                resolve(rows);
            }
        });
    });
}

module.exports = {
    top_givers_notification: top_givers_notification,
    top_post_notification: top_post_notification,
    featured_artist_notification: featured_artist_notification
};