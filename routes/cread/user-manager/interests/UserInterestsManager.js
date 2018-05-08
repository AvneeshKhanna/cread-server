/**
 * Created by avnee on 01-08-2017.
 */
'use strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');

var _auth = require('../../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

var userintrstutils = require('./UserInterestsUtils');

router.get('/load', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;

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
            return userintrstutils.loadAllInterestsForUser(connection, uuid);
        })
        .then(function (result) {
            response.send({
                tokenstatus: "valid",
                data: {
                    requestmore: false,
                    lastindexkey: 30,
                    interests: result/*[
                        {
                            intid: 1,
                            intname: "Writing",
                            intimgurl: "https://i.pinimg.com/736x/f8/1e/7c/f81e7c1d9b47b0da8aa7a80abae77a92.jpg"
                        },
                        {
                            intid: 2,
                            intname: "Photography",
                            intimgurl: "https://static.bhphotovideo.com/explora/sites/default/files/styles/top_shot/public/TS-Night-Photography.jpg?itok=VO6dxBNS"
                        },
                        {
                            intid: 3,
                            intname: "Doodling",
                            intimgurl: "https://image.freepik.com/free-photo/hand-of-businesswoman-writing-on-paper-in-office_1262-2119.jpg"
                        },
                        {
                            intid: 4,
                            intname: "Writing",
                            intimgurl: "https://image.freepik.com/free-photo/hand-of-businesswoman-writing-on-paper-in-office_1262-2119.jpg"
                        },
                        {
                            intid: 5,
                            intname: "Photography",
                            intimgurl: "https://static.bhphotovideo.com/explora/sites/default/files/styles/top_shot/public/TS-Night-Photography.jpg?itok=VO6dxBNS"
                        },
                        {
                            intid: 6,
                            intname: "Doodling",
                            intimgurl: "https://i.pinimg.com/736x/f8/1e/7c/f81e7c1d9b47b0da8aa7a80abae77a92.jpg"
                        },
                        {
                            intid: 7,
                            intname: "Writing",
                            intimgurl: "https://image.freepik.com/free-photo/hand-of-businesswoman-writing-on-paper-in-office_1262-2119.jpg"
                        },
                        {
                            intid: 8,
                            intname: "Photography",
                            intimgurl: "https://static.bhphotovideo.com/explora/sites/default/files/styles/top_shot/public/TS-Night-Photography.jpg?itok=VO6dxBNS"
                        },
                        {
                            intid: 9,
                            intname: "Doodling",
                            intimgurl: "https://i.pinimg.com/736x/f8/1e/7c/f81e7c1d9b47b0da8aa7a80abae77a92.jpg"
                        }
                    ]*/
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
                    message: 'Some error occurred at the server'
                }).end();
            }
        });

});

router.post('/save', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var interests = request.body.interests; //array of interest ids

    if(!(interests instanceof Array)){
        console.error(new Error('"interests" body parameter should be of type array'));
        response.status(500).send({
            message: '"interests" body parameter should be of type array'
        });
        return;
    }

    console.log("request is " + JSON.stringify(request.body, null, 3));

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
            return userintrstutils.saveUserInterests(connection, uuid, interests);
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
            if (err instanceof BreakPromiseChainError) {
                //Do nothing
            }
            else {
                console.error(err);
                response.status(500).send({
                    error: 'Some error occurred at the server'
                }).end();
            }
        });
});

//TODO: Complete
router.post('/remove', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

});

module.exports = router;