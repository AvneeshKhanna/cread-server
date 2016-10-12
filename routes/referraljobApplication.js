//This page is executed when user want to apply for a job using referrals made to him. This basically displays the referrals made to an app user for a job 

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var Promise = require('promise');

var config = require('./Config');
var authtokenvalidation = require('./authtokenValidation');   //module to authenticate user before making request
var _connection = config.createConnection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/',function(request,response,next){
    var UUID = request.body.uuid;
    var JUUID = request.body.juuid;
    var auth_key = request.body.authkey;
    var userReferrals = {};
    userReferrals.tokenstatus = {};
    userReferrals.referraldata = new Array();
    
    var sqlQuery = 'SELECT Referrals.userid , referredUsers.Refcode FROM Referrals INNER JOIN referredUsers ON Referrals.Refcode = referredUsers.Refcode WHERE referredUsers.refUser = ? And Referrals.jobid = ?';
    
    authtokenvalidation.checkToken(UUID , auth_key , function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            userReferrals.tokenstatus = 'invalid';
            response.send(userReferrals);
            response.end();
        }
        
        else{
            _connection.query(sqlQuery, [UUID, JUUID], function(error,result){
                if(error) throw error;
                
                userReferrals.tokenstatus = 'valid';
        
                for(var i=0 ; i<result.length ; i++){
                    var localJson = {};
                    localJson['uuid'] = result[i].userid;
                    localJson['refcode'] = result[i].Refcode;
                    
                    var s3bucketheader = "testamentbucket.s3-ap-northeast-1.amazonaws.com";
                    var urlprotocol = 'https://';
                    
                    localJson['contactpicurl'] = urlprotocol + s3bucketheader + '/Users/' + result[i].userid + '/Profile/display-pic.jpg';
                    userReferrals.referraldata.push(localJson);
                }
        
                response.send(userReferrals);
                response.end();
                userReferrals=[];
            });
        }
    });
});

module.exports = router;