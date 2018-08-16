/**
 * Created by avnee on 18-12-2017.
 */
'use-strict';

const express = require('express');
const router = express.Router();

const config = require('../../Config');

const _auth = require('../../auth-token-management/AuthTokenManager');
const BreakPromiseChainError = require('../utils/BreakPromiseChainError');
const hashtagutils = require('./HashTagUtils');
const utils = require('../utils/Utils');

const consts = require('../utils/Constants');
const cache_time = consts.cache_time;

router.get('/feed', function (request, response) {

    console.log("request headers " + JSON.stringify(request.headers, null, 3));

    let uuid = request.headers.uuid;
    let authkey = request.headers.authkey;
    let htag = decodeURIComponent(request.query.htag).toLowerCase();
    let lastindexkey = decodeURIComponent(request.query.lastindexkey);
    let platform = request.query.platform;
    let memesupport = request.query.memesupport ? request.query.memesupport : 'no';

    let limit = config.isProduction() ? 15 : 4;
    let connection;

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
            return hashtagutils.loadHashtagFeed(connection, uuid, limit, htag, lastindexkey, {memesupport: memesupport});
        })
        .then(function (result) {

            if(platform !== "android"){
                result.feed = utils.filterProfileMentions(result.feed, "caption");
            }

            console.log("result is " + JSON.stringify(result, null, 3));
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
        })

});

router.get('/day/load', function (request, response) {
    let uuid = request.headers.uuid;
    let authkey = request.headers.authkey;

    let connection;

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
            return hashtagutils.loadHTagOfTheDay(connection);
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