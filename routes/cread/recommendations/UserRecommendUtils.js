/**
 * Created by avnee on 05-04-2018.
 */
'use-strict';

var config = require('../../Config');
var utils = require('../utils/Utils');
var consts = require('../utils/Constants');
var userprofileutils = require('../user-manager/UserProfileUtils');

function getUsersPosts(users) {

    var uuids = users.map(function (e) {
        return e.uuid;
    });

    return new Promise(function (resolve, reject) {
        userprofileutils.getLatestPostsCache(uuids)
            .then(function (result) {
                for (var uuid in result) {
                    users[uuids.indexOf(uuid)].posts = result[uuid];
                }
                resolve(users);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

function getTopUsersData(connection, requesteruuid, limit, lastindexkey) {

    lastindexkey = lastindexkey ? Number(lastindexkey) : 0;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT F.followid AS fid, CONCAT_WS(" ", U.firstname, U.lastname) AS name, U.bio, U.uuid, ' +
            'COUNT(DISTINCT E.entityid) AS postcount ' +
            'FROM User U ' +
            'JOIN UserAnalytics UA ' +
            'USING(uuid) ' +
            'LEFT JOIN Short S ' +
            'ON(S.uuid = U.uuid) ' +
            'LEFT JOIN Capture C ' +
            'ON(C.uuid = U.uuid) ' +
            'LEFT JOIN Entity E ' +
            'ON(S.entityid = E.entityid OR C.entityid = E.entityid) ' +
            'LEFT JOIN Follow F ' +
            'ON (F.followee = U.uuid AND F.follower = ?) ' +   //To get only those users who the requester is not following
            'WHERE U.uuid <> ? ' +
            'AND U.uuid <> ? ' +
            'AND E.status = "ACTIVE" ' +
            'AND UA.quality_percentile_score >= ? ' +
            'GROUP BY U.uuid ' +
            'HAVING fid IS NULL ' +
            'ORDER BY UA.quality_percentile_score DESC ' +
            'LIMIT ? ' +
            'OFFSET ?', [requesteruuid, config.getCreadKalakaarUUID(), requesteruuid, consts.min_qpercentile_user_recommendation, limit, lastindexkey], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                lastindexkey = lastindexkey + rows.length;

                /*var uuids = rows.map(function (r) {
                    return r.uuid
                });
                
                userprofileutils.getLatestPostsCache(uuids)
                    .then(function () {

                    })*/

                rows = utils.shuffle(rows);

                if(rows.length > 0){
                    getUsersPosts(rows)
                        .then(function (users) {

                            users.map(function (element) {
                                element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                                return element;
                            });

                            resolve({
                                requestmore: users.length >= limit,
                                lastindexkey: lastindexkey,
                                users: users
                            });
                        })
                        .catch(function (err) {
                            reject(err);
                        });

                    /*rows.map(function (element) {

                        //TODO: Change
                        element.posts = [
                            {
                                entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/9cca2473-9626-4883-98ea-b68d403a0323-small.jpg"
                            },
                            {
                                entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/8fbbf4ca-8ef1-41ba-aa83-d0dfca854dcb-small.jpg"
                            },
                            {
                                entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Profile/display-pic-small.jpg"
                            },
                            {
                                entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Short/d2b88106-709f-48ed-97c0-845b0b5450cd-small.jpg"
                            },
                            {
                                entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/45e84cb0-6c4c-43fb-8494-4ecc26829eb1-small.jpg"
                            },
                            {
                                entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Profile/display-pic-small.jpg"
                            },
                            {
                                entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Short/d2b88106-709f-48ed-97c0-845b0b5450cd-small.jpg"
                            },
                            {
                                entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/45e84cb0-6c4c-43fb-8494-4ecc26829eb1-small.jpg"
                            }
                        ];

                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                        return element;
                    });*/
                }
                else{
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: lastindexkey,
                        users: []
                    });
                }
            }
        });
    });
}

function getTopUsersOverview(connection, requesteruuid, limit/*, lastindexkey*/) {

    // lastindexkey = lastindexkey ? Number(lastindexkey) : 0;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT F.followid AS fid, U.firstname AS name, U.uuid ' +
            'FROM User U ' +
            'JOIN UserAnalytics UA ' +
            'USING(uuid) ' +
            'LEFT JOIN Follow F ' +
            'ON (F.followee = U.uuid AND F.follower = ?) ' +   //To get only those users who the requester is not following
            'WHERE U.uuid <> ? ' +
            'AND U.uuid <> ? ' +
            'AND UA.quality_percentile_score >= ? ' +
            'GROUP BY U.uuid ' +
            'HAVING fid IS NULL ' +
            'ORDER BY UA.quality_percentile_score DESC ' +
            'LIMIT ? '/* +
            'OFFSET ?'*/, [requesteruuid, requesteruuid, config.getCreadKalakaarUUID(), consts.min_qpercentile_user_recommendation, limit/*, lastindexkey*/], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                /*lastindexkey += rows.length;*/
                rows = utils.shuffle(rows);

                rows.map(function (element) {
                    return element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                });

                resolve({
                    /*requestmore: rows.length >= limit,
                    lastindexkey: lastindexkey,*/
                    items: rows
                });
            }
        });
    });
}

module.exports = {
    getTopUsersOverview: getTopUsersOverview,
    getTopUsersData: getTopUsersData
};