/**
 * Created by avnee on 28-02-2018.
 */
'use-strict';

var moment = require('moment');
var async = require('async');

var utils = require('../utils/Utils');
var followutils = require('../follow/FollowUtils');

var notify = require('../../notification-system/notificationFramework');
var config = require('../../Config');

function getFeaturedArtists(connection) {

    var today = moment().format('YYYY-MM-DD 00:00:00');

    return new Promise(function (resolve, reject) {
        connection.query('SELECT U.uuid, U.firstname AS name, FA.regdate ' +
            'FROM FeaturedArtists FA ' +
            'JOIN User U ' +
            'ON (FA.uuid = U.uuid) ' +
            'WHERE FA.regdate >= ? ' +
            'AND FA.uuid <> ? ' +
            'ORDER BY FA.featured_score DESC ' +
            'LIMIT 4', [today, config.getCreadKalakaarUUID()], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (row) {
                    row.profilepicurl = utils.createSmallProfilePicUrl(row.uuid);
                });

                resolve({
                    featuredlist: rows
                });
            }
        });
    });
}

function sendFeaturedArtistNotifToFollowers(connection, featuredartists) {
    return new Promise(function (resolve, reject) {

        async.each(featuredartists, function (featuredartist, callback) {

            followutils.getUserFollowers(connection, featuredartist.uuid)
                .then(function (followers) {

                    console.log("followers are " + JSON.stringify(followers, null, 3));

                    if(followers.length > 0){
                        var notifData = {
                            category: "featured-artist-follower",
                            persistable: "No",
                            message: "Your friend "  + featuredartist.name + " (who you follow on Cread) has been chosen as a featured artist!"
                        };
                        return notify.notificationPromise(followers, notifData);
                    }
                })
                .then(function () {
                    callback();
                })
                .catch(function (err) {
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

module.exports = {
    getFeaturedArtists: getFeaturedArtists,
    sendFeaturedArtistNotifToFollowers: sendFeaturedArtistNotifToFollowers
};