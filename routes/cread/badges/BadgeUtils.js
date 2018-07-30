/**
 * Created by avnee on 24-07-2018.
 */
'use-strict';

const async = require('async');

const config = require('../../Config');
const BreakPromiseChainError = require('../utils/BreakPromiseChainError');
const consts = require('../utils/Constants');
const utils = require('../utils/Utils');
var cacheutils = require('../utils/cache/CacheUtils');
var cachemanager = require('../utils/cache/CacheManager');
const notify = require('../../notification-system/notificationFramework');
const badgenames = consts.badgenames;

/**
 * Function to calculate which badges have been unlocked for a particular user
 * */
function getBadgesData(connection, requesteduuid, unlocked_only) {
    return new Promise(function (resolve, reject) {
        try{
            getBadgesDataExceptTopArtist(connection, requesteduuid, unlocked_only)
                .then(async function (data) {

                    data.items.push({
                        unlocked: await isTopArtist(requesteduuid),
                        title: "Top Artist",
                        description: "You unlock this badge by unlocking all the other badges",
                        imgurl: utils.getBadgeImgUrl("18.png")
                    });

                    resolve({
                        profilepicurl: utils.createSmallProfilePicUrl(requesteduuid),
                        items: unlocked_only ? data.items.filter(function (b) {
                            return b.unlocked;
                        }) : data.items
                    });
                })
                .catch(reject);
        }
        catch (err){
            reject(err);
            return;
        }
    });
}

function getBadgesDataExceptTopArtist(connection, requesteduuid, unlocked_only) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT F.follower, F.followee, U.bio ' +
            'FROM (' +
                'SELECT bio, uuid ' +
                'FROM User ' +
                'WHERE uuid = ?' +
            ') AS U ' +
            'CROSS JOIN (' +
                'SELECT followee, follower  ' +
                'FROM Follow ' +
                'WHERE followee = ? ' +
                'OR follower = ?' +
            ') AS F;'+
            'SELECT * ' +
            'FROM UserAnalytics UA ' +
            'WHERE uuid = ?', [requesteduuid, requesteduuid, requesteduuid, requesteduuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                let follow_data = rows[0];

                let followingcount = follow_data.filter(function (f) {
                    return f.follower === requesteduuid;
                }).length;

                let followercount = follow_data.filter(function (f) {
                    return f.followee === requesteduuid;
                }).length;

                let analytics_data = rows[1][0];

                let badge_data = [
                    {
                        unlocked: true,
                        title: badgenames.SIGN_UP,
                        description: "You unlock this badge by becoming a member of the Cread community",
                        imgurl: utils.getBadgeImgUrl("1.png")
                    },
                    {
                        unlocked: !!follow_data[0].bio,
                        title: badgenames.BIO,
                        description: "You unlock this badge by filling up your bio",
                        imgurl: utils.getBadgeImgUrl("2.png")
                    },
                    {
                        unlocked: analytics_data.featured > 0,
                        title: badgenames.FEATURED_ONCE,
                        description: "You unlock this badge by becoming a featured artist on Cread",
                        imgurl: utils.getBadgeImgUrl("3.png")
                    },
                    {
                        unlocked: !!analytics_data.featured_3_consctve,
                        title: badgenames.FEATURED_3_CONSEC,
                        description: "You unlock this badge by becoming a featured artist on Cread 3 days in a row",
                        imgurl: utils.getBadgeImgUrl("4.png")
                    },
                    {
                        unlocked: analytics_data.comment_given >= 30,
                        title: badgenames.COMMENT_GIVEN,
                        description: "You unlock this badge by commenting 10 or more times on others' posts",
                        imgurl: utils.getBadgeImgUrl("5.png")
                    },
                    {
                        unlocked: analytics_data.comment_received >= 15,
                        title: badgenames.COMMENT_RECEIVED,
                        description: "You unlock this badge when you receive 5 or more comments from others on your posts",
                        imgurl: utils.getBadgeImgUrl("6.png")
                    },
                    {
                        unlocked: analytics_data.hatsoff_given >= 50,
                        title: badgenames.HATSOFF_GIVEN,
                        description: "You unlock this badge by giving 20 or more hatsoffs on others' posts",
                        imgurl: utils.getBadgeImgUrl("7.png")
                    },
                    {
                        unlocked: analytics_data.hatsoff_received >= 25,
                        title: badgenames.HATSOFF_RECEIVED,
                        description: "You unlock this badge when you receive 10 or more hatsoffs from others on your posts",
                        imgurl: utils.getBadgeImgUrl("8.png")
                    },
                    {
                        unlocked: analytics_data.short_written_on >= 3,
                        title: badgenames.SHORT_WRITTEN_ON,
                        description: "You unlock this badge when others collaborate on your writing posts 3 or more times",
                        imgurl: utils.getBadgeImgUrl("9.png")
                    },
                    {
                        unlocked: analytics_data.capture_added_on >= 3,
                        title: badgenames.CAPTURE_ADDED_ON,
                        description: "You unlock this badge when others collaborate on your artistic photo posts 3 or more times",
                        imgurl: utils.getBadgeImgUrl("10.png")
                    },
                    {
                        unlocked: followingcount >= 35,
                        title: badgenames.FOLLOWING,
                        description: "You unlock this badge when you follow 35 or more people",
                        imgurl: utils.getBadgeImgUrl("11.png")
                    },
                    {
                        unlocked: followercount >= 25,
                        title: badgenames.FOLLOWERS,
                        description: "You unlock this badge when 25 or more people follow you",
                        imgurl: utils.getBadgeImgUrl("12.png")
                    },
                    {
                        unlocked: analytics_data.total_uploads >= 1,
                        title: badgenames.FIRST_POST,
                        description: "You unlock this badge when you upload your first post on Cread",
                        imgurl: utils.getBadgeImgUrl("13.png")
                    },
                    {
                        unlocked: !!analytics_data.long_form_solo || !!analytics_data.long_form_collab,
                        title: badgenames.LONG_FORM,
                        description: "You unlock this badge when you upload your long form writing post on Cread",
                        imgurl: utils.getBadgeImgUrl("14.png")
                    },
                    /*{
                        unlocked: !!analytics_data.long_form_collab,
                        title: "Story Teller",
                        description: "You unlock this badge when you upload your long form writing post in collaboration on Cread",
                        imgurl: utils.getBadgeImgUrl("15.png")
                    },*/
                    {
                        unlocked: analytics_data.capture_collab_done > 0,
                        title: badgenames.CAPTURE_COLLAB_DONE,
                        description: "You unlock this badge when you upload your first artistic photo in collaboration on Cread",
                        imgurl: utils.getBadgeImgUrl("16.png")
                    },
                    {
                        unlocked: analytics_data.short_collab_done > 0,
                        title: badgenames.SHORT_COLLAB_DONE,
                        description: "You unlock this badge when you upload your first writing in collaboration on Cread",
                        imgurl: utils.getBadgeImgUrl("17.png")
                    }
                ];

                resolve({
                    items: unlocked_only ? badge_data.filter(function (b) {
                        return b.unlocked;
                    }) : badge_data
                });
            }
        });
    });
}

function updateBadgeCountCache(users) {
    return new Promise(function (resolve, reject) {
        async.each(users, function (user, callback) {

            var usr_badgecnt_cache_key = cacheutils.getUserBadgeCntCacheKey(user.uuid);

            if (typeof user.badgecount !== "number") {
                callback(new Error("Value to store for badgecount in cache should be a number"));
            }
            else {
                cachemanager.setCacheString(usr_badgecnt_cache_key, String(user.badgecount))
                    .then(function () {
                        callback();
                    })
                    .catch(function (err) {
                        callback(err);
                    });
            }

        }, function (err) {
            if (err) {
                console.error(err);
                reject(err);
            }
            else {
                resolve();
            }
        });

    });
}

/**
 * Function to update badge count after fetching data from UserAnalytics table
 * */
function updateBadgeCountCacheFromDB(connection, uuid) {

    let badgecount = 0;

    return new Promise(function (resolve, reject) {
        getBadgesDataExceptTopArtist(connection, uuid, true)
            .then(function (result) {
                badgecount = result.items.length;
                return updateBadgeCountCache([{
                    uuid: uuid,
                    badgecount: badgecount
                }]);
            })
            .then(() => {
                if(badgecount >= consts.total_badges){
                    sendBadgeNotification(uuid, badgenames.TOP_ARTIST);
                }
                resolve();
            })
            .catch(reject);
    });
}

/***
 * Function to fetch the number of unlocked badges of a user
 * */
function getUserBadgeCount(uuid) {
    return new Promise((resolve, reject) => {

        let connection;

        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return cachemanager.getCacheString(cacheutils.getUserBadgeCntCacheKey(uuid));
            })
            .then((badgecount) => {
                if (!badgecount) {  //Cache is empty
                    return updateBadgeCountCacheFromDB(connection, uuid);
                }
                else {
                    resolve(Number(badgecount));
                    throw new BreakPromiseChainError();
                }
            })
            .then(() => {
                return cachemanager.getCacheString(cacheutils.getUserBadgeCntCacheKey(uuid));
            })
            .then((badgecount) => {
                resolve(Number(badgecount));
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if(err instanceof BreakPromiseChainError){
                    //Do nothing
                }
                else{
                    reject(err);
                }
            });
    });
}

/**
 * Function to check whether the user is a top artist or not
 * */
async function isTopArtist(uuid) {
    return new Promise((resolve, reject) => {
        getUserBadgeCount(uuid)
            .then(function (badgecount) {
                resolve(Number(badgecount) >= consts.total_badges);
            })
            .catch(reject);
    });
}

function sendBadgeNotification(uuid, badgename) {
    return new Promise((resolve, reject) => {

        let notifData = {
            message: "Congratulations! You have unlocked the '" + badgename + "' badge",
            category: "badge",
            persistable: "No"
        };

        notify.notificationPromise([uuid], notifData)
            .then(resolve, reject);
    });
}

module.exports = {
    getBadgesData: getBadgesData,
    updateBadgeCountCacheFromDB: updateBadgeCountCacheFromDB,
    getUserBadgeCount: getUserBadgeCount,
    isTopArtist: isTopArtist,
    sendBadgeNotification: sendBadgeNotification
};