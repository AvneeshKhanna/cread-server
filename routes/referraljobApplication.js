//This page is executed when user want to apply for a job using referrals made to him.This basically displays the referrals made to an app user for a job 

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var Promise = require('promise');

var config = require('./Config');
var _connection = config.createConnection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/',function(request,response,next){
    var UUID = request.body.uuid;
    var JUUID = request.body.juuid;
    var userReferrals = new Array();
    
    var sqlQuery = 'SELECT Referrals.userid , referredUsers.Refcode FROM Referrals INNER JOIN referredUsers ON Referrals.Refcode = referredUsers.Refcode WHERE referredUsers.refUser = ? And Referrals.jobid = ?';
    
    _connection.query(sqlQuery,[UUID , JUUID],function(error,result){
        if(error) throw error;
        
        for(var i=0 ; i<result.length ; i++){
            var localJson = {};
            localJson['uuid'] = result[i].userid;
            localJson['refcode'] = result[i].Refcode;
            
            userReferrals.push(localJson);
        }
        
        response.send(userReferrals);
        response.end();
        userReferrals=[];
    });
});

module.exports = router;