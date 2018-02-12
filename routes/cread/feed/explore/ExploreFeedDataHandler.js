/**
 * Created by avnee on 12-02-2018.
 */
'use-strict';

var config = require('../../../Config');
var feedutils = require('../FeedUtils');
var consts = require('../../utils/Constants');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

const NodeCache = require( "node-cache" );
const mCache = new NodeCache();

var CronJob = require('cron').CronJob;

var explore_feed_processing_recurrent = new CronJob({
    cronTime: '00 */30 * * * *', //second | minute | hour | day-of-month | month | day-of-week
    onTick: function() {
        /*
         * Runs every half-hour at 00:00
         */

        sortTopNewEntitiesForExplore();

    },
    start: false,   //Whether to start just now
    timeZone: 'Asia/Kolkata'
});

function sortTopNewEntitiesForExplore() {
    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return loadAllEntityDataToMemory(connection);
        })
        .then(function (edata) {
            return feedutils.structureDataCrossPatternTopNew(edata);
        })
        .then(function (patternedRows) {
            console.log("patternedRows saving to cache - " + JSON.stringify(patternedRows, null, 3));
            return saveEntityDataToCache(patternedRows);
        })
        .then(function () {
            console.log("Entity data for explore feed saved to cache");
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
}

function loadAllEntityDataToMemory(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT E.entityid, E.regdate, CASE WHEN (EA.impact_score IS NULL) THEN ? ELSE EA.impact_score END AS impact_weight ' +
            'FROM Entity E ' +
            'LEFT JOIN EntityAnalytics EA ' +
            'USING(entityid) ' +
            'WHERE E.status = "ACTIVE" ' +
            'AND E.for_explore = 1 ' +
            'ORDER BY impact_weight DESC', [consts.explore_algo_base_score], function (err, edata) {

            if(err){
                reject(err);
            }
            else{
                resolve(edata);
            }

        });
    });
}

function saveEntityDataToCache(edata){
    return new Promise(function (resolve, reject) {
        mCache.set("explore-entities", edata, function(err, success){
            if(err){
                reject(err);
            }
            else if(!err && success){
                resolve();
            }
            else{
                reject(new Error("Could not save entity data to cache due to some error"));
            }
        });
    });
}

function getEntityDataFromCache(){
    return new Promise(function (resolve, reject) {
        mCache.get("explore-entities", function(err, value){
            if(err){
                reject(err);
            }
            else if(value === undefined){
                config.getNewConnection()
                    .then(function (connection) {
                        return loadAllEntityDataToMemory(connection);
                    })
                    .then(function (edata) {
                        return feedutils.structureDataCrossPatternTopNew(edata);
                    })
                    .then(function (edata) {
                        return saveEntityDataToCache(edata);
                    })
                    .then(function (edata) {
                        resolve(edata);
                    })
                    .catch(function (err) {
                        reject(err);
                    });
            }
            else{
                resolve(value);
            }
        });
    });
}

module.exports = {
    getEntityDataFromCache: getEntityDataFromCache,
    explore_feed_processing_recurrent: explore_feed_processing_recurrent,
    sortTopNewEntitiesForExplore: sortTopNewEntitiesForExplore
};