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

router.get('/', function (request, response) {

    var entityid = request.query.entityid;
    var entityurl = request.query.entityurl;

    var render_params = {
        meta_tag_og_title: "I created an art work on Cread",
        meta_tag_og_image: entityurl
    };

    response.render((projectpath + 'share-link/share_entity.ejs'), render_params);

});

router.post('/generate-dynamic-link', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var entityurl = request.body.entityurl;

    if(!entityid || !entityurl){
        response.status(500).send({
            message: 'Entityid and entityurl cannot be null'
        }).end();
        return;
    }

    var deeplink = dylinkutils.generateShareEntityDeepLink(entityid, entityurl);
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