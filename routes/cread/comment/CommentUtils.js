/**
 * Created by avnee on 25-09-2017.
 */
'use-strict';

var uuidGen = require('uuid');
var moment = require('moment');
var async = require('async');

var config = require('../../Config');
var utils = require('../utils/Utils');
var entityutils = require('../entity/EntityUtils');
var updatesutils = require('../updates/UpdatesUtils');
var cacheutils = require('../utils/cache/CacheUtils');
var cachemanager = require('../utils/cache/CacheManager');
var hatsoffutils = require('../hats-off/HatsOffUtils');
let badgeutils = require('../badges/BadgeUtils');

var jobqueuehandler = require('../utils/long-tasks/JobQueueHandler');
var notify = require('../../notification-system/notificationFramework');
var REDIS_KEYS = cacheutils.REDIS_KEYS;

var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

function loadCommentsLegacy(connection, entityid, limit, page, loadAll) {
    var query = 'SELECT User.firstname, User.lastname, User.uuid, Comment.edited, Comment.commid, Comment.txt AS comment ' +
        'FROM User ' +
        'JOIN Comment ' +
        'ON User.uuid = Comment.uuid ' +
        'WHERE Comment.entityid = ? ' +
        'ORDER BY Comment.regdate DESC ' +
        'LIMIT ? ' +
        'OFFSET ?';

    var offset;

    if (!loadAll) {   //Case where only top comments are loaded
        offset = 0;
        limit = 3;
    }
    else {   //Case where all comments are loaded
        offset = page * limit;
    }

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Comment ' +
            'WHERE entityid = ?', [entityid], function (err, data) {

            if (err) {
                reject(err);
            }
            else {
                var totalcount = data[0].totalcount;

                connection.query(query, [entityid, limit, offset], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        rows.map(function (element) {
                            element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                            element.edited = (element.edited === 1);
                            return element;
                        });

                        var result = {};
                        result.comments = rows;

                        if (loadAll) {
                            result.requestmore = totalcount > (offset + limit);
                        }

                        resolve(result);
                    }
                });
            }
        });
    });
}

function loadComments(connection, entityid, limit, lastindexkey, loadAll) {

    if (!loadAll) {   //Case where only top comments are loaded
        lastindexkey = moment().format('YYYY-MM-DD HH:mm:ss');
        limit = 3;
    }
    else {   //Case where all comments are loaded
        lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp
    }

    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.firstname, User.lastname, User.uuid, Comment.edited, Comment.commid, ' +
            'Comment.txt AS comment, Comment.regdate ' +
            'FROM User ' +
            'JOIN Comment ' +
            'ON User.uuid = Comment.uuid ' +
            'WHERE Comment.entityid = ? ' +
            'AND Comment.regdate < ? ' +
            'ORDER BY Comment.regdate DESC ' +
            'LIMIT ? '/* +
            'OFFSET ?'*/, [entityid, lastindexkey, limit/*, offset*/], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                try{
                    rows.map(async function (element) {
                        element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                        element.topartist = await badgeutils.isTopArtist(element.uuid);
                        element.edited = (element.edited === 1);
                        return element;
                    });
                }
                catch (err){
                    reject(err);
                    return;
                }

                //Sort comments in chronological order
                rows.sort(function (a, b) {
                    if (a.regdate < b.regdate) {
                        return -1;
                    }
                    else {
                        return 1;
                    }
                });

                var result = {};
                result.comments = rows;

                if (loadAll) {
                    if (rows.length > 0) {
                        result.requestmore = rows.length >= limit;
                        result.lastindexkey = moment.utc(rows[0/*rows.length - 1*/].regdate).format('YYYY-MM-DD HH:mm:ss');
                    }
                    else {
                        result.requestmore = rows.length >= limit;
                        result.lastindexkey = ""
                    }
                }

                resolve(result);
            }
        });
    });
}

function addComment(connection, entityid, comment, uuid) {
    return new Promise(function (resolve, reject) {
        var params = {
            commid: uuidGen.v4(),
            entityid: entityid,
            txt: comment,
            uuid: uuid
        };

        connection.query('INSERT INTO Comment SET ?', [params], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(params.commid);
            }
        });
    });
}

function updateComment(connection, commid, uuid, comment) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Comment SET txt = ?, edited = ? ' +
            'WHERE commid = ? ' +
            'AND uuid = ?', [comment, true, commid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function deleteComment(connection, commid, uuid) {
    return new Promise(function (resolve, reject) {
        //For precaution, both 'commid' and 'uuid' are used here so that any potential error on the app where a user
        //sends another user's 'commid' for a delete request, the comment shouldn't get deleted
        connection.query('DELETE FROM Comment WHERE commid = ? AND uuid = ?', [commid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function getEntityFromComment(connection, commid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT entityid ' +
            'FROM Comment ' +
            'WHERE commid = ?', [commid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows[0]);
            }
        });
    });
}

function updateCommentDataForUpdates(connection, uuid, actor_uuid, entityid, category, other_collaborator) {
    return new Promise(function (resolve, reject) {
        if (true) {   //Case: Comment added TODO: Change condition during deletion from Updates table
            var updateparams = {
                uuid: uuid,
                actor_uuid: actor_uuid,
                entityid: entityid,
                other_collaborator: other_collaborator,
                category: category
            };
            updatesutils.addToUpdatesTable(connection, updateparams)
                .then(resolve, reject);
        }
        else {   //Case: Comment deleted TODO: Find a mechanism to locate a particular comment's row in Updates table
            /*var where_col_names = [
                "actor_uuid",
                "entityid",
                "other_collaborator",
                "category"
            ];
            var where_col_values = [
                actor_uuid,
                entityid,
                other_collaborator,
                "comment"
            ];
            return updatesutils.deleteFromUpdatesTable(connection, where_col_names, where_col_values);*/
            resolve();
        }
    });
}

function getAllCommentCounts(connection, entities) {

    var entityids = entities.map(function (e) {
        return e.entityid;
    });

    return new Promise(function (resolve, reject) {
        connection.query('SELECT E.entityid, COUNT(Cmt.commid) AS commentcount ' +
            'FROM Entity E ' +
            'LEFT JOIN Comment Cmt ' +
            'USING(entityid) ' +
            'WHERE E.entityid IN (?) ' +
            'GROUP BY E.entityid', [entityids], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

/**
 * Function to schedule a Kue Job to add a comment on behalf of Cread Kalakaar if it is a first post
 *
 * @param uuid ID of the post creator
 * @param name First name of the post creator
 * @param entityid ID of the post
 * */
function scheduleFirstPostCommentJob(uuid, name, entityid) {
    var jData = {
        uuid: uuid, //Creator uuid
        name: name, //Creator name
        entityid: entityid  //Post id
    };

    jobqueuehandler.scheduleJob(REDIS_KEYS.KUE_CK_FIRST_CMNT_HTSOFF, jData, {
        delay: 9 * 60 * 1000,
        removeOnComplete: true
    });
}

/**
 * Function to process the scheduled job for comment by CK on a user's first post
 * */
(function () {
    var connection;

    jobqueuehandler.processJob(REDIS_KEYS.KUE_CK_FIRST_CMNT_HTSOFF, function (jobData) {
        config.getNewConnection()
            .then(function (conn) {
                connection = conn;
                return entityutils.isEntityActive(connection, jobData.entityid);
            })
            .then(function (isPostActive) {
                if(isPostActive){
                    return utils.beginTransaction(connection);
                }
                else {
                    console.log("Post deleted. First Comment from CK rollbacked");
                    throw new BreakPromiseChainError();
                }
            })
            .then(function () {
                return entityutils.updateLastEventTimestamp(connection, jobData.entityid, jobData.uuid);
            })
            .then(function () {
                return hatsoffutils.registerHatsOff(connection, true, config.getCreadKalakaarUUID(), jobData.entityid);
            })
            .then(function () {
                return addComment(connection, jobData.entityid, utils.getRandomFirstPostComment(jobData.name), config.getCreadKalakaarUUID());
            })
            .then(function () {
                return utils.commitTransaction(connection);
            }, function (err) {
                return utils.rollbackTransaction(connection, undefined, err)
            })
            .then(function () {
                return updateCommentDataForUpdates(connection, jobData.uuid, config.getCreadKalakaarUUID(), jobData.entityid, "comment", false);
            })
            .then(function () {   //Send a notification to the creator of this post
                var notifData = {
                    message: "Cread Kalakaar has commented on your post",
                    category: "comment",
                    entityid: jobData.entityid,
                    persistable: "Yes",
                    other_collaborator: false,
                    actorimage: utils.createSmallProfilePicUrl(config.getCreadKalakaarUUID())
                };
                return notify.notificationPromise(new Array(jobData.uuid), notifData);
            })
            .then(function () {
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                config.disconnect(connection);
                if(err instanceof BreakPromiseChainError){
                    //Do nothing
                }
                else{
                    console.error(err);
                }
            });
    });

})();

/**
 * @param connection SQL session connection to execute query
 * @param entities Entities whose comments counts are to be cached. Should be of the structure: [{entityid: *string*}]
 * */
function updateCommentCountCacheFromDB(connection, entities) {
    return new Promise(function (resolve, reject) {
        getAllCommentCounts(connection, entities)
            .then(function (rows) {
                return updateCommentCountsCache(rows);
            })
            .then(resolve, reject);
    });
}

/**
 * @param entities Entities whose comments counts are to be cached. Should be of the structure: [{entityid: *string*, commentcount: *number*}]
 * */
function updateCommentCountsCache(entities) {
    return new Promise(function (resolve, reject) {
        async.each(entities, function (entity, callback) {

            var ent_cmtcnt_cache_key = cacheutils.getEntityCommentCntCacheKey(entity.entityid);

            if (typeof entity.commentcount !== "number") {
                callback(new Error("Value to store for comments count in cache should be a number"));
            }
            else {
                cachemanager.setCacheString(ent_cmtcnt_cache_key, String(entity.commentcount))
                    .then(function () {
                        callback();
                    })
                    .catch(function (err) {
                        callback(err);
                    });
            }

        }, function (err) {
            if (err) {
                console.error(err);
                reject(err);
            }
            else {
                resolve();
            }
        });

    });
}

/**
 * @param entities Entities whose comments counts are to be fetched from cache. Should be of the structure: [{entityid: *string*}]
 * */
function getAllCommentCountsCache(entities) {
    return new Promise(function (resolve, reject) {
        async.eachOf(entities, function (entity, index, callback) {

            var ent_cmtcnt_cache_key = cacheutils.getEntityCommentCntCacheKey(entity.entityid);

            cachemanager.getCacheString(ent_cmtcnt_cache_key)
                .then(function (commentcount) {
                    entities[index].commentcount = (!commentcount || commentcount === "null" || commentcount === "undefined") ? null : Number(commentcount);

                    (commentcount === "null" || commentcount === "undefined") ? console.log('Incorrect values are being stored in cache for comments count') : //Do nothig;

                        callback();
                })
                .catch(function (err) {
                    callback(err);
                });

        }, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve(entities);
            }
        });
    });
}

function loadCommentCountsFast(connection, master_rows) {
    return new Promise(function (resolve, reject) {
        getAllCommentCountsCache(master_rows)
            .then(function (rows) {

                master_rows = rows;

                var entities_no_commentcnt = master_rows.filter(function (r) {
                    return r.commentcount === null;
                });

                if (entities_no_commentcnt.length > 0) {
                    return getAllCommentCounts(connection, entities_no_commentcnt);
                }
                else {
                    resolve(master_rows);
                    throw new BreakPromiseChainError();
                }
            })
            .then(function (rows) {

                var master_entityids = master_rows.map(function (mr) {
                    return mr.entityid;
                });

                rows.forEach(function (r) {

                    utils.getAllIndexes(master_entityids, r.entityid).forEach(function (i) {
                        master_rows[i].commentcount = r.commentcount;
                    });

                    // master_rows[master_entityids.indexOf(r.entityid)].commentcount = r.commentcount;
                });

                resolve(master_rows);
                updateCommentCountsCache(rows);
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                if (err instanceof BreakPromiseChainError) {
                    //Do nothing
                }
                else {
                    reject(err);
                }
            });
    });
}

module.exports = {
    loadCommentsLegacy: loadCommentsLegacy,
    loadComments: loadComments,
    addComment: addComment,
    updateComment: updateComment,
    deleteComment: deleteComment,
    getEntityFromComment: getEntityFromComment,
    updateCommentDataForUpdates: updateCommentDataForUpdates,
    loadCommentCountsFast: loadCommentCountsFast,
    updateCommentCountCacheFromDB: updateCommentCountCacheFromDB,
    scheduleFirstPostCommentJob: scheduleFirstPostCommentJob
};