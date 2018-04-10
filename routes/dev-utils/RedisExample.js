/**
 * Created by avnee on 06-04-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../Config');
var cacheManager = require('../cread/utils/cache/CacheManager');
var cache_utils = require('../cread/utils/cache/CacheUtils');
var userprofileutils = require('../cread/user-manager/UserProfileUtils');
var REDIS_KEYS = cache_utils.REDIS_KEYS;

router.get('/get-data', function (request, response) {

    try {

        var x1;
        var x2;
        var x3;

        /*cacheManager.setCacheHMap("test", {
                'x': [encodeURIComponent("https://www.google.com"), encodeURIComponent("https://www.yahoo.com")].join(","),
                'y': 20,
                'z': 30
            })
            .then(function () {
                return cacheManager.getCacheHMap("test");
            })*/
        /*cacheManager.deleteCacheKey("test")
            .then(function (result) {
                x1 = result;
                return */cacheManager.getCacheHMap(REDIS_KEYS.USER_LATEST_POSTS)
            //})
            .then(function (result) {
                x2 = result;
                return cacheManager.getAllCacheKeys()
            })
            .then(function (result) {
                x3 = result;
                response.send({x1: x1, x2: x2, x3: x3}).end();
                throw new BreakPromiseChainError();
            })
            .catch(function (err) {
                response.status(500).send(err).end();
            });
    }
    catch (ex) {
        response.status(500).send(ex).end();
    }

});

module.exports = router;
