/**
 * Created by avnee on 26-04-2018.
 */
'use-strict';

var config = require('../../../Config');
var consts = require('../../utils/Constants');
var utils = require('../../utils/Utils');
var feedutils = require('../FeedUtils');

function loadFeed(connection, limit, lastindexkey) {
    return new Promise(function (resolve, reject) {

        lastindexkey = (lastindexkey) ? Number(lastindexkey) : 0;

        connection.query('SELECT EA.caption, EA.entityid, EA.type, EA.regdate, ' +
            'User.uuid, User.firstname, User.lastname, Short.txt AS short, Capture.capid AS captureid, ' +
            'Short.shoid, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, ' +
            '(CASE WHEN(EA.impact_score IS NULL) THEN ? ELSE EA.impact_score END) AS impact_weight, ' +
            'CASE WHEN(EA.type = "SHORT") THEN Short.text_long IS NOT NULL ELSE Capture.text_long IS NOT NULL END AS long_form, ' +
            /*'CASE WHEN(EA.type = "SHORT") THEN Short.img_width ELSE Capture.img_width END AS img_width, ' +
            'CASE WHEN(EA.type = "SHORT") THEN Short.img_height ELSE Capture.img_height END AS img_height, ' +*/
            'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
            'COUNT(DISTINCT Comment.commid) AS commentcount ' +
            /*'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS binarycount ' +*/
            'FROM ' +
                '(SELECT E.caption, E.entityid, E.type, E.regdate, EntityAnalytics.impact_score ' +
                'FROM EntityAnalytics ' +
                'JOIN Entity E ' +
                'USING(entityid) ' +
                'WHERE E.status = "ACTIVE" ' +
                'AND E.for_explore = 1 ' +
                'AND E.merchantable = 1 ' +
                'ORDER BY impact_score DESC ' +
                'LIMIT ? ' +
                'OFFSET ?) EA ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = EA.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = EA.entityid ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = EA.entityid ' +
            /*'LEFT JOIN Downvote D ' +
            'ON D.entityid = EA.entityid ' +*/
            'LEFT JOIN Comment ' +
            'ON Comment.entityid = EA.entityid ' +
            /*'LEFT JOIN Follow ' +
            'ON User.uuid = Follow.followee ' +*/
            'GROUP BY EA.entityid ' +
            'ORDER BY impact_weight DESC ', [consts.explore_algo_base_score, limit, lastindexkey], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if (rows.length > 0) {

                    var feedEntities = rows.map(function (elem) {
                        return elem.entityid;
                    });

                    rows.map(function (element) {

                        if (element.type === 'CAPTURE') {
                            element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                        }
                        else {
                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                        }

                        element.creatorname = element.firstname + ' ' + element.lastname;

                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                        /*element.hatsoffstatus = element.hbinarycount > 0;
                        element.downvotestatus = element.dbinarycount > 0;
                        element.followstatus = element.binarycount > 0;
                        element.merchantable = (element.merchantable !== 0);*/
                        element.long_form = (element.long_form === 1);

                        if (element.hasOwnProperty('binarycount')) {
                            delete element.binarycount;
                        }

                        if (element.hasOwnProperty('hbinarycount')) {
                            delete element.hbinarycount;
                        }

                        if (element.hasOwnProperty('dbinarycount')) {
                            delete element.dbinarycount;
                        }

                        if (element.firstname) {
                            delete element.firstname;
                        }

                        if (element.lastname) {
                            delete element.lastname;
                        }

                        return element;
                    });

                    lastindexkey = lastindexkey + rows.length; /*rows[rows.length - 1]._id*/ //moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss');

                    //--Retrieve Collaboration Data--

                    feedutils.getCollaborationData(connection, rows)
                        .then(function (rows) {
                            return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                        })
                        .then(function (rows) {
                            resolve({
                                requestmore: rows.length >= limit,
                                lastindexkey: lastindexkey,
                                items: rows
                            });
                        })
                        .catch(function (err) {
                            reject(err);
                        });

                }
                else {  //Case of no data
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        items: []
                    });
                }
            }
        });
    });
}

module.exports = {
    loadFeed: loadFeed
};