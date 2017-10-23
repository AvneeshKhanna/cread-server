/**
 * Created by avnee on 27-09-2017.
 */
'use-strict';

var utils = require('../utils/Utils');
var requestclient = require('request');

function loadTimeline(connection, uuid, limit, page) {

    var offset = limit * page;

    return new Promise(function (resolve, reject) {

        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'USING(entityid) ' +
            'LEFT JOIN Short ' +
            'USING(entityid) ' +
            'WHERE Capture.uuid = ? ' +
            'OR Short.uuid = ? ', [], function(err, data){
            if(err){
                reject(err);
            }
            else{
                var totalcount = data[0].totalcount;

                connection.query('SELECT * ' +
                    'FROM Entity ' +
                    'LEFT JOIN Capture ' +
                    'USING(entityid) ' +
                    'LEFT JOIN Short ' +
                    'USING(entityid) ' +
                    'WHERE Capture.uuid = ? ' +
                    'OR Short.uuid = ? ' +
                    'ORDER BY Entity.regdate DESC', [uuid, uuid], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {

                        resolve({
                            requestmore: totalcount > (offset + limit),
                            items: rows
                        });
                    }
                });

            }
        });


    });
}

function loadProfileInformation(connection, requesteduuid){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.uuid, User.firstname, User.lastname, User.email, User.phone, Follow.followee, Follow.follower ' +
            'FROM User ' +
            'LEFT JOIN Follow ' +
            'ON (Follow.followee = User.uuid OR Follow.follower = User.uuid) ' +
            'WHERE User.uuid = ?', [requesteduuid], function (err, rows) {
            if (err) {
                reject(err)
            }
            else {
                var followercount = rows.filter(function (elem) {
                    return (elem.followee === requesteduuid);
                }).length;

                var following = rows.filter(function (elem) {
                    return (elem.follower === requesteduuid);
                });

                var followingcount = following.length;

                var userdata = rows[0];

                userdata.profilepicurl = utils.createProfilePicUrl(userdata.uuid);

                userdata.followstatus = (following.filter(function (elem) {
                    return (elem.uuid === requesteduuid)
                }).length !== 0);

                userdata.followercount = followercount;
                userdata.followingcount = followingcount;

                connection.query('SELECT COUNT(entityid) AS postcount ' +
                    'FROM Entity ' +
                    'LEFT JOIN Capture ' +
                    'USING(entityid) ' +
                    'LEFT JOIN Short ' +
                    'USING(entityid) ' +
                    'WHERE Capture.uuid = ? ' +
                    'OR Short.uuid = ?', [requesteduuid, requesteduuid], function(err, data){
                    if(err){
                        reject(err);
                    }
                    else{
                        userdata.postcount = data[0].postcount;
                        resolve(userdata);
                    }
                });
            }
        });
    });
}

function loadFacebookFriends(connection, uuid, fbid, fbaccesstoken, nexturl) {
    return new Promise(function (resolve, reject) {

        //TODO: Pagination for Graph API Query
        var graphurl = (nexturl) ? nexturl : 'https://graph.facebook.com/v2.10/'
            + fbid
            + '/'
            + 'friends'
            + '?'
            + 'access_token='
            + fbaccesstoken;

        requestclient(graphurl, function (error, response, body) {
            if(error){
                reject(error);
            }
            else{
                var friendsids = response.data.map(function (element) {
                    return element.id;
                });

                var result = {};

                if(friendsids.length === 0){
                    result.requestmore = false;
                    result.friends = response.data;
                    resolve(result);
                }
                else{
                    connection.query('SELECT User.firstname, User.lastname, User.uuid, ' +
                        'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS binarycount ' +
                        'FROM User ' +
                        'LEFT JOIN Follow ' +
                        'ON User.uuid = Follow.followee ' +
                        'WHERE User.fbid IN (?) ' +
                        'GROUP BY User.uuid', [uuid, friendsids], function (err, rows) {

                        if (err) {
                            reject(err);
                        }
                        else {

                            if(response.paging){
                                result.nexturl = response.paging.next;
                            }

                            result.requestmore = !!response.paging;

                            rows.map(function (elem) {
                                elem.profilepicurl = utils.createProfilePicUrl(elem.uuid);
                                elem.followstatus = elem.binarycount > 0;
                                return elem;
                            });

                            result.friends = rows;

                            resolve(result);
                        }
                    });
                }

            }
        });

    });
}

module.exports = {
    loadTimeline: loadTimeline,
    loadProfileInformation: loadProfileInformation,
    loadFacebookFriends: loadFacebookFriends
};