/**
 * Created by avnee on 12-10-2017.
 */

/**
 * Handles functionalities regarding hats-off system
 * */
'use-strict';

var uuidGenerator = require('uuid');
var utils = require('../utils/Utils');
var updatesutils = require('../updates/UpdatesUtils');
let badgeutils = require('../badges/BadgeUtils');
var cacheutils = require('../utils/cache/CacheUtils');
var cachemanager = require('../utils/cache/CacheManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var moment = require('moment');
var async = require('async');

function registerHatsOff(connection, register, uuid, entityid) {

    var sqlquery;
    var sqlparams;

    if(register){
        sqlquery = 'INSERT IGNORE INTO HatsOff SET ?';
        sqlparams = {
            hoid: uuidGenerator.v4(),
            uuid: uuid,
            entityid: entityid
        }
    }
    else{
        sqlquery = 'DELETE FROM HatsOff WHERE uuid = ? AND entityid = ?';
        sqlparams = [
            uuid,
            entityid
        ]
    }

    return new Promise(function (resolve, reject) {
        connection.query(sqlquery, sqlparams, function (err, rows) {
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
 * Returns a campaign's hatsoffs with pagination system
 * */
function loadHatsOffsLegacy(connection, entityid, limit, page) {

    console.log("limit and page is " + JSON.stringify(limit + " " + page, null, 3));

    var offset = page * limit;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM HatsOff ' +
            'WHERE entityid = ? ', [entityid], function(err, data){
            if(err){
                reject(err);
            }
            else{

                console.log("totalcount is " + JSON.stringify(data[0].totalcount, null, 3));
                var totalcount = data[0].totalcount;

                connection.query('SELECT User.firstname, User.lastname, User.uuid ' +
                    'FROM HatsOff ' +
                    'JOIN User ' +
                    'ON HatsOff.uuid = User.uuid ' +
                    'WHERE HatsOff.entityid = ? ' +
                    'ORDER BY HatsOff.regdate DESC ' +
                    'LIMIT ? ' +
                    'OFFSET ?', [entityid, limit, offset], function (err, rows) {

                    if(err){
                        reject(err);
                    }
                    else{

                        rows = rows.map(function (element) {
                            element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                            return element;
                        });

                        resolve({
                            hatsoffs: rows,
                            requestmore: totalcount > (offset + limit)
                        });
                    }

                });
            }
        });
    });
}

function loadHatsOffs(connection, entityid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT HatsOff.regdate, User.firstname, User.lastname, User.uuid ' +
            'FROM HatsOff ' +
            'JOIN User ' +
            'ON HatsOff.uuid = User.uuid ' +
            'WHERE HatsOff.entityid = ? ' +
            'AND HatsOff.regdate < ? ' +
            'GROUP BY HatsOff.entityid, HatsOff.uuid ' +
            'ORDER BY HatsOff.regdate DESC ' +
            'LIMIT ? '/* +
             'OFFSET ?'*/, [entityid, lastindexkey, limit/*, offset*/], async function (err, rows) {

            if(err){
                reject(err);
            }
            else{

                if(rows.length > 0){

                    try{
                        rows = await Promise.all(rows.map(async function (element) {
                            element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                            element.topartist = await badgeutils.isTopArtist(element.uuid);
                            return element;
                        }));
                    }
                    catch (err){
                        reject(err);
                        return;
                    }

                    resolve({
                        hatsoffs: rows,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        requestmore: rows.length >= limit
                    });
                }
                else{
                    resolve({
                        hatsoffs: rows,
                        lastindexkey: null,
                        requestmore: rows.length >= limit
                    });
                }
            }

        });
    });
}

function updateHatsOffDataForUpdates(connection, register, uuid, actor_uuid, entityid, other_collaborator){
    return new Promise(function (resolve, reject) {
        if(register){   //Case: Hatsoff given
            var updateparams = {
                uuid: uuid,
                actor_uuid: actor_uuid,
                entityid: entityid,
                other_collaborator: other_collaborator,
                category: "hatsoff"
            };
            updatesutils.addToUpdatesTable(connection, updateparams)
                .then(resolve)
                .catch(function (err) {
                    reject(err);
                });
        }
        else{   //Case: Hatsoff reverted
            var where_col_names = [
                "actor_uuid",
                "entityid",
                "other_collaborator",
                "category"
            ];
            var where_col_values = [
                actor_uuid,
                entityid,
                other_collaborator,
                "hatsoff"
            ];
            updatesutils.deleteFromUpdatesTable(connection, where_col_names, where_col_values)
                .then(resolve)
                .catch(function (err) {
                    reject(err);
                });
        }
    });
}

function getAllHatsoffCounts(connection, entities) {

    var entityids = entities.map(function (e) {
        return e.entityid;
    });

    return new Promise(function (resolve, reject) {
        connection.query('SELECT E.entityid, COUNT(H.hoid) AS hatsoffcount ' +
            'FROM Entity E ' +
            'LEFT JOIN HatsOff H ' +
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
 * @param connection SQL session connection to execute query
 * @param entities Entities whose comments counts are to be cached. Should be of the structure: [{entityid: *string*}]
 * */
function updateHatsoffCountCacheFromDB(connection, entities) {
    return new Promise(function (resolve, reject) {
        getAllHatsoffCounts(connection, entities)
            .then(function (rows) {
                return updateHatsoffCountsCache(rows);
            })
            .then(resolve, reject);
    });
}

/**
 * @param entities Entities whose hastoff counts are to be cached. Should be of the structure: [{entityid: *string*, hatsoffcount: *number*}]
 * */
function updateHatsoffCountsCache(entities) {
    return new Promise(function (resolve, reject) {
        async.each(entities, function (entity, callback) {

            var ent_htsoffcnt_cache_key = cacheutils.getEntityHtsoffCntCacheKey(entity.entityid);

            if (typeof entity.hatsoffcount !== "number") {
                callback(new Error("Value to store for hatsoffcount in cache should be a number"));
            }
            else {
                cachemanager.setCacheString(ent_htsoffcnt_cache_key, String(entity.hatsoffcount))
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
 * @param entities Entities whose hatsoff counts are to be fetched from cache. Should be of the structure: [{entityid: *string*}]
 * */
function getAllHatsoffCountsCache(entities) {
    return new Promise(function (resolve, reject) {
        async.eachOf(entities, function (entity, index, callback) {

            var ent_htsoffcnt_cache_key = cacheutils.getEntityHtsoffCntCacheKey(entity.entityid);

            cachemanager.getCacheString(ent_htsoffcnt_cache_key)
                .then(function (hatsoffcount) {
                    entities[index].hatsoffcount = (!hatsoffcount || hatsoffcount === "null" || hatsoffcount === "undefined") ? null : Number(hatsoffcount);

                    (hatsoffcount === "null" || hatsoffcount === "undefined") ? console.log('Incorrect values are being stored in cache for hatsoffcount') : //Do nothig;

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

function loadHatsoffCountsFast(connection, master_rows) {
    return new Promise(function (resolve, reject) {
        getAllHatsoffCountsCache(master_rows)
            .then(function (rows) {

                master_rows = rows;

                var entities_no_hoffcnt = master_rows.filter(function (r) {
                    return r.hatsoffcount === null;
                });

                if (entities_no_hoffcnt.length > 0) {
                    return getAllHatsoffCounts(connection, entities_no_hoffcnt);
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
                        master_rows[i].hatsoffcount = r.hatsoffcount;
                    });

                    // master_rows[master_entityids.indexOf(r.entityid)].hatsoffcount = r.hatsoffcount;
                });

                resolve(master_rows);
                updateHatsoffCountsCache(rows);
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
    registerHatsOff: registerHatsOff,
    loadHatsOffsLegacy: loadHatsOffsLegacy,
    loadHatsOffs: loadHatsOffs,
    updateHatsOffDataForUpdates: updateHatsOffDataForUpdates,
    loadHatsoffCountsFast: loadHatsoffCountsFast,
    updateHatsoffCountCacheFromDB: updateHatsoffCountCacheFromDB
};
