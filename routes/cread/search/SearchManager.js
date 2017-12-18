/**
 * Created by avnee on 14-12-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var searchutils = require('./SearchUtils');

router.get('/load', function (request, response) {

    var keyword = decodeURIComponent(request.query.keyword).trim();
    var searchtype = request.query.searchtype ? request.query.searchtype : 'USER';  //Could be of the type 'USER' | 'HASHTAG'
    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            if(searchtype === 'USER'){
                return searchutils.getUsernamesSearchResult(connection, keyword);
            }
            else if(searchtype === 'HASHTAG'){
                return searchutils.getHashtagSearchResult(connection, keyword);
            }
        })
        .then(function (rows) {
            console.log("rows " + JSON.stringify(rows, null, 3));
            response.send({
                data: {
                    items: rows
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