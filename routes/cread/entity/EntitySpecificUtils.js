/**
 * Created by avnee on 23-07-2018.
 */

/**
 * This file is created primarily as an alternative to EntityUtils.loadEntityData() as there it was creating
 * circular dependency errors in some cases
 * */
'use-strict';

var feedutils = require('../feed/FeedUtils');
var utils = require('../utils/Utils');
var userprofileutils = require('../user-manager/UserProfileUtils');
var consts = require('../utils/Constants');

var NotFoundError = require('../utils/NotFoundError');

function loadEntityData(connection, requesteruuid, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.caption, Entity.entityid, Entity.merchantable, Entity.type, Entity.regdate, Short.shoid, Capture.capid AS captureid, ' +
            'Capture.shoid AS cpshortid, Short.capid AS shcaptureid, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.livefilter ELSE Capture.livefilter END AS livefilter, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.text_long IS NOT NULL ELSE Capture.text_long IS NOT NULL END AS long_form, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.img_width ELSE Capture.img_width END AS img_width, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.img_height ELSE Capture.img_height END AS img_height, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS fbinarycount, ' +
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
            'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount, ' +
            'COUNT(DISTINCT Comment.commid) AS commentcount, ' +
            'User.uuid, User.firstname, User.lastname ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'LEFT JOIN Comment ' +
            'ON Comment.entityid = Entity.entityid ' +
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = Entity.entityid ' +
            'LEFT JOIN Downvote D ' +
            'ON D.entityid = Entity.entityid ' +
            'LEFT JOIN Follow ' +
            'ON User.uuid = Follow.followee ' +
            'WHERE Entity.entityid = ?', [requesteruuid, requesteruuid, requesteruuid, entityid], function (err, row) {
            if (err) {
                reject(err);
            }
            else {

                if(!row[0].entityid){   //Because even in case of invalid entityid, user related data is returned
                    reject(new NotFoundError('Invalid "entityid"'));
                    return;
                }

                row.map(function (element) {
                    element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);

                    if (element.type === 'CAPTURE') {
                        element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                    }
                    else {
                        element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                    }

                    element.creatorname = element.firstname + ' ' + element.lastname;
                    element.hatsoffstatus = element.hbinarycount > 0;
                    element.followstatus = element.fbinarycount > 0;
                    element.downvotestatus = element.dbinarycount > 0;
                    element.merchantable = (element.merchantable !== 0);
                    element.long_form = (element.long_form === 1);

                    /*if(element.capid) {
                        delete element.capid;
                    }*/

                    /*if(element.shoid) {
                        delete element.shoid;
                    }*/

                    if (element.firstname) {
                        delete element.firstname;
                    }

                    if (element.lastname) {
                        delete element.lastname;
                    }

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

                var candownvote = false;    //TODO: Revert

                //TODO: Solve a bug where 'TypeError: userprofileutils.getUserQualityPercentile' exception occurs possible due to circular dependency
                userprofileutils.getUserQualityPercentile(connection, requesteruuid)
                    .then(function (result) {
                        candownvote = result.quality_percentile_score >= consts.min_percentile_quality_user_downvote;
                        return feedutils.getCollaborationData(connection, row);
                    })
                    .then(function (row) {

                        /*rows.map(function (e) {
                            e.collabcount = 0;
                            return e;
                        });*/

                        return feedutils.getCollaborationCounts(connection, row, [entityid]);
                    })
                    .then(function (row) {
                        resolve({
                            candownvote: candownvote,
                            entity: row[0]
                        });
                    })
                    .catch(function (err) {
                        reject(err);
                    });

                /*resolve({
                    entity: row[0]
                });*/
            }
        });
    });
}

module.exports = {
    loadEntityData: loadEntityData
};