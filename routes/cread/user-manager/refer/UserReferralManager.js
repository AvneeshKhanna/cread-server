/**
 * Created by avnee on 26-03-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../../Config');
var dynamiclinkutils = require('../entity/share/DynamicLinkUtils');
var userreferralutils = require('./UserReferralUtils');

router.get('/get-referral-link', function (request, response) {

    var uuid = request.headers.uuid;
    var authkey = request.headers.authkey;

    _auth.authValid(uuid, authkey)
        .then(function (details) {

            var deepLink = userreferralutils.generateShareAppDeepLink(uuid);
            var longDynamicLink = dynamiclinkutils.generateLongDynamicLink(deepLink);

            return dynamiclinkutils.shortenDynamicLink(longDynamicLink);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (shortDynamicLink) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    link: shortDynamicLink
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
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