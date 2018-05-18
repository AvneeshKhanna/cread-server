/**
 * Created by avnee on 06-04-2018.
 */
'use-strict';

var moment = require('moment');

var config = require('../../Config');
var utils = require('../utils/Utils');
var feedutils = require('../feed/FeedUtils');
var userprofileutils = require('../user-manager/UserProfileUtils');
var commentutils = require('../comment/CommentUtils');
var hatsoffutils = require('../hats-off/HatsOffUtils');
var consts = require('../utils/Constants');

function getRecommendedPosts(connection, requesteruuid, creatoruuid, collaboratoruuid, entityid, limit, lastindexkey) {

    var uuids = [
        creatoruuid
    ];

    if(collaboratoruuid){
        uuids.push(collaboratoruuid);
    }

    lastindexkey = lastindexkey ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.caption, Entity.entityid, Entity.merchantable, Entity.type, Entity.regdate, ' +
            /*'Short.shoid, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, Capture.capid AS captureid, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.text_long IS NOT NULL ELSE Capture.text_long IS NOT NULL END AS long_form, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.img_width ELSE Capture.img_width END AS img_width, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.img_height ELSE Capture.img_height END AS img_height, ' +*/
            /*'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +*/
            /*'COUNT(DISTINCT Comment.commid) AS commentcount, ' +*/
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS binarycount, ' +
            'User.uuid, CONCAT_WS(" ", User.firstname, User.lastname) AS creatorname ' +
            'FROM Entity ' +
            /*'LEFT JOIN Capture ' +
            'USING(entityid) ' +
            'LEFT JOIN Short ' +
            'USING(entityid) ' +*/
            'JOIN User ' +
            // 'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'ON (User.uuid = Entity.uuid) ' +
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = Entity.entityid ' +
            'LEFT JOIN Downvote D ' +
            'ON D.entityid = Entity.entityid ' +
            /*'LEFT JOIN Comment ' +
            'ON Comment.entityid = Entity.entityid ' +*/
            'LEFT JOIN Follow ' +
            'ON User.uuid = Follow.followee ' +
            'WHERE User.uuid IN (?) ' +
            'AND Entity.entityid <> ? ' +
            'AND Entity.status = "ACTIVE" ' +
            'AND Entity.regdate < ? ' +
            'GROUP BY Entity.entityid ' +
            'ORDER BY Entity.regdate DESC ' +
            'LIMIT ? ', [requesteruuid, requesteruuid, requesteruuid, uuids, entityid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                var feedEntities = rows.map(function (elem) {
                    return elem.entityid;
                });

                if (rows.length > 0) {
                    rows.map(function (element) {

                        /*var thisEntityIndex = hdata.map(function (el) {
                            return el.entityid;
                        }).indexOf(element.entityid);*/

                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                        element.hatsoffstatus = element.hbinarycount > 0;
                        element.followstatus = element.binarycount > 0;
                        element.downvotestatus = element.dbinarycount > 0;
                        element.merchantable = (element.merchantable !== 0);
                        element.long_form = (element.long_form === 1);

                        /*if (element.type === 'CAPTURE') {
                            element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                        }
                        else {
                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                        }*/

                        if (element.hasOwnProperty('hbinarycount')) {
                            delete element.hbinarycount;
                        }

                        if (element.hasOwnProperty('dbinarycount')) {
                            delete element.dbinarycount;
                        }

                        if (element.hasOwnProperty('fbinarycount')) {
                            delete element.fbinarycount;
                        }

                        return element;
                    });

                    var candownvote;

                    feedutils.getEntitiesInfoFast(connection, rows)
                        .then(function (updated_rows) {
                            rows = updated_rows;
                            return hatsoffutils.loadHatsoffCountsFast(connection, rows);
                        })
                        .then(function (updated_rows) {
                            rows = updated_rows;
                            return commentutils.loadCommentCountsFast(connection, rows);
                        })
                        .then(function (updated_rows) {
                            rows = updated_rows;
                            return userprofileutils.getUserQualityPercentile(connection, requesteruuid);
                        })
                        .then(function (result) {
                            candownvote = result.quality_percentile_score >= consts.min_percentile_quality_user_downvote;
                            return feedutils.getCollaborationData(connection, rows);
                        })
                        .then(function (rows) {
                            /*rows.map(function (e) {
                                e.collabcount = 0;
                                return e;
                            });*/
                            return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                        })
                        .then(function (rows) {
                            console.log("rows after getCollabCounts is " + JSON.stringify(rows, null, 3));
                            resolve({
                                requestmore: rows.length >= limit,//totalcount > (offset + limit),
                                candownvote: candownvote,
                                lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                                items: rows
                            });
                        })
                        .catch(function (err) {
                            reject(err);
                        });

                }
                else {   //Case of no data
                    resolve({
                        requestmore: rows.length >= limit,
                        candownvote: false, //Since no posts exist, user would have a percentile 0. Hence, not a quality user
                        lastindexkey: null,
                        items: []
                    });
                }
            }
        });
    });
}

module.exports = {
    getRecommendedPosts: getRecommendedPosts
};