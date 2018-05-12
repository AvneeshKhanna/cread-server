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
        connection.query('SELECT U.uuid, U.firstname AS name, U.lastname, FA.regdate ' +
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

        var fartist_followers = [];

        async.each(featuredartists, function (featuredartist, callback) {

            followutils.getUserFollowers(connection, featuredartist.uuid)
                .then(function (followers) {

                    console.log("followers are " + JSON.stringify(followers, null, 3));

                    if(followers.length > 0){

                        fartist_followers = fartist_followers.concat(followers);

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
                resolve(fartist_followers);
            }
        });
    });
}

function sendFeaturedArtistNotifGeneral(connection, featured_and_followers, featuredartists) {

    featured_and_followers = utils.getUniqueValues(featured_and_followers);

    return new Promise(function (resolve, reject) {
        connection.query('SELECT uuid FROM User WHERE uuid NOT IN (?)', [featured_and_followers], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                var uuids = rows.map(function (row) {
                    return row.uuid;
                });

                var notifData = {
                    category: "featured-artist-follower",
                    persistable: "No",
                    message: featuredartists.map(function(fa){ return fa.name }).join(", ") + " have been chosen as featured artists for today. Check them out on Cread!"
                };

                notify.notificationPromise(uuids, notifData)
                    .then(resolve, reject);
            }
        });
    });
}

module.exports = {
    getFeaturedArtists: getFeaturedArtists,
    sendFeaturedArtistNotifToFollowers: sendFeaturedArtistNotifToFollowers,
    sendFeaturedArtistNotifGeneral: sendFeaturedArtistNotifGeneral
};