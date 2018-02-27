/**
 * Created by avnee on 26-02-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

router.get('/load', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: "invalid"
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            response.status(200).send({
                tokenstatus: "valid",
                data: {
                    featuredlist: [
                        {
                            name: "Avneesh",
                            profilepicurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/6979be3e-835e-433d-a139-addf86ef2344/Profile/display-pic.jpg",
                            uuid: "6979be3e-835e-433d-a139-addf86ef2344"
                        },
                        {
                            name: "Gaurav",
                            profilepicurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/9ff85c43-8a0c-4961-8268-8743e06589bc/Profile/display-pic-small.jpg",
                            uuid: "9ff85c43-8a0c-4961-8268-8743e06589bc"
                        },
                        {
                            name: "Prakhar",
                            profilepicurl: "https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/Users/e1e83dd6-c746-40d8-998e-95f5df54ba9d/Profile/display-pic-small.jpg",
                            uuid: "e1e83dd6-c746-40d8-998e-95f5df54ba9d"
                        }
                    ]
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
        })

});

module.exports = router;