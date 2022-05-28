/**
 * Created by avnee on 28-07-2018.
 */
'use-strict';

//TODO: Remove file

const express = require('express');
const router = express.Router();

const config = require('../../../Config');
const uautils = require('./UserAnalyticsUtils');
const BreakPromiseChainError = require('../../utils/BreakPromiseChainError');

router.get('/update-ua', (request, response) => {

    let connection;
    let uuid = request.headers.uuid;

    config.getNewConnection()
        .then((conn) => {
            connection = conn;
            return uautils.updateUserFeaturedCount(connection, uuid);
        })
        .then(() => {
            response.send({
                status: 'done'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch((err)=>{
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

module.exports = router;