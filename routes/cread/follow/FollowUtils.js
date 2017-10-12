/**
 * Created by avnee on 12-10-2017.
 */

/**
 * Used to handle the basic functionalities for follow system on the app
 * */

'use-strict';

var config = require('../../Config');
var utils = require('../utils/Utils');

function registerFollow(connection, register, follower, followee) {
    var sqlquery;
    var sqlparams;

    if(register){
        sqlquery = 'INSERT INTO Follow SET ?';
        sqlparams = {
            follower: follower,
            followee: followee
        }
    }
    else{
        sqlquery = 'DELETE FROM Follow WHERE follower = ? AND followee = ?';
        sqlparams = [
            follower,
            followee
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

function loadFollowers(connection, uuid, limit, page) {

    var offset = page * limit;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Follow ' +
            'WHERE followee = ?', [uuid], function (err, data) {
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
                    'LIMIT ? ' +
                    'OFFSET ? ' +
                    'ORDER BY Follow.regdate DESC', [uuid, limit, offset], function (err, rows) {
                    if(err){
                        reject(err);
                    }
                    else{
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

function loadFollowing(connection, uuid, limit, page) {

    var offset = page * limit;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Follow ' +
            'WHERE follower = ?', [uuid], function (err, data) {
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
                    'LIMIT ? ' +
                    'OFFSET ? ' +
                    'ORDER BY Follow.regdate DESC', [uuid, limit, offset], function (err, rows) {
                    if(err){
                        reject(err);
                    }
                    else{
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

module.exports = {
    registerFollow: registerFollow,
    loadFollowers: loadFollowers,
    loadFollowing: loadFollowing
};