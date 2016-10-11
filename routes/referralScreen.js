//This code is to show all the referrals made by an app user to a multiple users
//replace username with firstname

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');

var config = require('./Config');
var authtokenvalidation = require('./authtokenValidation');   //module to authenticate user before making request

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var _connection = config.createConnection;
var referrals = new Array();

router.post('/',function(request,response,next){
    
    console.log('Request is ' + JSON.stringify(request.body, null, 3));
    
    var userid = request.body.uuid;
    var auth_key = request.body.authkey;
    
    authtokenvalidation.checkToken(userid, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            var invalidJson = {};
            invalidJson['tokenstatus'] = 'Invalid';
            response.send(JSON.stringify(invalidJson));
            response.end();
        }
        
        else{
            getData(userid,response);
        }
    });
//    getData(userid,response);
});

function getData(userID, res){
    var Query = 'SELECT users.firstname, jobs.title, jobs.companyname, jobs.payscale, jobs.JUUID, apply.Application_status FROM users INNER JOIN referredUsers ON users.UUID = referredUsers.refUser INNER JOIN Referrals ON Referrals.Refcode = referredUsers.Refcode INNER JOIN jobs ON jobs.JUUID = Referrals.jobid INNER JOIN apply ON Referrals.Refcode = apply.Refcode WHERE Referrals.userid = ? AND apply.Status = ?';

    
    _connection.query(Query, [userID, 'Applied'], function(error, row){
        if (error) throw error;
        
        console.log(row);
        
        for(var i=0 ; i<row.length ; i++){
            var localJson ={};
            localJson['name'] = row[i].firstname;//+ row[i].lastname;
            localJson['amount'] = row[i].payscale;
            localJson['status'] = row[i].Application_status;
            localJson['jobid'] = row[i].JUUID;
            localJson['jobtitle'] = row[i].title;
            localJson['jobcompany'] = row[i].companyname;
            
            referrals.push(localJson);
        }
            
        res.send(JSON.stringify(referrals));
        res.end();
        //referrals=[];
    });
}

module.exports = router;
//var Query = 'SELECT Referrals.userid , jobs.payscale , jobs.JUUID , apply.Application_status , users.UUID , users.username , Referrals.Refcode , referredUsers.refUser FROM referredUsers INNER JOIN Referrals ON Referrals.Refcode = referredUsers.Refcode INNER JOIN users ON referredUsers.refUser = users.UUID LEFT JOIN jobs ON Referrals.jobid = jobs.JUUID LEFT JOIN apply ON users.UUID = apply.userid';

//SELECT  users.username , jobs.payscale , jobs.JUUID , apply.Application_status FROM referredUsers INNER JOIN Referrals ON Referrals.Refcode = referredUsers.Refcode INNER JOIN users ON referredUsers.refUser = users.UUID INNER JOIN jobs ON Referrals.jobid = jobs.JUUID INNER JOIN apply ON users.UUID = apply.userid WHERE Referrals.userid = ?