/**
 * Created by avnee on 06-04-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var cacheManager = require('../utils/cache/CacheManager');

router.get('/get-data', function (request, response) {

    try{
        cacheManager.setCacheHMap("foo1", {
            'x': [encodeURIComponent("https://www.google.com"), encodeURIComponent("https://www.yahoo.com")].join(","),
            'y': 20,
            'z': 30
        });
        cacheManager.getCacheHMap("foo1")
            .then(function (result) {
                response.send({"REDIS" : result}).end() // Will print `OK`
            })
            .catch(function (err) {
                response.status(500).send(err).end();
            })
    }
    catch(ex){
        response.status(500).send(ex).end();
    }

});

module.exports = router;
