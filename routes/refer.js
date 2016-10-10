//This page is executed when user make a referrals for a job to its contacts

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');

var jobApplySchema = require('./Schema');
var config = require('./Config');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var _jobApply = jobApplySchema.jobApply;
var _connection = config.createConnection;


var userStatus = new Array();
var validUsers = new Array();

router.post('/', function(request,response,next){
    var userId = request.body.uuid;
    var jobId = request.body.juuid;
    var referedUsers = request.body.referred_users;
    
    var date = new Date();
    var refCode = date.getSeconds()+'-'+userId; 
    console.log(referedUsers);
    
    var sqlQuery = 'SELECT userid,Status FROM apply WHERE userid=? AND jobid=?';
    
    var index = 0;    
    
    function myFunc(){
        
        if(index == referedUsers.length){
            referrals(userId,jobId,refCode);
            referredTable(validUsers,refCode);
            var localJson={};
            localJson['Status'] = userStatus;
            console.log(localJson);
            response.send(JSON.stringify(localJson));                                
            response.end();
            userStatus=[];
            validUsers=[];
            return ;
        }
        else{
            
            var item = referedUsers[index];
            
            _connection.query(sqlQuery, [item , jobId], function(error, row){
                index++;
                
                if(error) throw error;
                
                else if(row.length == 0){
//                    checkreferredUsers(userId,jobId,item);
                    refUsers(item);
                    myFunc();
                }
                else{
                    rejectedUsers(item, index, referedUsers.length, row[0].Status);
                    myFunc();
                }
            });
        }        
        
    }
    
    myFunc();
});

var refUsers = function(item){
    userStatus.push('Success');
    validUsers.push(item);
}

var rejectedUsers = function(item,index,referals,status){
    userStatus.push(status);
}

var referrals = function(uid,jid,refcode){
    var entry = {Refcode : refcode , userid : uid , jobid : jid};
            
    _connection.query('INSERT INTO Referrals SET ?', entry , function(err,res){
        if(err){
            return err;
        }
    });
}

function referredTable(validusers,refcode){
    validusers.forEach(function(item){
        var row = {Refcode : refcode , refUser : item};
    
        _connection.query('INSERT INTO referredUsers SET ?',row,function(error,result){
            if(error) throw error;
        
            console.log(result);
        });
    });
}

module.exports = router;
