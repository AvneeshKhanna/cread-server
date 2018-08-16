/**
 * Created by avnee on 23-07-2018.
 */

/**
 * This file is created primarily as an alternative to EntityUtils.loadEntityData() as there it was creating
 * circular dependency errors in some cases
 * */
'use-strict';

const feedutils = require('../feed/FeedUtils');
const utils = require('../utils/Utils');
const userprofileutils = require('../user-manager/UserProfileUtils');
const hatsoffutils = require('../hats-off/HatsOffUtils');
const commentutils = require('../comment/CommentUtils');
const consts = require('../utils/Constants');
const post_type = consts.post_type;

const NotFoundError = require('../utils/NotFoundError');

function loadEntityData(connection, requesteruuid, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.caption, Entity.entityid, Entity.merchantable, Entity.type, Entity.regdate, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS fbinarycount, ' +
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
            'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount, ' +
            'User.uuid, CONCAT_WS(" ", User.firstname, User.lastname) AS creatorname ' +
            'FROM Entity ' +
            'JOIN User ' +
            'ON (User.uuid = Entity.uuid) ' +
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

                    /*if (element.type === post_type.CAPTURE) {
                        element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                    }
                    else if(element.type === post_type.SHORT){
                        element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                    }
                    else{
                        element.entityurl = utils.createSmallMemeUrl(element.uuid, element.memeid);
                    }*/

                    /*element.creatorname = element.firstname + ' ' + element.lastname;*/
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

                let candownvote = false;    //TODO: Revert

                feedutils.getEntitiesInfoFast(connection, row)
                    .then(updated_row => {
                        row = updated_row;
                        return hatsoffutils.loadHatsoffCountsFast(connection, row);
                    })
                    .then(function (updated_row) {
                        rows = updated_row;
                        return commentutils.loadCommentCountsFast(connection, row);
                    })
                    .then(updated_row => {
                        row = updated_row;
                        return userprofileutils.getUserQualityPercentile(connection, requesteruuid);
                    })
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