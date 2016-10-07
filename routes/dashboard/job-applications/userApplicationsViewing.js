var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');

var AWS = require('aws-sdk');

var _connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});

AWS.config.region = 'ap-northeast-1'; 
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

router.post('/', function(request, response){
    
    var juid = request.body.juid;
        
    console.log('juid in response is' + juid);
    
    _connection.query('SELECT users.UUID, users.firstname, users.lastname, users.email, users.phoneNo, apply.Application_status, apply.Refcode FROM users INNER JOIN apply ON apply.userid = users.UUID WHERE apply.jobid = ?', juid, function(err, appliedRows){
        
        if (err){
            throw err;
        }
        
        console.log('Request is ' + JSON.stringify(appliedRows, null, 3));
        var applicationsData = new Array();
        
        var counter = 0;
        console.log('applicationsData before is ' + JSON.stringify(applicationsData));
        
        console.log('applicationsData after dummy data is ' + JSON.stringify(applicationsData));
        
        mapAppliedData(appliedRows, applicationsData, counter, response);
        
    });
    
});

function mapAppliedData(appliedRows, applicationsData, counter/*, callback*/, response){
        
        if(counter<appliedRows.length){
            
            applicationsData[counter] = {};
            applicationsData[counter].appliedUser = {
                        UUID : appliedRows[counter].UUID,
                        Name : appliedRows[counter].firstname + appliedRows[counter].lastname,
                        Email : appliedRows[counter].email,
                        Phone : appliedRows[counter].phoneNo,
                        ApplicationStatus : appliedRows[counter].Application_status
                    };
        
            applicationsData[counter].refCode = appliedRows[counter].Refcode;
            
            console.log('applicationsData after is ' + JSON.stringify(applicationsData, null, 3));
            
            if(applicationsData[counter].refCode == 'none'){
                applicationsData[counter].referrerUser = 'none';
                counter++;
                mapAppliedData(appliedRows, applicationsData, counter, response);
            }
            else{
                
                /*var promise = new Promise(function (resolve, reject) {

                    _connection.query('SELECT users.UUID, users.firstname, users.lastname, users.email, users.phoneNo FROM users INNER JOIN Referrals ON users.UUID = Referrals.userid WHERE Referrals.Refcode = ?', appliedRows[counter].Refcode, function(err, referRows){

                        //console.log('Query Finished ' + cntr);
                         if(err){
                             reject(err);
                         } else {
                             resolve(referRows);
                         }
                     });
                });
                
                
                promise.then(function(referRows){
                    
                    applicationsData[counter] = {};
                        applicationsData[counter].referrerUser = {
                            UUID : referRows[counter].UUID,
                            Name : referRows[counter].firstname + rows[counter].lastname,
                            Email : referRows[counter].email,
                            Phone : referRows[counter].phoneNo
                        };
                    counter++;
                    mapAppliedData(appliedRows, applicationsData, counter);

                }, function(err){
                    console.log('Error occured');
                });*/
                
                console.log('Refcode before querying is ' + appliedRows[counter].Refcode);
                
                
                _connection.query('SELECT users.UUID, users.firstname, users.lastname, users.email, users.phoneNo FROM users INNER JOIN Referrals ON users.UUID = Referrals.userid WHERE Referrals.Refcode = ?', appliedRows[counter].Refcode, function(err, referRows){
                    
                    if(err){
                        throw err;
                    }
                    else{
                        console.log('Data after querying is ' + JSON.stringify(referRows, null, 3));
                        
                        applicationsData[counter].referrerUser = {
                            UUID : referRows[0].UUID,
                            Name : referRows[0].firstname + referRows[0].lastname,
                            Email : referRows[0].email,
                            Phone : referRows[0].phoneNo
                        };
                        counter++;
                        mapAppliedData(appliedRows, applicationsData, counter, response);                        
                    }            
                });
            }            
        }
        else{
            console.log('Response is ' + applicationsData);
            response.send(applicationsData);
        }
    
}

router.post('/test', function(request, response){
    
    var Response = [
        {
              referrerUser : {

                  UUID: "b4e8baad-5057-4e51-95b6-cc1c01182da7",
                  Name: "paras malhotra",
                  Email: "parasm",
                  Phone: "0777"

              },
              appliedUser : {

                  UUID: "b4e8baad-5057-4e51-95b6-cc1c01182da7",
                  Name: "avneesh khanna",
                  Email: "parasm",
                  Phone: "0777",
                  ApplicationStatus: "Pending"

              },
              refCode : "xyz"
        }
    ];
    
    response.send(Response);
    response.end;
    
})

module.exports = router;