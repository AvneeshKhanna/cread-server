/**
 * Created by avnee on 12-04-2018.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

router.get('/load-scheduled', function (request, response) {

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return loadScheduledHTODs(connection);
        })
        .then(function (result) {
            response.send({
                data: {
                    items: result
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

router.post('/add-htag', function (request, response) {
    var hashtag = request.body.hashtag;
    var for_date = request.body.for_date;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return addHTagToHOTD(connection, hashtag, for_date);
        })
        .then(function () {
            response.send({
                data: {
                    status: 'done'
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

router.post('/edit-htag', function (request, response) {
    var hotdid = request.body.hotdid;
    var hashtag = request.body.hashtag;
    var for_date = request.body.for_date;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return updateHTagToHOTD(connection, hotdid, hashtag, for_date);
        })
        .then(function () {
            response.send({
                data: {
                    status: 'done'
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

router.post('/remove-htag', function (request, response) {
    var hotdid = request.body.hotdid;

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return removeHOTD(connection, hotdid);
        })
        .then(function () {
            response.send({
                data: {
                    status: 'done'
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

function loadScheduledHTODs(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT hotdid, hashtag, for_date FROM HTagOfTheDay ORDER BY for_date DESC', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

function addHTagToHOTD(connection, hashtag, for_date) {

    var sqlparams = {
        hashtag: hashtag,
        for_date: for_date
    };

    return new Promise(function (resolve, reject) {
        connection.query('INSERT INTO HTagOfTheDay (hashtag, for_date) VALUES ?', [sqlparams], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
    
}

function updateHTagToHOTD(connection, hotdid, hashtag, for_date) {

    var sqlparams = {
        hashtag: hashtag,
        for_date: for_date
    };

    return new Promise(function (resolve, reject) {
        connection.query('UPDATE HTagOfTheDay SET ? WHERE hotdid = ?', [sqlparams, hotdid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });

}

function removeHOTD(connection, hotdid) {

    return new Promise(function (resolve, reject) {
        connection.query('DELETE FROM HTagOfTheDay WHERE hotdid = ?', [hotdid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });

}

module.exports = router;