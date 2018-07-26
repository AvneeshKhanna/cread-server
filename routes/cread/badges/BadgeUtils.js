/**
 * Created by avnee on 24-07-2018.
 */
'use-strict';

var async = require('async');

var cacheutils = require('../utils/cache/CacheUtils');
var cachemanager = require('../utils/cache/CacheManager');

/**
 * Function to calculate which badges have been unlocked for a particular user
 * */
function getBadgesData(connection, requesteduuid, unlocked_only) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT F.followee, F.follower, U.bio ' +
            'FROM Follow F ' +
            'JOIN User U ' +
            'ON(U.uuid = ?) ' +
            'WHERE followee = ? ' +
            'OR follower = ?;' +
            'SELECT * ' +
            'FROM UserAnalytics UA ' +
            'WHERE uuid = ?', [requesteduuid, requesteduuid, requesteduuid, requesteduuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                var follow_data = rows[0];

                var followercount = follow_data.filter(function (f) {
                    return f.followee === requesteduuid;
                }).length;

                var followingcount = follow_data.filter(function (f) {
                    return f.follower === requesteduuid;
                }).length;

                var analytics_data = rows[1][0];

                var badge_data = [
                    {
                        unlocked: true,
                        title: "Sign Up",
                        description: "You unlock this badge by becoming a member of the Cread community",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: !!follow_data.bio,
                        title: "Bio",
                        description: "You unlock this badge by filling up your bio",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.featured > 0,
                        title: "Featured",
                        description: "You unlock this badge by becoming a featured artist on Cread",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: !!analytics_data.featured_3_consctve,
                        title: "Featured Consecutive",
                        description: "You unlock this badge by becoming a featured artist on Cread 3 days in a row",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.comment_given >= 10,
                        title: "Comment Given",
                        description: "You unlock this badge by commenting 10 or more times on others' posts",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.comment_received >= 5,
                        title: "Comment Received",
                        description: "You unlock this badge when you receive 5 or more comments from others on your posts",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.hatsoff_given >= 20,
                        title: "Hatsoff Given",
                        description: "You unlock this badge by giving 20 or more hatsoffs on others' posts",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.hatsoff_received >= 10,
                        title: "Hatsoff Received",
                        description: "You unlock this badge when you receive 10 or more hatsoffs from others on your posts",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.short_written_on >= 3,
                        title: "Collaboration Others Writing",
                        description: "You unlock this badge when others collaborate on your writing posts 3 or more times",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.capture_added_on >= 3,
                        title: "Collaboration Others Photo",
                        description: "You unlock this badge when others collaborate on your artistic photo posts 3 or more times",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: followingcount >= 35,
                        title: "Following",
                        description: "You unlock this badge when you follow 35 or more people",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: followercount >= 25,
                        title: "Follower",
                        description: "You unlock this badge when 25 or more people follow you",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.total_uploads >= 1,
                        title: "First Post",
                        description: "You unlock this badge when you upload your first post on Cread",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: !!analytics_data.long_form_solo,
                        title: "Long Form Solo",
                        description: "You unlock this badge when you upload your long form writing post on Cread",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: !!analytics_data.long_form_collab,
                        title: "Long Form Collab",
                        description: "You unlock this badge when you upload your long form writing post in collaboration on Cread",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.capture_collab_done > 0,
                        title: "Photo Collabs Done",
                        description: "You unlock this badge when you upload your first artistic photo in collaboration on Cread",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
                    },
                    {
                        unlocked: analytics_data.short_collab_done > 0,
                        title: "Writing Collab Done",
                        description: "You unlock this badge when you upload your first writing in collaboration on Cread",
                        imgurl: "http://wfarm4.dataknet.com/static/resources/icons/set117/a1610fef.png"
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
    return new Promise(function (resolve, reject) {
        getBadgesData(connection, uuid, false)
            .then(function (result) {

                var unlocked_badge_count = result.items.filter(function (item) {
                    return item.unlocked;
                }).length;

                return updateBadgeCountCache([{
                    uuid: uuid,
                    badgecount: unlocked_badge_count
                }]);
            })
            .then(resolve, reject);
    });
}

module.exports = {
    getBadgesData: getBadgesData,
    updateBadgeCountCacheFromDB: updateBadgeCountCacheFromDB
};