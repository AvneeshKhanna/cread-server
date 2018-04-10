/**
 * Created by avnee on 05-04-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var consts = require('../utils/Constants');
var cache_time = consts.cache_time;

var userrecommendutils = require('./UserRecommendUtils');

var dummy = {
    users: [
        {
            name: "Avneesh Khanna",
            bio: "Explorer",
            postcount: 30,
            uuid: "f597f845-fa36-4eda-9d3b-218ee527bc7d",
            profilepicurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/f597f845-fa36-4eda-9d3b-218ee527bc7d/Profile/display-pic-small.jpg",
            posts: [
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/9cca2473-9626-4883-98ea-b68d403a0323-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/8fbbf4ca-8ef1-41ba-aa83-d0dfca854dcb-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Profile/display-pic-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Short/d2b88106-709f-48ed-97c0-845b0b5450cd-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/45e84cb0-6c4c-43fb-8494-4ecc26829eb1-small.jpg"
                }
            ]
        },
        {
            name: "Prakhar Chandna",
            bio: "Wanderer",
            postcount: 30,
            uuid: "e1e83dd6-c746-40d8-998e-95f5df54ba9d",
            profilepicurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Profile/display-pic-small.jpg",
            posts: [
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/9cca2473-9626-4883-98ea-b68d403a0323-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/8fbbf4ca-8ef1-41ba-aa83-d0dfca854dcb-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Profile/display-pic-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Short/d2b88106-709f-48ed-97c0-845b0b5450cd-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/45e84cb0-6c4c-43fb-8494-4ecc26829eb1-small.jpg"
                }
            ]
        },
        {
            name: "Gaurav Kumar",
            bio: "Wanderlust",
            postcount: 30,
            uuid: "9ff85c43-8a0c-4961-8268-8743e06589bc",
            profilepicurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/9ff85c43-8a0c-4961-8268-8743e06589bc/Profile/display-pic-small.jpg",
            posts: [
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/9cca2473-9626-4883-98ea-b68d403a0323-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/8fbbf4ca-8ef1-41ba-aa83-d0dfca854dcb-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Profile/display-pic-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Short/d2b88106-709f-48ed-97c0-845b0b5450cd-small.jpg"
                },
                {
                    entityurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Capture/45e84cb0-6c4c-43fb-8494-4ecc26829eb1-small.jpg"
                }
            ]
        }
    ],
    requestmore: false,
    lastindexkey: null
};

router.get('/details', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;

    var lastindexkey = request.query.lastindexkey;

    var limit = config.isProduction() ? 8 : 1;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            /*return new Promise(function (resolve, reject) {
                resolve(dummy);
            });*/
            return userrecommendutils.getTopUsersData(connection, uuid, limit, lastindexkey);
        })
        .then(function (result) {
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if(request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')){
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    tokenstatus: 'valid',
                    data: result
                });
                response.end();
            }

            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.get('/load', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;

    var lastindexkey = request.query.lastindexkey;

    var limit = config.isProduction() ? 8 : 10;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return userrecommendutils.getTopUsersOverview(connection, uuid, limit, lastindexkey)
        })
        .then(function (result) {
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if(request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')){
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    tokenstatus: 'valid',
                    data: result
                });
                response.end();
            }

            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

module.exports = router;