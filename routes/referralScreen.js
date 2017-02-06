//This code is to show all the referrals made by an app user to a multiple users if they have applied to the job

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var AWS = require('aws-sdk');

var config = require('./Config');
var authtokenvalidation = require('./authtokenValidation');   //module to authenticate user before making request

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var _connection = config.createConnection;
var referrals = new Array();

var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var s3bucket = envconfig.get('s3.bucket');

router.post('/',function(request,response,next){
    var userid = request.body.uuid;
    var auth_key = request.body.authkey;
    
    var responseData = {};
    responseData.tokenstatus = {};
    responseData.referreddata = [];
    
    console.log('Request is ' + JSON.stringify(request.body, null, 3));
    
    authtokenvalidation.checkToken(userid, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            responseData.tokenstatus = 'invalid';
            response.send(responseData);
            response.end();
        }
        
        else{
            getData(userid,responseData,response);
        }
    });
});

function getData(userID, responseData, res){
    var Query = 'SELECT users.firstname, users.UUID, users.lastname, jobs.title, jobs.companyname, jobs.RefAmount, jobs.JUUID, apply.Application_status FROM apply INNER JOIN Referrals ON apply.Refcode = Referrals.Refcode INNER JOIN users ON users.UUID = apply.userid INNER JOIN jobs ON apply.jobid = jobs.JUUID WHERE Referrals.userid = ?';

    responseData.tokenstatus = 'valid';
    
    _connection.query(Query, [userID], function(error, row){
        if (error) throw error;
        
        console.log(row);
        
        for(var i=0 ; i<row.length ; i++){
            var localJson ={};
            localJson['name'] = row[i].firstname+' '+row[i].lastname;
            localJson['uuid'] = row[i].UUID;
            localJson['amount'] = row[i].RefAmount;
            localJson['status'] = row[i].Application_status;
            localJson['jobid'] = row[i].JUUID;
            localJson['jobtitle'] = row[i].title;
            localJson['jobcompany'] = row[i].companyname;
            
            var s3bucketheader = s3bucket + '.s3-ap-northeast-1.amazonaws.com';
            var urlprotocol = 'https://';
                    
            localJson['referralpicurl'] = urlprotocol + s3bucketheader + '/Users/' + row[i].UUID + '/Profile/display-pic.jpg';
            
            referrals.push(localJson);
        }
        
        responseData.referreddata = referrals;        
            
        res.send(responseData);
        res.end();
        referrals=[];
    });
}

module.exports = router;
//var Query = 'SELECT Referrals.userid , jobs.payscale , jobs.JUUID , apply.Application_status , users.UUID , users.username , Referrals.Refcode , referredUsers.refUser FROM referredUsers INNER JOIN Referrals ON Referrals.Refcode = referredUsers.Refcode INNER JOIN users ON referredUsers.refUser = users.UUID LEFT JOIN jobs ON Referrals.jobid = jobs.JUUID LEFT JOIN apply ON users.UUID = apply.userid';

//SELECT  users.username , jobs.payscale , jobs.JUUID , apply.Application_status FROM referredUsers INNER JOIN Referrals ON Referrals.Refcode = referredUsers.Refcode INNER JOIN users ON referredUsers.refUser = users.UUID INNER JOIN jobs ON Referrals.jobid = jobs.JUUID INNER JOIN apply ON users.UUID = apply.userid WHERE Referrals.userid = ?

//SELECT users.firstname, users.UUID, users.lastname, jobs.title, jobs.companyname, jobs.payscale, jobs.JUUID, apply.Application_status FROM