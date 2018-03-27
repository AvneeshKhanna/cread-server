/**
 * Created by avnee on 08-12-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();
var path = require('path');

var BreakPromiseChainError = require('../../utils/BreakPromiseChainError');
var _auth = require('../../../auth-token-management/AuthTokenManager');
var dylinkutils = require('./DynamicLinkUtils');
var projectpath = path.join(__dirname, '../../../../views/');
var config = require('../../../Config');

/**
 * To generate link preview whenever a GET request is sent to the Firebase dynamic link
 * */
router.get('/', function (request, response) {

    var entityid = request.query.entityid;
    var entityurl = request.query.entityurl;
    var creatorname = request.query.creatorname;

    var render_params = {
        meta_tag_og_title: "Experience and buy " + creatorname + "'s art on Cread",
        meta_tag_og_image: entityurl,
        meta_tag_og_url: config.server_url
    };

    response.render((projectpath + 'share-link/share_entity.ejs'), render_params);

});

/**
 * To generate a dynamic link for the user who is sharing the link
 * */
router.post('/generate-dynamic-link', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var entityurl = request.body.entityurl;
    var creatorname = request.body.creatorname;
    var share_source = request.body.share_source;

    console.log("Request is " + JSON.stringify(request.body, null, 3));

    if(!entityid || !entityurl || !creatorname){
        response.status(500).send({
            message: 'Entityid, entityurl or creatorname cannot be null'
        }).end();
        return;
    }

    var deeplink = dylinkutils.generateShareEntityDeepLink(entityid, entityurl, creatorname, uuid, share_source);
    var longDynamicLink = dylinkutils.generateLongDynamicLink(deeplink);

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            return dylinkutils.shortenDynamicLink(longDynamicLink);
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (shortlink) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    link: shortlink
                }
            });
            response.end();
        })
        .catch(function (err) {
            console.error(err);
            response.status(500).send({
                message: 'Some error occurred at the server'
            }).end();
        });

});

module.exports = router;