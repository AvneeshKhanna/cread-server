/**
 * Created by avnee on 13-07-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var consts = require('../../utils/Constants');

var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var cache_time = consts.cache_time;

var markasstarutils = require('./MarkAsStarUtils');

router.get('/feed/load', function (request, response) {

    var starred = request.query.starred === "true";
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : "";

    var limit = config.isProduction() ? 20 : 8;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return markasstarutils.loadMarkStarFeed(connection, limit, lastindexkey, starred);
        })
        .then(function (result) {
            response.send({
                data: result
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send((!config.isProduction()) ? err : {
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/update', function (request, response) {

    var mark_as_star = request.body.mark_as_star === "true";
    var entityid = request.body.entityid;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return markasstarutils.updateStarPost(connection, entityid, mark_as_star);
        })
        .then(function () {
            response.send({
                data: {
                    status: 'done'
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send(!config.isProduction() ? err : {
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

module.exports = router;