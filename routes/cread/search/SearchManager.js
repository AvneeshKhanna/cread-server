/**
 * Created by avnee on 14-12-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var searchutils = require('./SearchUtils');
var consts = require('../utils/Constants');
var cache_time = consts.cache_time;

router.get('/load', function (request, response) {

    console.log("request headers are " + JSON.stringify(request.headers, null, 3));

    var keyword = decodeURIComponent(request.query.keyword).trim();
    var searchtype = request.query.searchtype ? request.query.searchtype : 'USER';  //Could be of the type 'USER' | 'HASHTAG'
    var lastindexkey = request.query.lastindexkey ? decodeURIComponent(request.query.lastindexkey) : "";

    var limit = config.envtype === 'PRODUCTION' ? 30 : 8;
    var specialcharregex = /[^@>()+\-*"~<]+/;   //Remove all special characters which can cause a bug in FULL TEXT SEARCH

    keyword = specialcharregex.exec(keyword) ? specialcharregex.exec(keyword).join("") : "";    // not-null ? array.join("") : ""

    console.log('keyword is ' + JSON.stringify(keyword, null, 3));

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            if(keyword.length > 0){
                if(searchtype === 'USER'){
                    return searchutils.getUsernamesSearchResult(connection, keyword, limit, lastindexkey);
                }
                else if(searchtype === 'HASHTAG'){
                    return searchutils.getHashtagSearchResult(connection, keyword, limit, lastindexkey);
                }
            }
            else{   //Case where after filtering, keyword is empty
                response.send({
                    data: {
                        searchtype: searchtype,
                        requestmore: false,
                        lastindexkey: "",
                        items: []
                    }
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));

            result.searchtype = searchtype;
            response.set('Cache-Control', 'public, max-age=' + cache_time.high);

            if(request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')){
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    data: result
                });
                response.end();
            }
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