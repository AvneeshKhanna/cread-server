/**
 * Created by avnee on 07-04-2018.
 */
'use-strict';

const config = require('../../../Config');
const cache_utils = require('./CacheUtils');

function setCacheString(key, value){
    return new Promise(function (resolve, reject) {
        config.getRedisClient()
            .then(function (redis_client) {
                redis_client.set(cache_utils.addKeyPrefix(key), value);
                resolve();
                redis_client.quit();
            });
    });
}

function getCacheString(key){
    return new Promise(function (resolve, reject) {
        config.getRedisClient()
            .then(function (redis_client) {
                redis_client.get(cache_utils.addKeyPrefix(key), function (err, value) {
                    if(err){
                        reject(err);
                    }
                    else {
                        resolve(value);
                    }
                    redis_client.quit();
                });
            });
    });
}

function setCacheHMap(key, value){
    return new Promise(function (resolve, reject) {

        for (let prop in value) {
            value[prop] = JSON.stringify(value[prop]);
        }

        config.getRedisClient()
            .then(function (redis_client) {
                redis_client.hmset(cache_utils.addKeyPrefix(key), value);
                resolve();
                redis_client.quit();
            });
    });
}

function getCacheHMap(key){
    return new Promise(function (resolve, reject) {
        config.getRedisClient()
            .then(function (redis_client) {
                redis_client.hgetall(cache_utils.addKeyPrefix(key), function (err, value) {
                    if(err){
                        reject(err);
                    }
                    else {

                        try{
                            for(let prop in value){
                                value[prop] = JSON.parse(value[prop]);
                            }
                        }
                        catch(ex){
                            console.error(ex);
                        }

                        resolve(value);
                    }
                    redis_client.quit();
                });
            });
    });
}

function getCacheHMapMultiple(key, fields){
    return new Promise(function (resolve, reject) {
        config.getRedisClient()
            .then(function (redis_client) {
                redis_client.hmget(cache_utils.addKeyPrefix(key), fields, function (err, value) {
                    if(err){
                        reject(err);
                    }
                    else {
                        resolve(value);
                    }
                    redis_client.quit();
                });
            });
    });
}

function getCacheHMapValue(key, field){
    return new Promise(function (resolve, reject) {
        config.getRedisClient()
            .then(function (redis_client) {
                redis_client.hget(cache_utils.addKeyPrefix(key), field, function (err, value) {
                    if(err){
                        reject(err);
                    }
                    else {
                        resolve(value);
                    }
                    redis_client.quit();
                });
            });
    });
}

//TODO: Test
function getCacheList(key) {
    return new Promise(function (resolve, reject) {
        config.getRedisClient()
            .then(function (redis_client) {
                redis_client.lrange(cache_utils.addKeyPrefix(key), function (err, reply) {
                    if(err){
                        reject(err);
                    }
                    else{
                        resolve(reply);
                    }
                    redis_client.quit();
                });
            });
    });
}

function deleteCacheKey(key) {
    return new Promise(function (resolve, reject) {
        config.getRedisClient()
            .then(function (redis_client) {
                redis_client.del(cache_utils.addKeyPrefix(key), function (err, response) {
                    if(err){
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
    });
}

function getAllCacheKeys(pattern) {
    return new Promise(function (resolve, reject) {
        config.getRedisClient()
            .then(function (redis_client) {
                redis_client.keys(pattern ? pattern : "*", function (err, response) {
                    if(err){
                        reject(err);
                    }
                    else{
                        resolve(response);
                    }
                    redis_client.quit();
                });
            })
    });
}

function deleteCacheKeys(keys) {
    return new Promise(function (resolve, reject) {
        if(!config.isProduction()){
            config.getRedisClient()
                .then(function (redis_client) {
                    redis_client.del(keys, function (err, response) {
                        if(err){
                            reject(err);
                        }
                        else{
                            resolve(response);
                        }
                        redis_client.quit();
                    });
                })
        }
        else{
            reject(new Error('Cannot delete multiple REDIS keys in PRODUCTION'));
        }
    });
}

module.exports = {
    setCacheHMap: setCacheHMap,
    getCacheHMap: getCacheHMap,
    getCacheHMapValue: getCacheHMapValue,
    getCacheHMapMultiple: getCacheHMapMultiple,
    deleteCacheKey: deleteCacheKey,
    getAllCacheKeys: getAllCacheKeys,
    setCacheString: setCacheString,
    getCacheString: getCacheString,
    deleteCacheKeys: deleteCacheKeys
};