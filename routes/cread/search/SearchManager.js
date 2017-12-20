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

    console.log("request headers are " + JSON.stringify(request.headers, null, 3));

    var keyword = decodeURIComponent(request.query.keyword).trim();
    var searchtype = request.query.searchtype ? request.query.searchtype : 'USER';  //Could be of the type 'USER' | 'HASHTAG'
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : null;

    var limit = config.envtype === 'PRODUCTION' ? 30 : 1;
    var specialcharregex = /[^@>()+\-*"~<]+/;   //Remove all special characters which can cause a bug in FULL TEXT SEARCH

    keyword = specialcharregex.exec(keyword) ? specialcharregex.exec(keyword).join("") : "";    // not-null ? array.join("") : ""

    console.log('keyword is ' + JSON.stringify(keyword, null, 3));

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            if(keyword.length > 0){
                if(searchtype === 'USER'){
                    return searchutils.getUsernamesSearchResult(connection, keyword/*, limit, lastindexkey*/);
                }
                else if(searchtype === 'HASHTAG'){
                    return searchutils.getHashtagSearchResult(connection, keyword);
                }
            }
            else{
                response.send({
                    data: {
                        searchtype: searchtype,
                        items: []
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function (rows) {
            console.log("rows " + JSON.stringify(rows, null, 3));
            response.send({
                data: {
                    searchtype: searchtype,
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