/**
 * Created by avnee on 27-09-2017.
 */
'use-strict';

//region Global Variables

const utils = require('../utils/Utils');
const requestclient = require('request');

const envconfig = require('config');

const fs = require('fs');
const jimp = require('jimp');
const uuidgen = require('uuid');
const moment = require('moment');

const config = require('../../Config');
const AWS = config.AWS;
const s3bucket = envconfig.get('s3.bucket');

const imagesize = require('image-size');

const BreakPromiseChainError = require('../utils/BreakPromiseChainError');
const NotFoundError = require('../utils/NotFoundError');

const feedutils = require('../feed/FeedUtils');
const consts = require('../utils/Constants');
const post_type = consts.post_type;

const cache_manager = require('../utils/cache/CacheManager');
const cache_utils = require('../utils/cache/CacheUtils');
const commentutils = require('../comment/CommentUtils');
const hatsoffutils = require('../hats-off/HatsOffUtils');
const badgeutils = require('../badges/BadgeUtils');
const REDIS_KEYS = cache_utils.REDIS_KEYS;

//endregion

function loadTimelineLegacy(connection, requesteduuid, requesteruuid, limit, page) {

    let offset = limit * page;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'USING(entityid) ' +
            'LEFT JOIN Short ' +
            'USING(entityid) ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'WHERE User.uuid = ? ' +
            'AND Entity.status = "ACTIVE" ', [requesteduuid], function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                let totalcount = (data[0]) ? data[0].totalcount : 0;

                if (totalcount > 0) {
                    connection.query('SELECT Entity.entityid, Entity.merchantable, Entity.type, User.uuid, User.firstname, User.lastname, Short.shoid, Capture.capid AS captureid, ' +
                        'COUNT(DISTINCT HatsOff.hoid) AS hatsoffcount, COUNT(DISTINCT Comment.commid) AS commentcount ' +
                        'FROM Entity ' +
                        'LEFT JOIN Capture ' +
                        'USING(entityid) ' +
                        'LEFT JOIN Short ' +
                        'USING(entityid) ' +
                        'JOIN User ' +
                        'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
                        'LEFT JOIN HatsOff ' +
                        'ON HatsOff.entityid = Entity.entityid ' +
                        'LEFT JOIN Comment ' +
                        'ON Comment.entityid = Entity.entityid ' +
                        'WHERE User.uuid = ? ' +
                        'AND Entity.status = "ACTIVE" ' +
                        'GROUP BY Entity.entityid ' +
                        'ORDER BY Entity.regdate DESC ' +
                        'LIMIT ? ' +
                        'OFFSET ?', [requesteduuid, limit, offset], function (err, rows) {
                        if (err) {
                            reject(err);
                        }
                        else {

                            var feedEntities = rows.map(function (elem) {
                                return elem.entityid;
                            });

                            connection.query('SELECT entityid, uuid ' +
                                'FROM HatsOff ' +
                                'WHERE uuid = ? ' +
                                'AND entityid IN (?) ' +
                                'GROUP BY entityid', [requesteruuid, feedEntities], function (err, hdata) {

                                if (err) {
                                    reject(err);
                                }
                                else {
                                    rows.map(function (element) {

                                        var thisEntityIndex = hdata.map(function (el) {
                                            return el.entityid;
                                        }).indexOf(element.entityid);

                                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                                        element.creatorname = element.firstname + ' ' + element.lastname;
                                        element.hatsoffstatus = thisEntityIndex !== -1;
                                        element.merchantable = (element.merchantable !== 0);

                                        if (element.type === 'CAPTURE') {
                                            element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                                        }
                                        else {
                                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                                        }

                                        if (element.firstname) {
                                            delete element.firstname;
                                        }

                                        if (element.lastname) {
                                            delete element.lastname;
                                        }

                                        return element;
                                    });

                                    resolve({
                                        requestmore: totalcount > (offset + limit),
                                        items: rows
                                    });
                                }
                            });
                        }
                    });
                }
                else {
                    resolve({
                        requestmore: totalcount > (offset + limit),
                        items: []
                    });
                }
            }
        });


    });
}

function loadTimeline(connection, requesteduuid, requesteruuid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    console.log("TIME before SQL: " + moment().format('YYYY-MM-DD HH:mm:ss'));

    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.caption, Entity.entityid, Entity.regdate, Entity.merchantable, Entity.type, ' +
            'User.uuid, User.firstname, User.lastname, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS fbinarycount, ' +
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount ' +
            'FROM Entity ' +
            'JOIN User ' +
            'ON (Entity.uuid = User.uuid) ' +
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = Entity.entityid ' +
            'LEFT JOIN Downvote D ' +
            'ON D.entityid = Entity.entityid ' +
            'LEFT JOIN Follow ' +
            'ON User.uuid = Follow.followee ' +
            'WHERE User.uuid = ? ' +
            'AND Entity.status = "ACTIVE" ' +
            'AND Entity.regdate < ? ' +
            'GROUP BY Entity.entityid ' +
            'ORDER BY Entity.regdate DESC ' +
            'LIMIT ?', [requesteruuid, requesteruuid, requesteruuid, requesteduuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                console.log("TIME after SQL: " + moment().format('YYYY-MM-DD HH:mm:ss'));

                let feedEntities = rows.map(function (elem) {
                    return elem.entityid;
                });

                if (rows.length > 0) {
                    rows.map(function (element) {
                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                        element.creatorname = element.firstname + ' ' + element.lastname;
                        element.hatsoffstatus = element.hbinarycount > 0;
                        element.followstatus = element.fbinarycount > 0;
                        element.downvotestatus = element.dbinarycount > 0;
                        element.merchantable = (element.merchantable !== 0);
                        // element.long_form = (element.long_form === 1);

                        if(element.type === 'MEME'){
                            element.collabcount = 0; //FixMe
                        }

                        if (element.hasOwnProperty('firstname')) {
                            delete element.firstname;
                        }

                        if (element.hasOwnProperty('lastname')) {
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

                    let candownvote;

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
                            console.log("TIME after loadCommentCountsFast: " + moment().format('YYYY-MM-DD HH:mm:ss'));
                            rows = updated_rows;
                            return getUserQualityPercentile(connection, requesteruuid);
                        })
                        // getUserQualityPercentile(connection, requesteruuid)
                        .then(function (result) {
                            candownvote = result.quality_percentile_score >= consts.min_percentile_quality_user_downvote;
                            return feedutils.getCollaborationData(connection, rows);
                        })
                        .then(function (rows) {
                            console.log("TIME after getCollaborationData: " + moment().format('YYYY-MM-DD HH:mm:ss'));
                            /*rows.map(function (e) {
                                e.collabcount = 0;
                                return e;
                            });*/
                            return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                        })
                        .then(function (rows) {
                            console.log("TIME after getCollaborationCounts: " + moment().format('YYYY-MM-DD HH:mm:ss'));
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

function loadProfileInformation(connection, requesteduuid, requesteruuid) {

    let today = moment().format('YYYY-MM-DD 00:00:00');

    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.uuid, User.firstname, User.lastname, User.bio, User.watermarkstatus, ' +
            'User.email, User.phone, Follow.followid, Follow.followee, Follow.follower, FA.featured_id, I.intname, ' +
            'CASE WHEN(FA.featurecount IS NULL) THEN 0 ELSE FA.featurecount END AS featurecount ' +
            'FROM User ' +
            'LEFT JOIN ' +
                    '(SELECT uuid, featured_id, MAX(regdate) AS last_featured_date, COUNT(featured_id) AS featurecount ' +
                    'FROM FeaturedArtists ' +
                    'WHERE uuid <> ? ' +
                    'GROUP BY uuid ' +
                    'HAVING last_featured_date >= ? ' +
                    'ORDER BY featured_score DESC ' +
                    'LIMIT 4) FA ' +
            'ON (FA.uuid = User.uuid) ' +
            'LEFT JOIN Follow ' +
            'ON (Follow.followee = User.uuid OR Follow.follower = User.uuid) ' +
            'LEFT JOIN UserInterests UI ' +
            'ON(User.uuid = UI.uuid) ' +
            'LEFT JOIN Interests I ' +
            'ON(UI.intid = I.intid) ' +
            'WHERE User.uuid = ?', [config.getCreadKalakaarUUID(), today, requesteduuid], async function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                if (rows.length === 0) {  //Case when requesteduuid is invalid (could be possible for web)
                    reject(new NotFoundError('Invalid query parameter: "requesteduuid"'));
                    return;
                }

                let topinterests = [];

                //Interests selected by the user
                let interests_arr = utils.getUniqueValues(rows.map(function (r) {
                    return r.intname
                })).filter(function (r) {
                    return !!r;
                });

                if (interests_arr[0]) {
                    topinterests.push(interests_arr[0])
                }

                if (interests_arr[1]) {
                    topinterests.push(interests_arr[1])
                }

                //People who follow the requesteduuid
                let followers = rows.filter(function (elem) {
                    return (elem.followee === requesteduuid);
                });

                //People who the requesteduuid follows
                let following = rows.filter(function (elem) {
                    return (elem.follower === requesteduuid);
                });

                let followercount = utils.getUniqueValues(followers.map(function (f) {
                    return f.followid;
                })).length;

                let followingcount = utils.getUniqueValues(following.map(function (f) {
                    return f.followid;
                })).length;

                let userdata = rows[0];

                userdata.profilepicurl = utils.createProfilePicUrl(userdata.uuid);
                userdata.featured = !!userdata.featured_id;

                try{
                    userdata.badgecount = await badgeutils.getUserBadgeCount(requesteduuid);
                }
                catch (err){
                    reject(err);
                    return;
                }

                userdata.topartist = userdata.badgecount >= consts.total_badges;

                if (userdata.hasOwnProperty('featured_id')) {
                    delete userdata.featured_id;
                }

                if (userdata.hasOwnProperty('intname')) {
                    delete userdata.intname;
                }

                //Follow status of the requester w.r.t. the requested
                userdata.followstatus = (followers.filter(function (elem) {
                    return (elem.follower === requesteruuid)
                }).length !== 0);

                userdata.followercount = followercount;
                userdata.followingcount = followingcount;
                userdata.topinterests = topinterests;
                userdata.interestcount = interests_arr.length;

                connection.query('SELECT COUNT(DISTINCT E.entityid) AS postcount, ' +
                    'COUNT(DISTINCT CASE WHEN(E.type = "SHORT") THEN SC.capid ' +
                    'WHEN(E.type = "CAPTURE") THEN CS.shoid END) AS collaborationscount, ' +
                    'COUNT(DISTINCT Cmt.commid) AS commentscount, ' +
                    'COUNT(DISTINCT H.entityid, H.uuid) AS hatsoffscount ' +
                    'FROM Entity E ' +
                    'LEFT JOIN Capture C ' +
                    'ON E.entityid = C.entityid ' +
                    'LEFT JOIN Short CS ' +
                    'ON C.capid = CS.capid ' +
                    'LEFT JOIN Short S ' +
                    'ON E.entityid = S.entityid ' +
                    'LEFT JOIN Capture SC ' +
                    'ON S.shoid = SC.shoid ' +
                    'LEFT JOIN HatsOff H ' +
                    'ON E.entityid = H.entityid  ' +
                    'LEFT JOIN Comment AS Cmt ' +
                    'ON E.entityid = Cmt.entityid ' +
                    'WHERE E.uuid = ? ' +
                    'AND E.status = "ACTIVE"', [requesteduuid], function (err, data) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        userdata.postcount = data[0].postcount; //Total posts uploaded by this user
                        userdata.commentscount = data[0].commentscount; //Total comments received by this user's posts
                        userdata.hatsoffscount = data[0].hatsoffscount; //Total hatsoffs received by this user's posts
                        userdata.collaborationscount = data[0].collaborationscount; //Total posts created by others using this user's posts

                        getShortProfileLink(requesteduuid)
                            .then(function (link) {
                                userdata.web_profile_link = link;
                                resolve(userdata);
                            })
                            .catch(function (err) {
                                reject(err);
                            });
                    }
                });
            }
        });
    });
}

function loadRepostTimeline(connection, requesteruuid, requesteduuid, lastindexkey, limit) {

    return new Promise(function (resolve, reject) {

        lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

        let sql = 'SELECT R.repostid, R.regdate, RU.uuid AS reposteruuid, RU.firstname AS repostername, ' +
            'E.caption, E.entityid, E.regdate AS postdate, E.merchantable, E.type, U.uuid, U.firstname, U.lastname, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS fbinarycount, ' +
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount ' +
            'FROM Repost R ' +
            'JOIN Entity E ' +
            'ON(E.entityid = R.entityid) ' +
            'JOIN User U ' +
            'ON (E.uuid = U.uuid) ' +
            'JOIN User RU ' +
            'ON(RU.uuid = R.uuid) ' +
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = E.entityid ' +
            'LEFT JOIN Downvote D ' +
            'ON D.entityid = E.entityid ' +
            'LEFT JOIN Follow ' +
            'ON U.uuid = Follow.followee ' +
            'WHERE R.uuid = ? ' +
            'AND E.status = "ACTIVE" ' +
            'AND R.regdate < ? ' +
            'GROUP BY R.repostid ' +
            'ORDER BY R.regdate DESC ' +
            'LIMIT ?';

        let sqlparams = [
            requesteruuid,
            requesteruuid,
            requesteruuid,
            requesteduuid,
            lastindexkey,
            limit
        ];

        feedutils.loadFeed(connection, requesteruuid, sql, sqlparams, undefined, lastindexkey, limit)
            .then(result => {
                result.items = feedutils.sortByDate(result.items, 'regdate', 'DESC');
                resolve(result);
            }, reject);
    });
}

function loadCollaborationTimeline(connection, requesteduuid, requesteruuid, limit, lastindexkey) {
    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    //TODO: Change query
    return new Promise(function (resolve, reject) {
        connection.query('SELECT firstname, lastname ' +
            'FROM User ' +
            'WHERE uuid = ?', [requesteduuid], function (err, requesteduuiddetails) {
            if (err) {
                reject(err);
            }
            else if (requesteduuiddetails.length === 0) {
                reject(new NotFoundError("Invalid 'requesteduuid'"));
            }
            else {
                connection.query('SELECT Entity.caption, Entity.entityid, Entity.regdate, Entity.merchantable, Entity.type, User.uuid, ' +
                    'CONCAT_WS(" ", User.firstname, User.lastname) AS creatorname, ' +
                    'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS fbinarycount, ' +
                    'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
                    'COUNT(CASE WHEN(D.uuid = ?) THEN 1 END) AS dbinarycount ' +
                    'FROM Entity ' +
                    'LEFT JOIN Capture ' +
                    'USING(entityid) ' +
                    'LEFT JOIN Short ' +
                    'USING(entityid) ' +
                    'JOIN User ' +
                    'ON (Entity.uuid = User.uuid) ' +
                    'LEFT JOIN HatsOff ' +
                    'ON HatsOff.entityid = Entity.entityid ' +
                    'LEFT JOIN Downvote D ' +
                    'ON D.entityid = Entity.entityid ' +
                    'LEFT JOIN Short CShort ' +
                    'ON Capture.shoid = CShort.shoid ' +
                    'LEFT JOIN Capture SCapture ' +
                    'ON Short.capid = SCapture.capid ' +
                    'LEFT JOIN Follow ' +
                    'ON User.uuid = Follow.followee ' +
                    'WHERE (SCapture.uuid = ? OR CShort.uuid = ?) ' +
                    'AND User.uuid <> ? ' +
                    'AND Entity.status = "ACTIVE" ' +
                    'AND Entity.regdate < ? ' +
                    'GROUP BY Entity.entityid ' +
                    'ORDER BY Entity.regdate DESC ' +
                    'LIMIT ? ', [requesteruuid, requesteruuid, requesteruuid, requesteduuid, requesteduuid, requesteduuid, lastindexkey, limit], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {

                        let feedEntities = rows.map(function (elem) {
                            return elem.entityid;
                        });

                        if (rows.length > 0) {
                            rows.map(function (element) {

                                element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                                element.followstatus = element.fbinarycount > 0;
                                element.hatsoffstatus = element.hbinarycount > 0;
                                element.downvotestatus = element.dbinarycount > 0;
                                element.merchantable = (element.merchantable !== 0);
                                element.long_form = (element.long_form === 1);

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

                            let candownvote;

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
                                    return getUserQualityPercentile(connection, requesteruuid);
                                })
                                .then(function (result) {
                                    candownvote = result.quality_percentile_score >= consts.min_percentile_quality_user_downvote;
                                    return feedutils.getCollaborationData(connection, rows);
                                })
                                .then(function (rows) {
                                    console.log("TIME after getCollaborationData: " + moment().format('YYYY-MM-DD HH:mm:ss'));
                                    return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                                })
                                .then(function (rows) {
                                    resolve({
                                        requestmore: rows.length >= limit,
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
                                lastindexkey: "",
                                items: []
                            });
                        }
                    }
                });
            }
        });
    });
}

function updateProfile(connection, uuid, details) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE User SET ? WHERE uuid = ?', [details, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function loadFacebookFriends(connection, uuid, fbid, fbaccesstoken, nexturl) {
    return new Promise(function (resolve, reject) {

        let graphurl = (nexturl) ? nexturl : 'https://graph.facebook.com/v2.10/'
            + fbid
            + '/'
            + 'friends'
            + '?'
            + 'access_token='
            + fbaccesstoken;

        requestclient(graphurl, function (error, res, body) {

            if (error) {
                reject(error);
            }
            else if (JSON.parse(body).error) {
                reject(JSON.parse(body).error);
            }
            else {
                console.log("body-response " + JSON.stringify(JSON.parse(body), null, 3));
                let response = JSON.parse(body);

                let friendsids = response.data.map(function (element) {
                    return element.id;
                });

                let result = {};

                if (friendsids.length === 0) {    //Case of no data
                    result.nexturl = null;
                    result.requestmore = false;
                    result.friends = response.data;
                    resolve(result);
                }
                else {
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

                            console.log("rows from User LEFT JOIN Follow query is " + JSON.stringify(rows, null, 3));

                            result.nexturl = (response.paging.next) ? response.paging.next : null;
                            result.requestmore = !!response.paging.next;

                            rows.map(function (elem) {
                                elem.profilepicurl = utils.createSmallProfilePicUrl(elem.uuid);
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

/**
 * A recursive implementation of loadFacebookFriends() that returns uuids of all the Facebook friends of the user who
 * have installed the app
 * */
function loadAllFacebookFriends(connection, uuid, fbid, fbaccesstoken, nexturl) {
    return new Promise(function (resolve, reject) {

        let friends = [];

        function recursive(nexturl) {
            loadFacebookFriends(connection, uuid, fbid, fbaccesstoken, nexturl)
                .then(function (result) {

                    //To collate only those users who have not been followed
                    friends = friends.concat(result.friends.filter(function (elem) {
                        return !elem.followstatus;
                    }));

                    if (result.requestmore) {
                        recursive(result.nexturl);
                    }
                    else {
                        console.log("result.requestmore is false");
                        resolve(friends.map(function (element) {
                            return element.uuid;
                        }));
                    }
                })
                .catch(function (err) {
                    reject(err);
                })
        }

        recursive(nexturl);
    });
}

/**
 * This function checks if the given fbid is attached to a user's record other than the given uuid
 * */
function checkIfFbIdAttachedToAnother(connection, fbid, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT uuid FROM User WHERE fbid = ? AND uuid <> ?', [fbid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(!!rows[0])
            }
        });
    });
}

function saveFbIdUser(connection, fbid, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE User SET fbid = ? WHERE fbid IS NULL AND uuid = ?', [fbid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function getFbAppAccessToken() {
    return new Promise(function (resolve, reject) {

        let graphurl = 'https://graph.facebook.com/v2.10/'
            + 'oauth/access_token?client_id='
            + config['cread-fb-app-id']
            + '&client_secret='
            + config['cread-fb-app-secret']
            + '&grant_type=client_credentials';

        requestclient(graphurl, function (error, res, body) {

            if (error) {
                reject(error);
            }
            else if (JSON.parse(body).error) {
                reject(JSON.parse(body).error);
            }
            else {
                console.log("body-response " + JSON.stringify(JSON.parse(body), null, 3));
                let response = JSON.parse(body);

                resolve(response.access_token);
            }
        });
    });
}

function getUserFbFriendsViaAppToken(connection, user_fbid, uuid) {
    return new Promise(function (resolve, reject) {
        getFbAppAccessToken()
            .then(function (fb_app_access_token) {
                return loadAllFacebookFriends(connection, uuid, user_fbid, fb_app_access_token);
            })
            .then(function (fuuids) {
                resolve(fuuids);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

/**
 * npm package multer uploads an image to the server with a randomly generated guid without an extension. Hence,
 * the uploaded file needs to be renamed
 * */
function renameFile(filebasepath, file, guid) {
    console.log("renameFile() called");
    return new Promise(function (resolve, reject) {
        console.log('file path is ' + file.path);
        fs.rename(file.path, /*'./images/uploads/profile_picture/'*/filebasepath + guid + '.jpg', function (err) {
            if (err) {
                console.log("fs.rename: onReject()");
                reject(err);
            }
            else {
                resolve(filebasepath + guid + '.jpg');
            }
        });
    });
}

function createSmallImage(readingpath, writingbasepath, guid, height, width) {
    console.log("createSmallImage() called readingpath " + readingpath);
    return new Promise(function (resolve, reject) {
        jimp.read(readingpath, function (err, resized) {
            if (err) {
                reject(err);
            }
            else {
                resized.resize(width, height)            // resize
                    .quality(80)                    // set JPEG quality
                    .write(/*"./images/uploads/profile_picture/"*/writingbasepath + guid + "-small.jpg", function (err) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(/*"./images/uploads/profile_picture/"*/writingbasepath + guid + "-small.jpg");
                        }
                    });    // save
            }
        });
    });
}

function uploadImageToS3(sourcefilepath, uuid, type, destfilename /* ,filekey*/) {
    console.log("uploadImageToS3() called file.path " + sourcefilepath);
    return new Promise(function (resolve, reject) {
        let params = {
            Body: fs.createReadStream(sourcefilepath),
            Bucket: s3bucket,
            Key: "Users/" + uuid + "/" + type + "/" + destfilename,
            ACL: "public-read"
        };

        let s3 = new AWS.S3();
        s3.putObject(params, function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/**
 * Method to copy Facebook or Google's profile picture to S3
 * */
function copySocialMediaProfilePic(picurl, uuid) {
    let downloadpath;
    return new Promise(function (resolve, reject) {
        utils.downloadFile('./images/downloads/profilepic', uuid + '.jpg', picurl)
            .then(function (downldpath) {
                downloadpath = downldpath;

                console.log("downldpath is " + JSON.stringify(downldpath, null, 3));

                let imagedimensions = imagesize(downloadpath);

                if (imagedimensions.width > 500) {    //To resize
                    return createSmallProfilePic(downloadpath, uuid, 128, 128);
                }
                else {   //Not to resize
                    return new Promise(function (resolve, reject) {
                        resolve(downloadpath);
                    });
                }
            })
            .then(function (smallpicpath) {
                return uploadImageToS3(smallpicpath, uuid, 'Profile', 'display-pic-small.jpg');
            })
            .then(function () {
                return uploadImageToS3(downloadpath, uuid, 'Profile', 'display-pic.jpg');
            })
            .then(function () {
                resolve(uuid);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

function createSmallProfilePic(renamedpath, uuid, height, width) {

    console.log("createSmallProfilePic() called renamedpath " + renamedpath);
    let writepath = "./images/uploads/profile_picture/" + uuid + "-small.jpg";

    return new Promise(function (resolve, reject) {
        jimp.read(renamedpath, function (err, resized) {
            if (err) {
                reject(err);
            }
            else {
                resized.resize(height, width)            // resize
                    .quality(80)                    // set JPEG quality
                    .write(writepath, function (err) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(writepath);
                        }
                    });    // save
            }
        });
    })
}

function getUserQualityPercentile(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT quality_percentile_score ' +
            'FROM UserAnalytics ' +
            'WHERE uuid = ?', [uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if (!rows[0]) {
                    rows[0] = {
                        quality_percentile_score: 0
                    }
                }
                resolve(rows[0]);
            }
        });
    });
}

/**
 * Value is converted from as an array of URLs to a comma separated value of encoded URLs
 * */
function flattenPostsArrFrCache(posts) {
    posts = posts.map(function (post) {
        return encodeURIComponent(post);
    });

    return posts.join(",");
}

/**
 * Value is parsed from a comma separated value of encoded URLs to an array
 * */
function parseLatestPostsCacheValue(posts) {
    posts = posts.split(",");
    posts = posts.map(function (post) {
        return decodeURIComponent(post);
    });
    return posts;
}

function addToLatestPostsCache(connection, uuid, entityurl) {
    return new Promise(function (resolve, reject) {
        let posts;
        getUserQualityPercentile(connection, uuid)
            .then(function (result) {
                if (result.quality_percentile_score >= consts.min_qpercentile_user_recommendation) {
                    return cache_manager.getCacheHMapValue(REDIS_KEYS.USER_LATEST_POSTS, uuid);
                }
                else {
                    return new Promise(function (resolve, reject) {
                        resolve();
                    });
                }
            })
            .then(function (result) {
                if (result) {
                    posts = parseLatestPostsCacheValue(result);
                }
                else {
                    posts = [];
                }

                posts.unshift(entityurl);

                if (posts.length > 7) {
                    posts.pop();
                }

                return new Promise(function (resolve, reject) {
                    resolve(flattenPostsArrFrCache(posts));
                });
            })
            .then(function (result) {

                let lp_hmap = {};
                lp_hmap[uuid] = result;

                return cache_manager.setCacheHMap(REDIS_KEYS.USER_LATEST_POSTS, lp_hmap);
            })
            .then(resolve, reject);

    });
}

function getLatestPostsOfUser(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT E.type, S.shoid, C.capid, U.uuid ' +
            'FROM Entity E ' +
            'LEFT JOIN Short S ' +
            'USING(entityid) ' +
            'LEFT JOIN Capture C ' +
            'USING(entityid) ' +
            'JOIN User U ' +
            'ON(U.uuid = S.uuid OR U.uuid = C.uuid) ' +
            'WHERE U.uuid = ? ' +
            'AND E.status = "ACTIVE" ' +
            'AND E.type <> "MEME" ' +
            'GROUP BY E.entityid ' +
            'ORDER BY E.regdate DESC ' +
            'LIMIT 7', [uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                let posts = [];

                rows.map(function (element) {
                    if (element.type === post_type.SHORT) {
                        posts.push(utils.createSmallShortUrl(uuid, element.shoid));
                    }
                    else if(element.type === post_type.CAPTURE){
                        posts.push(utils.createSmallCaptureUrl(uuid, element.capid));
                    }
                });

                resolve(posts);
            }
        });
    });
}

function updateLatestPostsCache(connection, uuid) {
    return new Promise(function (resolve, reject) {
        getUserQualityPercentile(connection, uuid)
            .then(function (result) {
                if (result.quality_percentile_score < consts.min_qpercentile_user_recommendation) {
                    resolve([]);
                }
                else {
                    let posts;
                    getLatestPostsOfUser(connection, uuid)
                        .then(function (psts) {
                            posts = psts;
                            if (posts.length > 0) {
                                var lp_hmap = {};
                                lp_hmap[uuid] = flattenPostsArrFrCache(posts);
                                return cache_manager.setCacheHMap(REDIS_KEYS.USER_LATEST_POSTS, lp_hmap);
                            }
                            else {
                                //TODO: Add code to delete cache key if it exists
                                return new Promise(function (resolve, reject) {
                                    resolve(posts);
                                });
                            }
                        })
                        .then(function () {
                            resolve(posts);
                        }, reject);
                }
            });
    });
}

function getLatestPostsCache(uuids) {
    return new Promise(function (resolve, reject) {
        cache_manager.getCacheHMapMultiple(cache_utils.REDIS_KEYS.USER_LATEST_POSTS, uuids)
            .then(function (stringified_posts) {
                if (stringified_posts) {
                    let res = {};
                    for (let i = 0; i < stringified_posts.length; i++) {
                        let stringified_post = stringified_posts[i];
                        if (stringified_post) {
                            res[uuids[i]] = parseLatestPostsCacheValue(stringified_post);
                        }
                        else {
                            res[uuids[i]] = [];
                        }
                    }
                    resolve(res);
                }
                else {
                    resolve();
                }
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

function getShortProfileLinkCache(uuid) {
    return new Promise(function (resolve, reject) {
        cache_manager.getCacheString(cache_utils.getProfileLinkCacheKey(uuid))
            .then(function (link) {
                resolve(link);
            })
            .catch(function (err) {
                reject(err);
            })
    });
}

function updateShortProfileLinkCache(uuid, link) {
    return new Promise(function (resolve, reject) {
        if(!uuid){
            resolve(new Error('uuid cannot be null/empty/undefined to store user profile link in cache'));
        }
        else{
            cache_manager.setCacheString(cache_utils.getProfileLinkCacheKey(uuid), link)
                .then(function () {
                    resolve();
                })
                .catch(function (err) {
                    reject(err);
                });
        }
    });
}

function getShortProfileLink(uuid) {
    return new Promise(function (resolve, reject) {
        getShortProfileLinkCache(uuid)
            .then(function (link) {
                if(link){
                    console.log('profile link fetched from cache');
                    resolve(link);
                    throw new BreakPromiseChainError();
                }
                else{
                    return utils.getShortBitlyLink(utils.getProfileWebstoreLink(uuid))
                }
            })
            .then(function (link) {
                resolve(link);
                updateShortProfileLinkCache(uuid, link);
            })
            .catch(function (err) {
                if(err instanceof BreakPromiseChainError){
                    //Do nothing
                }
                else{
                    console.error(err);
                    reject(err);
                }
            });
    });
}

function checkIfPostedAfterGap(connection, uuid, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT entityid ' +
            'FROM Entity ' +
            'WHERE status = "ACTIVE" ' +
            'AND uuid = ? ' +
            'AND entityid <> ? ' +
            'AND regdate > DATE_SUB(NOW(), INTERVAL 5 DAY)', [uuid, entityid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(!rows[0]);
            }
        });
    });
}

function getAllUsersExcept(connection, uuids) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT uuid FROM User WHERE uuid NOT IN (?)', [uuids], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows.map(function (row) {
                    return row.uuid;
                }));
            }
        });
    });
}

module.exports = {
    loadTimelineLegacy: loadTimelineLegacy,
    loadTimeline: loadTimeline,
    loadRepostTimeline: loadRepostTimeline,
    loadCollaborationTimeline: loadCollaborationTimeline,
    loadProfileInformation: loadProfileInformation,
    loadFacebookFriends: loadFacebookFriends,
    loadAllFacebookFriends: loadAllFacebookFriends,
    checkIfFbIdAttachedToAnother: checkIfFbIdAttachedToAnother,
    saveFbIdUser: saveFbIdUser,
    getUserFbFriendsViaAppToken: getUserFbFriendsViaAppToken,
    updateProfile: updateProfile,
    renameFile: renameFile,
    createSmallImage: createSmallImage,
    uploadImageToS3: uploadImageToS3,
    getAllUsersExcept: getAllUsersExcept,
    copySocialMediaProfilePic: copySocialMediaProfilePic,
    createSmallProfilePic: createSmallProfilePic,
    getUserQualityPercentile: getUserQualityPercentile,
    getLatestPostsCache: getLatestPostsCache,
    addToLatestPostsCache: addToLatestPostsCache,
    updateLatestPostsCache: updateLatestPostsCache,
    getShortProfileLink: getShortProfileLink,
    checkIfPostedAfterGap: checkIfPostedAfterGap
};