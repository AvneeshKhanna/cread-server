//This code is to show all the referrals made by an app user to a multiple users
//replace username with firstname

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');

var config = require('./Config');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var _connection = config.createConnection;
var referrals = new Array();

router.post('/',function(request,response,next){
    var userid = request.body.uuid;
    
    getData(userid,response);
});

function getData(userID,res){
    var Query = 'SELECT  users.username , jobs.payscale , jobs.JUUID , apply.Application_status FROM referredUsers INNER JOIN Referrals ON Referrals.Refcode = referredUsers.Refcode INNER JOIN users ON referredUsers.refUser = users.UUID INNER JOIN jobs ON Referrals.jobid = jobs.JUUID LEFT JOIN apply ON users.UUID = apply.userid WHERE Referrals.userid = ?';
    
    _connection.query(Query,userID,function(error,row){
        if (error) throw error;
        
        for(var i=0 ; i<row.length ; i++){
            var localJson ={};
            localJson['username'] = row[i].username;
            localJson['amount'] = row[i].payscale;
            localJson['status'] = row[i].Application_status;
            localJson['jobid'] = row[i].JUUID;
            
            referrals.push(localJson);
        }
        
        res.send(JSON.stringify(referrals));
        res.end();
        referrals=[];
    });
}

module.exports = router;

//var Query = 'SELECT Referrals.userid , jobs.payscale , jobs.JUUID , apply.Application_status , users.UUID , users.username , Referrals.Refcode , referredUsers.refUser FROM referredUsers INNER JOIN Referrals ON Referrals.Refcode = referredUsers.Refcode INNER JOIN users ON referredUsers.refUser = users.UUID LEFT JOIN jobs ON Referrals.jobid = jobs.JUUID LEFT JOIN apply ON users.UUID = apply.userid';