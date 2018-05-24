/**
 * Created by avnee on 24-05-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var consts = require('../../utils/Constants');

var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var cache_time = consts.cache_time;

var markforcollabutils = require('./MarkForCollabUtils');

router.get('/feed/load', function (request, response) {

    var filterBy = request.query.filterBy;
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : "";

    var limit = config.isProduction() ? 20 : 8;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return markforcollabutils.loadMarkCollabFeed(connection, limit, lastindexkey, filterBy);
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
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send((!config.isProduction()) ? err : {
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/update', function (request, response) {

    var mark_for_collab = request.body.mark_for_collab;
    var entityid = request.body.entityid;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return markforcollabutils.updateMarkCollab(connection, entityid, mark_for_collab);
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
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send(!config.isProduction() ? err : {
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

module.exports = router;