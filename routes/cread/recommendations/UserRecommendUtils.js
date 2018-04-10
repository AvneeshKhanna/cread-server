/**
 * Created by avnee on 05-04-2018.
 */
'use-strict';

var config = require('../../Config');
var utils = require('../utils/Utils');
var userprofileutils = require('../user-manager/UserProfileUtils');

function getUsersPosts(users) {

    var uuids = users.map(function (e) {
        return e.uuid;
    });

    return new Promise(function (resolve, reject) {
        userprofileutils.getLatestPostsCache(uuids)
            .then(function (result) {

            })
    });
}

function getTopUsersData(connection, uuid, limit, lastindexkey) {

    lastindexkey = lastindexkey ? Number(lastindexkey) : 0;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT CONCAT_WS(" ", U.firstname, U.lastname) AS name, U.bio, U.uuid ' +
            'FROM User U ' +
            'JOIN UserAnalytics UA ' +
            'USING(uuid) ' +
            'WHERE U.uuid <> ? ' +
            'GROUP BY U.uuid ' +
            'ORDER BY UA.quality_percentile_score DESC ' +
            'LIMIT ? ' +
            'OFFSET ?', [config.getCreadKalakaarUUID(), limit, lastindexkey], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                lastindexkey = lastindexkey + rows.length;

                rows.map(function (element) {

                    //TODO: Change
                    element.postcount = 10;
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
                });

                resolve({
                    requestmore: rows.length >= limit,
                    lastindexkey: lastindexkey,
                    users: rows
                });
            }
        });
    });
}

function getTopUsersOverview(connection, requesteruuid, limit/*, lastindexkey*/) {

    // lastindexkey = lastindexkey ? Number(lastindexkey) : 0;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT U.firstname AS name, U.uuid ' +
            'FROM User U ' +
            'JOIN UserAnalytics UA ' +
            'USING(uuid) ' +
            'JOIN Follow F ' +
            'ON (F.followee = U.uuid AND F.follower <> ?) ' +   //To get only those users who the requester is not following
            'WHERE UA.quality_percentile_score >= 75 ' +
            'GROUP BY U.uuid ' +
            'ORDER BY UA.quality_percentile_score DESC ' +
            'LIMIT ? '/* +
            'OFFSET ?'*/, [requesteruuid, limit/*, lastindexkey*/], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                /*lastindexkey += rows.length;*/

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