/**
 * Created by avnee on 25-09-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var commentutils = require('./CommentUtils');
var utils = require('../utils/Utils');

var uuidGenerator = require('uuid');

router.post('/load', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var page = request.body.page;
    var loadAll = request.body.loadAll; //Whether to load all comments or top comments [true | false]

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var limit = 20;
    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
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
            return commentutils.loadComments(connection, entityid, limit, page, loadAll);
        })
        .then(function (result) {
            response.send({
                tokenstatus: 'valid',
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
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.post('/add', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var comment = request.body.comment;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
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
            return commentutils.addComment(connection, entityid, comment, uuid);
        })
        .then(function (commid) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done',
                    comment: {
                        commid: commid,
                        profilepicurl: utils.createProfilePicUrl(uuid)
                    }
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
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/update', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var commid = request.body.commid;
    var comment = request.body.comment;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
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
            return commentutils.updateComment(connection, commid, uuid, comment);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
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
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

router.post('/delete', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var commid = request.body.commid;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
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
            return commentutils.deleteComment(connection, commid, uuid);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
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
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });

});

module.exports = router;