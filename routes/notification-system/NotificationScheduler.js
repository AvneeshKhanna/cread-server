/**
 * Created by avnee on 27-07-2017.
 */

var notifyUsers = require('./NotificationUtils');
var notify = require('./notificationFramework');
var CronJob = require('cron').CronJob;
var moment = require('moment');
var async = require('async');

var config = require('../Config');
var _auth = require('../auth-token-management/AuthTokenUtils');
var BreakPromiseChainError = require('../cread/utils/BreakPromiseChainError');
var userprofileutils = require('../cread/user-manager/UserProfileUtils');
var featuredartistutils = require('../cread/featured-artists/FeaturedArtistsUtils');
var usereventsutils = require('../cread/user-manager/events/UserEventsUtils');
let usranlytcsutils = require('../cread/user-manager/analytics/UserAnalyticsUtils');

var top_givers_notification = new CronJob({
    cronTime: '00 30 20 * * 5', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {
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
            if (err) {
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
    onTick: function () {
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

                if (entity) {
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

                if (filteredUsers.length > 0) {
                    return notify.notificationPromise(filteredUsers, notifData);
                }
                else {
                    console.log('No users to send notification to');
                    throw new BreakPromiseChainError();
                }
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

var featured_artist_notification = new CronJob({
    cronTime: '00 00 9 * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

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

                if (featuredartists.length > 0) {
                    return notify.notificationPromise(users, notifData);
                }
                else {
                    throw new BreakPromiseChainError();
                }
            })
            .then(function () {
                if (featuredartists.length > 0) {
                    updateFeaturedArtistsAnalyticsAll(connection, featuredartists);
                    return featuredartistutils.sendFeaturedArtistNotifToFollowers(connection, featuredartists);
                }
                else {
                    throw new BreakPromiseChainError();
                }
            })
            .then(function (followers) {

                followers = followers.concat(featuredartists.map(function (fa) {
                    return fa.uuid;
                }));

                return featuredartistutils.sendFeaturedArtistNotifGeneral(connection, followers, featuredartists);
            })
            .then(function () {
                console.log('Notification for featured artist sent');
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

function updateFeaturedArtistsAnalyticsAll(connection, users) {
    return new Promise((resolve, reject) => {
        async.each(users, (user, callback) => {
            usranlytcsutils.updateUserFeaturedCount(connection, user.uuid)
                .then(() => {
                    return usranlytcsutils.updateUserFeaturedCountConsec(connection, user.uuid);
                })
                .then(()=> {
                    callback();
                })
                .catch(err => {
                    callback(err);
                });

        }, err => {
            if(err){
                console.error(err);
            }
            resolve();
        })
    })
}

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
            'ORDER BY hatsoffcount DESC', [lastscandate], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if (rows[0] && rows[0].hatsoffcount >= 3) {
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

                    if (entity.type === 'SHORT') {
                        element.to_send_notif = (capturecount >= shortcount && capturecount !== 0)
                    }
                    else if (entity.type === 'CAPTURE') {
                        element.to_send_notif = (shortcount >= capturecount && shortcount !== 0)
                    }

                });

                resolve(rows);
            }
        });
    });
}

var engagement_notification_job = new CronJob({
    //Runs every 2nd day, 8:30 pm
    cronTime: '00 30 20 */2 * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function () {

        usereventsutils.sendEngagementNotificationsForUsers()
            .then(function () {
                console.log("Engagement Notifications Process Completely");
            })
            .catch(function (err) {
                console.error(err);
                console.log("ERROR: Engagement Notifications Process Stopped");
            });

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

var users_no_post_notification = new CronJob({
    //Runs at 9:00 pm every 3 days
    cronTime: '00 00 18 */3 * *', //second | minute | hour | day-of-month | month | day-of-week   //TODO: Change time
    onTick: function () {

        var connection;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return getInactiveUsers(connection);
            })
            .then(function (users) {
                return sendNotificationInactiveUsersAll(users)
            })
            .then(function () {
                console.log('users_no_post_notification complete');
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

function checkForNewUsersWithNoPosts(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT DISTINCT U.uuid ' +
            'FROM User U ' +
            'LEFT JOIN Short S ' +
            'USING(uuid) ' +
            'LEFT JOIN Capture C ' +
            'USING(uuid) ' +
            'WHERE U.regdate > DATE_SUB(NOW(), INTERVAL 48 HOUR) ' +
            'AND (S.uuid IS NULL AND C.uuid IS NULL)', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows.map(function (r) {
                    return r.uuid;
                }));
            }
        });
    });
}

/**
 * Get the list of users who have been inactive for 5 days AND either had been active in
 * */
function sendNotificationInactiveUsersAll(users) {
    return new Promise(function (resolve, reject) {
        async.each(users, function (user, callback) {

            var notifData = {
                category: 'engagement-notification',
                persistable: 'No',
                message: "You have not posted anything in a while, " + user.firstname + ". You might like to check out recent happenings on Cread!"
            };

            notify.notificationPromise(new Array(user.uuid), notifData)
                .then(function () {
                    callback();
                })
                .catch(function (err) {
                    callback(err);
                });
        }, function (err) {
            if (err) {
                console.error("sendNotificationInactiveUsersAll errored");
                reject(err);
            }
            else {
                console.log("sendNotificationInactiveUsersAll complete");
                resolve();
            }
        });
    });
}

/**
 * Function to get users who have not posted anything in the last 3 days AND either they had posted in the previous 9 days or
 * haven't posted anything since they joined
 * */
function getInactiveUsers(connection) {

    var last_post_limit = {
        upper: 9,
        lower: 3
    };

    return new Promise(function (resolve, reject) {
        connection.query('SELECT U.uuid, U.firstname, ' +
            'CASE WHEN (E.entityid IS NOT NULL) THEN MAX(E.regdate) ELSE U.regdate END AS last_check_time ' +
            'FROM User U ' +
            'LEFT JOIN Entity E ' +
            'USING(uuid) ' +
            'WHERE (E.status = "ACTIVE" OR E.status IS NULL) ' +
            'GROUP BY U.uuid ' +
            'HAVING (last_check_time BETWEEN DATE_SUB(NOW(), INTERVAL ? DAY) AND DATE_SUB(NOW(), INTERVAL ? DAY) ' +
            'AND last_check_time NOT BETWEEN DATE_SUB(NOW(), INTERVAL ? DAY) AND NOW())', [last_post_limit.upper, last_post_limit.lower, last_post_limit.lower], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

function getRecentPosters(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT U.firstname ' +
            'FROM User U ' +
            'LEFT JOIN Short S ' +
            'USING(uuid) ' +
            'LEFT JOIN Capture C ' +
            'USING(uuid) ' +
            'JOIN Entity E ' +
            'ON(S.entityid = E.entityid OR C.entityid = E.entityid) ' +
            'WHERE E.regdate < DATE_SUB(NOW(), INTERVAL 48 HOUR) ' +
            'AND U.uuid <> ? ' +
            'GROUP BY U.uuid', [config.getCreadKalakaarUUID()], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                var message;

                if (rows.length > 0) {
                    message = rows[0].firstname + (rows[1] ? ", " + rows[1].firstname : "") + " and " + rows.length + " others posted recently since you joined. We thought you might want to post something of your own"
                }
                else {
                    message = "Some nice artwork has been shared on Cread since you joined. We thought you might want to post something of your own";
                }

                resolve(message);
            }
        });
    });
}

var first_posts_notification_job = new CronJob({
    //Runs at 1:00 pm every 3 days
    cronTime: '00 00 13 */3 * *', //second | minute | hour | day-of-month | month | day-of-week   //TODO: Change time
    onTick: function () {

        var connection;
        var first_post_users;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return getFirstPosts(connection);
            })
            .then(function (users) {
                first_post_users = users;
                if (first_post_users.length > 0) {
                    return userprofileutils.getAllUsersExcept(connection, first_post_users.map(function (user) {
                        return user.uuid;
                    }));
                }
                else {
                    throw new BreakPromiseChainError();
                }
            })
            .then(function (uuids) {

                var encrypted_entityids = _auth.encryptPayloadForAuth(first_post_users.map(function (user) {
                    return user.entityid;
                }));

                var notifData = {
                    category: 'first-post-users',
                    persistable: 'No',
                    message: first_post_users[0].firstname + (first_post_users[1] ? ', ' + first_post_users[1].firstname : '') + ' and a few others have posted for the first time recently. You might want to check it out!',
                    entityids: encrypted_entityids.toString()
                };

                return notify.notificationPromise(uuids, notifData);
            })
            .then(function () {
                console.log('first_posts_notification_job complete');
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

function getFirstPosts(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT U.uuid, U.firstname, U.lastname, E.entityid ' +
            'FROM (' +
            'SELECT entityid, MIN(regdate) AS first_post_time ' +
            'FROM Entity ' +
            'WHERE status = "ACTIVE" ' +
            'GROUP BY uuid ' +
            'HAVING first_post_time > DATE_SUB(NOW(), INTERVAL 3 DAY)' +
            ') AS FirstPosts ' +
            'JOIN Entity E ' +
            'ON(E.regdate = FirstPosts.first_post_time) ' +
            'JOIN User U ' +
            'ON(U.uuid = E.uuid)', [], function (err, rows) {
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
    top_givers_notification: top_givers_notification,
    top_post_notification: top_post_notification,
    featured_artist_notification: featured_artist_notification,
    users_no_post_notification: users_no_post_notification,
    engagement_notification_job: engagement_notification_job,
    first_posts_notification_job: first_posts_notification_job,
    sendNotificationInactiveUsersAll: sendNotificationInactiveUsersAll
};