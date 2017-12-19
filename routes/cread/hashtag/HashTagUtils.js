/**
 * Created by avnee on 18-12-2017.
 */
'use-strict';
var moment = require('moment');

var feedutils = require('../feed/FeedUtils');
var utils = require('../utils/Utils');

function extractMatchingUniqueHashtags(caption, matchword) {
    var regex = new RegExp("\\#" + matchword + "*(\\w+|\\s+)", "i");   //Match pattern containing specific hashtags
    var tagSet = new Set();
    var match;

    console.log('regex is ' + regex.toString() + ' with caption  ' + caption);

    while ((match = regex.exec(caption)) !== null) {
        caption = caption.replace(match[0].trim(), "");
        tagSet.add(match[0].replace("#", "").trim().toLowerCase());
    }

    var tags = new Array();

    tagSet.forEach(function (tag) {
        tags.push(tag);
    });

    console.log(JSON.stringify(tags, null, 3));
    return tags;
}

function extractUniqueHashtags(caption) {
    var regex = /\#\w+/i;   //Match pattern containing hashtags
    var tagSet = new Set();
    var match;

    while ((match = regex.exec(caption)) !== null) {
        caption = caption.replace(match[0], "");
        tagSet.add(match[0].replace('#', '').toLowerCase());
    }

    var tags = new Array();

    tagSet.forEach(function (tag) {
        tags.push(tag);
    });

    console.log(JSON.stringify(tags, null, 3));
    return tags;
}

function addHashtagsToDb(connection, uniquehashtags, entityid) {

    var sqlparams = [];

    uniquehashtags.forEach(function (uniquetag) {

        sqlparams.push([
            uniquetag,
            entityid
        ]);

    });

    return new Promise(function (resolve, reject) {
        //'INSERT IGNORE' clause is used to ignore insertion of new rows into the table that violate
        //the UNIQUE index criteria of column(s) of the table
        connection.query('INSERT IGNORE INTO HashTagDistribution (hashtag, entityid) VALUES ?', [sqlparams], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function getHashtagCounts(connection, uniquetags) {

    uniquetags = uniquetags.map(function (t) {
        return t.replace('#', '');
    });

    return new Promise(function (resolve, reject) {
        connection.query('SELECT hashtag, COUNT(*) AS postcount ' +
            'FROM HashTagDistribution ' +
            'WHERE hashtag IN (?) ' +
            'GROUP BY hashtag ' +
            'ORDER BY postcount DESC', [uniquetags], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

function loadHashtagFeed(connection, uuid, limit, hashtag, lastindexkey) {
    return new Promise(function (resolve, reject) {

        hashtag = hashtag.replace('#', '');
        console.log("hashtag after filtering " + JSON.stringify(hashtag, null, 3));

        lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

        connection.query('SELECT Entity.caption, Entity.entityid, Entity.merchantable, Entity.type, Entity.regdate, User.uuid, ' +
            'User.firstname, User.lastname, Short.txt AS short, Capture.capid AS captureid, ' +
            'Short.shoid, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, ' +
            'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
            'COUNT(DISTINCT Comment.commid) AS commentcount, ' +
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS binarycount ' +
            'FROM Entity ' +
            'JOIN HashTagDistribution AS HTD ' +
            'ON HTD.entityid = Entity.entityid ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = Entity.entityid ' +
            'LEFT JOIN Comment ' +
            'ON Comment.entityid = Entity.entityid ' +
            'LEFT JOIN Follow ' +
            'ON User.uuid = Follow.followee ' +
            'WHERE Entity.status = "ACTIVE" ' +
            'AND Entity.regdate < ? ' +
            'AND MATCH(HTD.hashtag) ' +
            'AGAINST (? IN BOOLEAN MODE) ' +
            'GROUP BY Entity.entityid ' +
            'ORDER BY Entity.regdate DESC ' +
            'LIMIT ?', [uuid, uuid, lastindexkey, hashtag, limit], function (err, rows) {
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
                        else if (element.type === 'SHORT'){
                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                        }

                        element.creatorname = element.firstname + ' ' + element.lastname;

                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                        element.hatsoffstatus = element.hbinarycount === 1;
                        element.followstatus = element.binarycount > 0;
                        element.merchantable = (element.merchantable !== 0);

                        if (element.hasOwnProperty('binarycount')) {
                            delete element.binarycount;
                        }

                        if (element.hasOwnProperty('hbinarycount')) {
                            delete element.hbinarycount;
                        }

                        if (element.firstname) {
                            delete element.firstname;
                        }

                        if (element.lastname) {
                            delete element.lastname;
                        }

                        return element;
                    });

                    //--Retrieve Collaboration Data--

                    feedutils.getCollaborationData(connection, rows)
                        .then(function (rows) {
                            return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                        })
                        .then(function (rows) {
                            resolve({
                                requestmore: rows.length >= limit,
                                lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                                feed: rows
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
                        feed: []
                    });
                }
            }
        });
    });

}

module.exports = {
    extractUniqueHashtags: extractUniqueHashtags,
    extractMatchingUniqueHashtags: extractMatchingUniqueHashtags,
    addHashtagsToDb: addHashtagsToDb,
    getHashtagCounts: getHashtagCounts,
    loadHashtagFeed: loadHashtagFeed
};