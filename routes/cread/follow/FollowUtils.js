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
            'LIMIT ? ', [requesteduuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                rows.map(function (elem) {
                    elem.profilepicurl = utils.createProfilePicUrl(elem.uuid);
                    return elem;
                });

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
            'LIMIT ?', [requesteduuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                rows.map(function (elem) {
                    elem.profilepicurl = utils.createProfilePicUrl(elem.uuid);
                    return elem;
                });

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

module.exports = {
    registerFollow: registerFollow,
    loadFollowersLegacy: loadFollowersLegacy,
    loadFollowers: loadFollowers,
    loadFollowingLegacy: loadFollowingLegacy,
    loadFollowing: loadFollowing
};