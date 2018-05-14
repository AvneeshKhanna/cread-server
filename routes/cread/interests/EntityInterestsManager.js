/**
 * Created by avnee on 09-05-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var consts = require('../utils/Constants');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var cache_time = consts.cache_time;

var utils = require('../utils/Utils');
var entityintrstutils = require('../interests/EntityInterestsUtils');
var interestutils = require('./InterestUtils');

router.get('/load', function (request, response) {
    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;
    var entityid = request.query.entityid;  //Nullable
    var type = request.query.type;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection()
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return entityintrstutils.loadInterestsByType(connection, entityid, type);
        })
        .then(function (result) {
            if (request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')) {
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
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.get('/load-macro', function (request, response) {
    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection()
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return interestutils.loadMacroInterests(connection);
        })
        .then(function (result) {

            response.set('Cache-Control', 'public, max-age=' + cache_time.ultrahigh);

            if (request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')) {
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
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

/**
 * Router to load an entity data for tagging interests/labels manually
 * */
router.get('/load-posts-for-tag', function (request, response) {

    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : null;
    var limit = config.isProduction() ? 8 : 8;

    var connection;
    var result;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return utils.beginTransaction(connection);
        })
        .then(function () {
            return entityintrstutils.loadPostsForInterestTag(connection, limit, lastindexkey);
        })
        .then(function (res) {
            result = res;

            var entityids = result.items.map(function (item) {
                return item.entityid;
            });

            if(entityids.length > 0){
                return entityintrstutils.lockEntityMultiple(connection, entityids);
            }
        })
        .then(function () {
            return utils.commitTransaction(connection);
        }, function (err) {
            return utils.rollbackTransaction(connection, undefined, err);
        })
        .then(function () {
            response.send({
                data: result
            });
            response.end();
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

/**
 * Router to unlock an entity after tagging interests/labels manually
 * */
/*router.post('/unlock-entity', function (request, response) {
    var entityid = request.body.entityid;
    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return entityintrstutils.unlockEntity(connection, entityid);
        })
        .then(function () {
            response.send({
                status: 'done'
            });
            response.end();
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
});*/

module.exports = router;
