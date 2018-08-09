/**
 * Created by avnee on 09-08-2018.
 */
'use-strict';

const express = require('express');
const router = express.Router();

const config = require('../../Config');
const _auth = require('../../auth-token-management/AuthTokenManager');
const BreakPromiseChainError = require('../utils/BreakPromiseChainError');
const memeutils = require('./MemeUtils');

router.get('/load-photos-for-meme', (request, response) => {

    let uuid = request.headers.uuid;
    let authkey = request.headers.authkey;
    let lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : 0;

    let limit = config.isProduction() ? 10 : 3;

    _auth.authValid(uuid, authkey)
        .then(details => {
            return memeutils.loadPresetMemePhotos(limit, lastindexkey);
        }, () => {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(result => {
            response.send({
                tokenstatus: 'valid',
                data: result
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(err => {
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