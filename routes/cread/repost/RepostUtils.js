/**
 * Created by avnee on 20-07-2018.
 */
'use-strict';

var uuidGen = require('uuid');
var async = require('async');

var updatesutils = require('../updates/UpdatesUtils');
var cacheutils = require('../utils/cache/CacheUtils');
var cachemanager = require('../utils/cache/CacheManager');

/**
 * Function to add a repost
 * */
function addRepost(connection, entityid, uuid) {
    return new Promise(function (resolve, reject) {
        var params = {
            repostid: uuidGen.v4(),
            entityid: entityid,
            uuid: uuid
        };

        connection.query('INSERT INTO Repost SET ?', [params], function (err, rows) {
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
 * Function to delete a repost
 * */
function deleteRepost(connection, repostid, uuid) {
    return new Promise(function (resolve, reject) {
        //For precaution, both 'repostid' and 'uuid' are used here so that any potential error on the app where a user
        //sends another user's 'repostid' for a delete request, the comment shouldn't get deleted
        connection.query('DELETE FROM Repost WHERE repostid = ? AND uuid = ?', [repostid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function updateRepostDataForUpdates(connection, uuid, actor_uuid, entityid, category, other_collaborator) {
    return new Promise(function (resolve, reject) {
        if (true) {   //Case: Reposted TODO: Change condition during deletion from Updates table
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
        else {   //Case: Repost deleted TODO: Find a mechanism to locate a particular comment's row in Updates table
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
                "repost"
            ];
            return updatesutils.deleteFromUpdatesTable(connection, where_col_names, where_col_values);*/
            resolve();
        }
    });
}

function getEntityFromRepost(connection, repostid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT entityid ' +
            'FROM Repost ' +
            'WHERE repostid = ?', [repostid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows[0]);
            }
        });
    });
}

function getAllRepostCounts(connection, entities) {

    var entityids = entities.map(function (e) {
        return e.entityid;
    });

    return new Promise(function (resolve, reject) {
        connection.query('SELECT E.entityid, COUNT(R.repostid) AS repostcount ' +
            'FROM Entity E ' +
            'LEFT JOIN Repost R ' +
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
 * @param entities Entities whose reposts counts are to be cached. Should be of the structure: [{entityid: *string*, repostcount: *number*}]
 * */
function updateRepostCountsCache(entities) {
    return new Promise(function (resolve, reject) {
        async.each(entities, function (entity, callback) {

            var ent_rpstcnt_cache_key = cacheutils.getEntityRepostCntCacheKey(entity.entityid);

            if (typeof entity.repostcount !== "number") {
                callback(new Error("Value to store for reposts count in cache should be a number"));
            }
            else {
                cachemanager.setCacheString(ent_rpstcnt_cache_key, String(entity.repostcount))
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
 * @param connection SQL session connection to execute query
 * @param entities Entities whose comments counts are to be cached. Should be of the structure: [{entityid: *string*}]
 * */
function updateRepostCountCacheFromDB(connection, entities) {
    return new Promise(function (resolve, reject) {
        getAllRepostCounts(connection, entities)
            .then(function (rows) {
                return updateRepostCountsCache(rows);
            })
            .then(resolve, reject);
    });
}

module.exports = {
    addRepost: addRepost,
    deleteRepost: deleteRepost,
    getEntityFromRepost: getEntityFromRepost,
    updateRepostDataForUpdates: updateRepostDataForUpdates,
    updateRepostCountCacheFromDB: updateRepostCountCacheFromDB
};