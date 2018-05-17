/**
 * Created by avnee on 23-11-2017.
 */
'use-strict';

var buckets = require('buckets-js');
var async = require('async');

var utils = require('../utils/Utils');
var cachemanager = require('../utils/cache/CacheManager');
var cacheutils = require('../utils/cache/CacheUtils');

/**
 * Function to retrieve the users' details whose content has been collaborated on
 * */
function getCollaborationData(connection, rows) {
    return new Promise(function (resolve, reject) {

        var shcaptureids = rows.filter(function (element) {
            return !!(element.shcaptureid);
        }).map(function (element) {
            return element.shcaptureid;
        });

        var cpshortids = rows.filter(function (element) {
            return !!(element.cpshortid);
        }).map(function (element) {
            return element.cpshortid;
        });

        var collabdataquery;
        var collabsqlparams;
        var retrievecollabdata = true;

        if (cpshortids.length !== 0 && shcaptureids.length !== 0) {
            collabdataquery = 'SELECT Entity.entityid, Entity.type, Short.shoid, Capture.capid, UserS.firstname AS sfirstname, ' +
                'UserS.lastname AS slastname, UserS.uuid AS suuid, UserC.firstname AS cfirstname, ' +
                'UserC.lastname AS clastname, UserC.uuid  AS cuuid ' +
                'FROM Entity ' +
                'LEFT JOIN Short ' +
                'ON Entity.entityid = Short.entityid ' +
                'LEFT JOIN Capture ' +
                'ON Entity.entityid = Capture.entityid ' +
                'LEFT JOIN User AS UserS ' +
                'ON Capture.uuid = UserS.uuid ' +
                'LEFT JOIN User AS UserC ' +
                'ON Short.uuid = UserC.uuid ' +
                'WHERE Capture.capid IN (?) ' +
                'OR Short.shoid IN (?)';
            collabsqlparams = [
                shcaptureids,
                cpshortids
            ];
        }
        else if (cpshortids.length === 0 && shcaptureids.length !== 0) {
            collabdataquery = 'SELECT Entity.entityid, Entity.type, Capture.shoid, Capture.capid, UserS.firstname AS sfirstname, ' +
                'UserS.lastname AS slastname, UserS.uuid AS suuid ' +
                'FROM Entity ' +
                'LEFT JOIN Capture ' +
                'ON Entity.entityid = Capture.entityid ' +
                'LEFT JOIN User AS UserS ' +
                'ON Capture.uuid = UserS.uuid ' +
                'WHERE Capture.capid IN (?) ';

            collabsqlparams = [
                shcaptureids
            ];
        }
        else if (cpshortids.length !== 0 && shcaptureids.length === 0) {
            collabdataquery = 'SELECT Entity.entityid, Entity.type, Short.shoid, Short.capid, UserC.firstname AS cfirstname, ' +
                'UserC.lastname AS clastname, UserC.uuid  AS cuuid ' +
                'FROM Entity ' +
                'LEFT JOIN Short ' +
                'ON Entity.entityid = Short.entityid ' +
                'LEFT JOIN User AS UserC ' +
                'ON Short.uuid = UserC.uuid ' +
                'WHERE Short.shoid IN (?)';
            collabsqlparams = [
                cpshortids
            ];
        }
        else {
            retrievecollabdata = false;
        }

        if (retrievecollabdata) {
            //Retrieve collaboration data
            connection.query(collabdataquery, collabsqlparams, function (err, collab_rows) {
                if (err) {
                    reject(err);
                }
                else {

                    collab_rows.forEach(function (collab) {

                        // var row_element;
                        var indexes;

                        if (collab.type === 'SHORT') {   //Case where rows[i] is of type CAPTURE & collab_rows[i] is of type SHORT

                            indexes = utils.getAllIndexes(rows.map(function (e) {
                                if (!e.cpshortid) {
                                    e.cpshortid = null; //So that the length of the original array doesn't decrease
                                }
                                return e.cpshortid;
                            }), collab.shoid);

                            indexes.forEach(function (index) {
                                rows[index].cpshort = {
                                    name: collab.cfirstname + ' ' + collab.clastname,
                                    uuid: collab.cuuid,
                                    entityid: collab.entityid
                                }
                            });

                            /*row_element = rows[rows.map(function (e) {
                                if (!e.cpshortid) {
                                    e.cpshortid = null; //So that the length of the original array doesn't decrease
                                }
                                return e.cpshortid;
                            }).indexOf(collab.shoid)];

                            row_element.cpshort = {
                                name: collab.cfirstname  + ' ' + collab.clastname,
                                uuid: collab.cuuid,
                                entityid: collab.entityid
                            }*/
                        }
                        else {   //Case where rows[i] is of type SHORT & collab_rows[i] is of type CAPTURE

                            indexes = utils.getAllIndexes(rows.map(function (e) {
                                if (!e.shcaptureid) {
                                    e.shcaptureid = null;   //So that the length of the original array doesn't decrease
                                }
                                return e.shcaptureid;
                            }), collab.capid);

                            indexes.forEach(function (index) {
                                rows[index].shcapture = {
                                    name: collab.sfirstname + ' ' + collab.slastname,
                                    uuid: collab.suuid,
                                    entityid: collab.entityid
                                }
                            });

                            /*row_element = rows[rows.map(function (e) {
                                if (!e.shcaptureid) {
                                    e.shcaptureid = null;   //So that the length of the original array doesn't decrease
                                }
                                return e.shcaptureid;
                            }).indexOf(collab.capid)];

                            row_element.shcapture = {
                                name: collab.sfirstname + ' ' + collab.slastname,
                                uuid: collab.suuid,
                                entityid: collab.entityid
                            }*/
                        }
                    });

                    resolve(rows);
                }
            });
        }
        else {
            //Collaboration data not retrieved
            console.log('collaboration data not retrieved');
            resolve(rows);
        }
    });
}

function getCollaborationCounts(connection, rows, feedEntities) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.entityid, ' +
            'COUNT(DISTINCT (CASE WHEN(CollabE.status = "ACTIVE") THEN SCap.capid END)) AS shortcollabcount, ' +
            'COUNT(DISTINCT (CASE WHEN(CollabE.status = "ACTIVE") THEN CShort.shoid END)) AS capturecollabcount ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Entity.entityid = Short.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Entity.entityid = Capture.entityid ' +
            'LEFT JOIN Capture AS SCap ' +
            'ON Short.shoid = SCap.shoid ' +
            'LEFT JOIN Short AS CShort ' +
            'ON Capture.capid = CShort.capid ' +
            'LEFT JOIN Entity CollabE ' +
            'ON (SCap.entityid = CollabE.entityid OR CShort.entityid = CollabE.entityid) ' +
            'WHERE Entity.entityid IN (?) ' +
            //'AND (CollabE.status = "ACTIVE" OR CollabE.entityid IS NULL) ' +
            'GROUP BY Entity.entityid', [feedEntities], function (err, items) {
            if (err) {
                reject(err);
            }
            else {
                if (items.length > 0) {
                    items.forEach(function (item) {

                        var row_element = rows[rows.map(function (el) {
                            return el.entityid;
                        }).indexOf(item.entityid)];

                        if (row_element.type === 'SHORT') {
                            row_element.collabcount = item.shortcollabcount;
                        }
                        else if (row_element.type === 'CAPTURE') {
                            row_element.collabcount = item.capturecollabcount;
                        }

                    });

                    resolve(rows);
                }
                else {
                    resolve(rows);
                }
            }
        });
    });
}

/**
 * Structure data for explore-feed grid where:
 *      0th, 3th, 4th, 7th, 8th, 11th, 12th .. correspond to SHORT type elements
 *      1st, 2nd, 5th, 6th, 9th, 10th, 13th, 14th .. correspond to CAPTURE type elements
 * */
function structureDataCrossPattern(rows) {
    return new Promise(function (resolve, reject) {
        var captureMasterQueue = buckets.Queue();
        var shortMasterQueue = buckets.Queue();

        rows.map(function (element) {
            if (element.type === 'SHORT') {
                shortMasterQueue.enqueue(element);
            }
            else if (element.type === 'CAPTURE') {
                captureMasterQueue.enqueue(element);
            }
        });

        var sQSize = shortMasterQueue.size();
        var cQSize = captureMasterQueue.size();

        var patternLoopSize = (sQSize < cQSize) ? 2 * sQSize : 2 * cQSize;

        var patternedRows = [];

        for (var index = 0; index < patternLoopSize; index++) {
            if (patternIndexSeriesIndicator(index)) {
                patternedRows.push(shortMasterQueue.dequeue());
            }
            else {
                patternedRows.push(captureMasterQueue.dequeue());
            }
        }

        if (!captureMasterQueue.isEmpty()) {
            patternedRows = patternedRows.concat(captureMasterQueue.toArray());
        }
        else if (!shortMasterQueue.isEmpty()) {
            patternedRows = patternedRows.concat(shortMasterQueue.toArray());
        }

        resolve(patternedRows);
    });
}

/**
 * Structure data for explore-feed grid where:
 *      0th, 3th, 4th, 7th, 8th, 11th, 12th .. correspond to SHORT type elements
 *      1st, 2nd, 5th, 6th, 9th, 10th, 13th, 14th .. correspond to CAPTURE type elements
 * */
function structureDataCrossPatternTopNew(rows) {
    return new Promise(function (resolve, reject) {
        var topPostsQueue = buckets.Queue();
        var newPostsQueue = buckets.Queue();

        var newPostsArray = rows.splice(50);
        var topPostsArray = rows;   //As splice function is mutable

        //Ordering top posts by last added
        newPostsArray.sort(function (a, b) {
            if (a.regdate > b.regdate) {
                return -1;
            }
            else {
                return 1;
            }
        });

        newPostsArray.map(function (newPost) {
            newPostsQueue.enqueue(newPost);
        });

        topPostsArray.map(function (topPost) {
            topPostsQueue.enqueue(topPost);
        });

        /*rows.map(function (element) {
            if (element.type === 'SHORT') {
                newPostsQueue.enqueue(element);
            }
            else if (element.type === 'CAPTURE') {
                topPostsQueue.enqueue(element);
            }
        });*/

        /*var sQSize = newPostsQueue.size();
        var cQSize = topPostsQueue.size();*/

        var patternLoopSize = 2 * 50/*(sQSize < cQSize) ? 2 * sQSize : 2 * cQSize*/;

        var patternedRows = [];

        for (var index = 0; index < patternLoopSize; index++) {
            if (patternIndexSeriesIndicator(index)) {
                patternedRows.push(topPostsQueue.dequeue());
            }
            else {
                patternedRows.push(newPostsQueue.dequeue());
            }
        }

        /*if(!topPostsQueue.isEmpty()){
            patternedRows = patternedRows.concat(topPostsQueue.toArray());
        }
        else if(!newPostsQueue.isEmpty()){
            patternedRows = patternedRows.concat(newPostsQueue.toArray());
        }*/

        patternedRows = patternedRows.concat(newPostsQueue.toArray());

        resolve(patternedRows);
    });
}

/**
 * Returns 'true' for placing 'SHORT' and 'false' for placing 'CAPTURE'
 *
 * This function generates a series for input: 0,1,2,3,4... as
 * "true, false, false, true, true, false, false, true, true" as required for placing 'SHORT' and 'CAPTURE' in cross-pattern
 * in explore-feed grid
 * */
function patternIndexSeriesIndicator(index) {
    return Math.cos(((2 * index + 1) * Math.PI) / 4) > 0;
}

/**
 * Function to update collab count in REDIS cach for given entities
 *
 * @param entities Should be of the structure - [{entityid: *string*, collabcount: *number*}, ...]
 * */
function updateCollabCountsCache(entities) {
    return new Promise(function (resolve, reject) {
        async.each(entities, function (entity, callback) {

            var ent_collabcnt_cache_key = cacheutils.getEntityCollabCntCacheKey(entity.entityid);

            if (typeof entity.collabcount !== "number") {
                callback(new Error("Value to store for collab count in cache should be a number"));
            }
            else {
                cachemanager.setCacheString(ent_collabcnt_cache_key, String(entity.collabcount))
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
 * Function to fetch collaboration counts of multiple entities from cache using async.js
 *
 * @param entities Should be of the structure [{entityid: *string*}, ..]
 * */
function getAllCollaborationCountsCache(entities) {
    return new Promise(function (resolve, reject) {
        async.eachOf(entities, function (entity, index, callback) {
            cachemanager.getCacheString(cacheutils.getEntityCollabCntCacheKey(entity.entityid))
                .then(function (count) {
                    entities[index].collabcount = count ? Number(count) : null;
                    callback();
                })
                .catch(function (err) {
                    callback(err);
                })
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

/**
 * Function to fetch collaboration counts for entities from cache. Data is update through a write-through approach if
 * cache values do not exist
 * */
function getCollaborationCountsFast(connection, master_rows, feedEntities) {
    return new Promise(function (resolve, reject) {
        getAllCollaborationCountsCache(master_rows)
            .then(function (rows) {
                master_rows = rows;

                var rows_no_collabcnt = master_rows.filter(function (mrow) {
                    return mrow.collabcount === null;
                });

                if(rows_no_collabcnt.length > 0){
                    return getCollaborationCounts(connection, rows_no_collabcnt, rows_no_collabcnt.map(function (r) {
                        return r.entityid;
                    }));
                }
                else{
                    resolve(master_rows);
                    throw new BreakPromiseChainError();
                }
            })
            .then(function (rows) {
                var master_entityids = master_rows.map(function (mr) {
                    return mr.entityid;
                });

                rows.forEach(function (r) {
                    master_rows[master_entityids.indexOf(r.entityid)].collabcount = r.collabcount;
                });

                resolve(master_rows);
                updateCollabCountsCache(rows);
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

function updateEntitiesInfoCache(entities) {
    return new Promise(function (resolve, reject) {
        async.each(entities, function (entity, callback) {

            var ent_info_cache_key = cacheutils.getEntityInfoCacheKey(entity.entityid);

            cachemanager.setCacheHMap(ent_info_cache_key, entity)
                .then(function () {
                    callback();
                })
                .catch(function (err) {
                    callback(err);
                });

        }, function (err) {
            if (err) {
                console.error(err);
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
}

function getEntitiesInfoDB(connection, entities) {
    return new Promise(function (resolve, reject) {

        var entityids = entities.map(function (e) {
            return e.entityid;
        });

        connection.query('SELECT Entity.entityid, Entity.type, Short.shoid, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, ' +
            'Capture.capid AS captureid, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.text_long IS NOT NULL ELSE Capture.text_long IS NOT NULL END AS long_form, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.img_width ELSE Capture.img_width END AS img_width, ' +
            'CASE WHEN(Entity.type = "SHORT") THEN Short.img_height ELSE Capture.img_height END AS img_height ' +
            'FROM Entity ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'WHERE Entity.entityid IN (?) ' +
            'GROUP BY Entity.entityid', [entityids], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows = rows.map(function (element) {
                    if(element.type === 'CAPTURE'){
                        element.entityurl = utils.createSmallCaptureUrl(entities[entityids.indexOf(element.entityid)].uuid, element.captureid);
                    }
                    else{
                        element.entityurl = utils.createSmallShortUrl(entities[entityids.indexOf(element.entityid)].uuid, element.shoid);
                    }

                    element.long_form = (element.long_form === 1);

                    return {
                        info: element
                    };
                });

                resolve(rows);
            }
        });
    });
}

function getAllEntitiesInfo(entities) {
    return new Promise(function (resolve, reject) {
        async.eachOf(entities, function (entity, index, callback) {
            cachemanager.getCacheHMap(cacheutils.getEntityInfoCacheKey(entity.entityid))
                .then(function (info) {
                    entities[index].info = info;
                    callback();
                })
                .catch(function (err) {
                    callback(err);
                });
        }, function (err) {
            if(err){
                reject(err);
            }
            else {
                resolve(entities);
            }
        });
    });
}

function getEntitiesInfoFast(connection, master_rows) {
    return new Promise(function (resolve, reject) {
        getAllEntitiesInfo(master_rows)
            .then(function (rows) {

                master_rows = rows;

                var rows_no_info = master_rows.filter(function (mrow) {
                    return mrow.info === null;
                });

                if(rows_no_info.length > 0){
                    return getEntitiesInfoDB(connection, rows_no_info);
                }
                else{
                    console.log("fetched from cache");
                    resolve(sortByDateDesc(mergeAndFlattenRows(master_rows, 'info')));
                    throw new BreakPromiseChainError();
                }
            })
            .then(function (rows) {
                var master_entityids = master_rows.map(function (mr) {
                    return mr.entityid;
                });

                rows.forEach(function (r) {
                    master_rows[master_entityids.indexOf(r.info.entityid)].info =  r.info;
                });

                resolve(sortByDateDesc(mergeAndFlattenRows(master_rows, 'info')));
                //TODO: Uncomment
                /*updateEntitiesInfoCache(rows.map(function (r) {
                    return r.info;
                }));*/
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

/**
 * Converts {outer: 1, key: {inner: 2}} -> {outer: 1, inner: 2}
 * */
function mergeAndFlattenRows(rows, key) {
    rows = rows.map(function (row) {
        row = Object.assign(row, row[key]);
        if(row.hasOwnProperty(key)){
            delete row[key];
        }
        return row;
    });
    return rows;
}

function sortByDateDesc(rows) {
    rows.sort(function (a, b) {
        if (a.regdate < b.regdate) {
            return 1;
        }
        else {
            return -1;
        }
    });
    return rows;
}

module.exports = {
    getCollaborationData: getCollaborationData,
    getCollaborationCounts: getCollaborationCounts,
    structureDataCrossPattern: structureDataCrossPattern,
    structureDataCrossPatternTopNew: structureDataCrossPatternTopNew,
    getCollaborationCountsFast: getCollaborationCountsFast,
    getEntitiesInfoFast: getEntitiesInfoFast
};