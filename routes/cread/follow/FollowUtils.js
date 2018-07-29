/**
 * Created by avnee on 12-10-2017.
 */

/**
 * Used to handle the basic functionalities for follow system on the app
 * */

'use-strict';

var uuidgen = require('uuid');
var moment = require('moment');

var config = require('../../Config');
var utils = require('../utils/Utils');
let badgeutils = require('../badges/BadgeUtils');
var updatesutils = require('../updates/UpdatesUtils');

function registerFollow(connection, register, follower, followees) {
    var sqlquery;
    var sqlparams;

    if (register) {
        sqlquery = 'INSERT IGNORE INTO Follow (followid, follower, followee) VALUES ?';
        sqlparams = structureDataForBatchFollowing(follower, followees);
    }
    else {
        sqlquery = 'DELETE FROM Follow WHERE follower = ? AND followee IN (?)';    //This is done since followees is always an array, even with only one element
        sqlparams = [
            follower,
            followees
        ]
    }

    return new Promise(function (resolve, reject) {
        connection.query(sqlquery, sqlparams, function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function structureDataForBatchFollowing(follower, followees) {

    var master = [];

    followees.forEach(function (element) {
        var subArr = [
            uuidgen.v4(),
            follower,
            element
        ];
        master.push(subArr);
    });

    return new Array(master);
}

function loadFollowersLegacy(connection, requesteduuid, limit, page) {

    var offset = page * limit;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Follow ' +
            'WHERE followee = ?', [requesteduuid], function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                var totalcount = data[0].totalcount;

                connection.query('SELECT User.firstname, User.lastname, User.uuid ' +
                    'FROM Follow ' +
                    'JOIN User ' +
                    'ON Follow.follower = User.uuid ' +
                    'WHERE Follow.followee = ? ' +
                    'ORDER BY Follow.regdate DESC ' +
                    'LIMIT ? ' +
                    'OFFSET ? ', [requesteduuid, limit, offset], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        rows.map(function (elem) {
                            elem.profilepicurl = utils.createProfilePicUrl(elem.uuid);
                            return elem;
                        });

                        resolve({
                            requestmore: totalcount > (offset + limit),
                            users: rows
                        });
                    }
                });
            }
        });
    });
}

function loadFollowers(connection, requesteduuid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT Follow.regdate, User.firstname, User.lastname, User.uuid ' +
            'FROM Follow ' +
            'JOIN User ' +
            'ON Follow.follower = User.uuid ' +
            'WHERE Follow.followee = ? ' +
            'AND Follow.regdate < ? ' +
            'ORDER BY Follow.regdate DESC ' +
            'LIMIT ? ', [requesteduuid, lastindexkey, limit], async function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                try{
                    rows = await Promise.all(rows.map(async function (elem) {
                        elem.profilepicurl = utils.createProfilePicUrl(elem.uuid);
                        elem.topartist = await badgeutils.isTopArtist(elem.uuid);
                        return elem;
                    }));
                }
                catch (err){
                    reject(err);
                    return;
                }

                if(rows.length > 0){
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        users: rows
                    });
                }
                else{
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        users: rows
                    });
                }
            }
        });
    });
}

function loadFollowingLegacy(connection, requesteduuid, limit, page) {

    var offset = page * limit;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Follow ' +
            'WHERE follower = ?', [requesteduuid], function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                var totalcount = data[0].totalcount;

                connection.query('SELECT User.firstname, User.lastname, User.uuid ' +
                    'FROM Follow ' +
                    'JOIN User ' +
                    'ON Follow.followee = User.uuid ' +
                    'WHERE Follow.follower = ? ' +
                    'ORDER BY Follow.regdate DESC ' +
                    'LIMIT ? ' +
                    'OFFSET ?', [requesteduuid, limit, offset], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        rows.map(function (elem) {
                            elem.profilepicurl = utils.createProfilePicUrl(elem.uuid);
                            return elem;
                        });

                        resolve({
                            requestmore: totalcount > (offset + limit),
                            users: rows
                        });
                    }
                });
            }
        });
    });
}

function loadFollowing(connection, requesteduuid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.firstname, User.lastname, User.uuid, Follow.regdate ' +
            'FROM Follow ' +
            'JOIN User ' +
            'ON Follow.followee = User.uuid ' +
            'WHERE Follow.follower = ? ' +
            'AND Follow.regdate < ? ' +
            'ORDER BY Follow.regdate DESC ' +
            'LIMIT ?', [requesteduuid, lastindexkey, limit], async function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                try{
                    rows = await Promise.all(rows.map(async function (elem) {
                        elem.profilepicurl = utils.createProfilePicUrl(elem.uuid);
                        elem.topartist = await badgeutils.isTopArtist(elem.uuid);
                        return elem;
                    }));
                }
                catch (err){
                    reject(err);
                    return;
                }

                if(rows.length > 0){
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        users: rows
                    });
                }
                else{
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        users: rows
                    });
                }
            }
        });
    });
}

function updateFollowDataForUpdates(connection, register, uuid, actor_uuid) {
    return new Promise(function (resolve, reject) {
        if(register){   //Case: Follow
            var updatesparams = {
                uuid: uuid,
                actor_uuid: actor_uuid,
                entityid: null,
                category: "follow"
            };
            updatesutils.addToUpdatesTable(connection, updatesparams)
                .then(resolve, reject);
        }
        else{   //Case: Un-Follow
            var where_col_names = [
                "uuid",
                "actor_uuid",
                "category"
            ];

            var where_col_values = [
                uuid,
                actor_uuid,
                "follow"
            ];
            updatesutils.deleteFromUpdatesTable(connection, where_col_names, where_col_values)
                .then(resolve, reject);
        }
    })
}

/**
 * Returns a specific user's followers
 * */
function getUserFollowers(connection, user_uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT follower ' +
            'FROM Follow ' +
            'WHERE followee = ?', [user_uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows.map(function (row) {
                    return row.follower;
                }));
            }
        });
    });
}

/**
 * Register Cread Kalakaar as a follower and a followee for the given user
 * */
function registerFollowForCreadKalakaar(connection, user_uuid) {
    return new Promise(function (resolve, reject) {

        var sqlparams = [
            [uuidgen.v4(), config.getCreadKalakaarUUID(), user_uuid],
            [uuidgen.v4(), user_uuid, config.getCreadKalakaarUUID()]
        ];

        connection.query('INSERT IGNORE INTO Follow (followid, followee, follower) VALUES ?', [sqlparams], function (err, rows) {
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
    registerFollow: registerFollow,
    loadFollowersLegacy: loadFollowersLegacy,
    loadFollowers: loadFollowers,
    loadFollowingLegacy: loadFollowingLegacy,
    loadFollowing: loadFollowing,
    updateFollowDataForUpdates: updateFollowDataForUpdates,
    getUserFollowers: getUserFollowers,
    registerFollowForCreadKalakaar: registerFollowForCreadKalakaar
};