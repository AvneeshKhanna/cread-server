//The first router is to insert data in apply table, when user apply for a job only when user had not applied for a job already
//Second router is to display all jobs to which user have applied to 

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var Promise = require('promise');

var config = require('./Config');
var _connection = config.createConnection;
var applicationSchema = require('./Schema');
var jobApplication = applicationSchema.jobApplication;
var authtokenvalidation = require('./auth-token-management/AuthTokenManager');

var notify = require('./Notification-System/notificationFramework');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function getData(elements){
    return new Promise(function(resolve,reject){
        resolve(elements);
    });
}

router.post('/',function(request,response,next){
    var UUID = request.body.uuid;
    var JUUID = request.body.juuid;
    var refCode = request.body.refcode;
    var auth_key = request.body.authkey;
    
    var application = new jobApplication({userid : UUID , jobid : JUUID , Refcode : refCode , Status : 'Applied' , Application_status : 'Pending'});
    
    var promise = getData(UUID);
    var sqlQuery = 'SELECT aid FROM apply WHERE userid = ? AND jobid = ?';
    
    authtokenvalidation.checkToken(UUID, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            var invalidJson = {};
            invalidJson['tokenstatus'] = 'invalid';
            response.send(JSON.stringify(invalidJson));
            response.end();
        }
        else{
            _connection.query(sqlQuery,[UUID , JUUID], function(error, row){
                if(error) throw error;
         
                promise.then(function(item){
                    console.log(item);
                    return row.length;
                }).
                then(function(item){
                    var validJson = {};
                    if(item == 0){
                        _connection.query('INSERT INTO apply SET ?', application,function(error,result){
                            if(error) throw error;
                    
                            console.log(result);
                            
                            validJson.tokenstatus = 'valid';
                            validJson.applystatus = 'true';
                            response.send(JSON.stringify(validJson));
                            response.end();
                            
                            //Since the notification is to be sent to the referrer and the server response to be sent to applicant,
                            // we can call the below functions AFTER response.send() and response.end() functions have been called
                            if(refCode != 'none'){
                                sendNotifToReferrer(refCode, UUID);
                            }
                            
                        });
                    }
                    else{
                        validJson.tokenstatus = 'valid';
                        validJson.applystatus = 'false';
                        response.send(JSON.stringify(validJson));
                        response.end();
                    }
                }).
                catch(function(err){
                    console.log(err);
                })
            });
        }
    });
});

/*
Sending a push notification to the referrer
*/
function sendNotifToReferrer(refcode, applicant_userid){
    
    _connection.query('SELECT Referrals.userid, referredUsers.refUser AS referred_userid, users.firstname, users.lastname, jobs.title ' +
        'FROM referredUsers INNER JOIN users ON referredUsers.refUser = users.UUID ' +
        'INNER JOIN Referrals ON Referrals.Refcode = referredUsers.Refcode ' +
        'INNER JOIN jobs ON Referrals.jobid = jobs.JUUID WHERE Referrals.Refcode = ?', refcode, function(err, data){
        
        if(err){
            throw err;
        }
        else{
            
            console.log('Query data from sendNotifToReferrer is ' + JSON.stringify(data, null, 3));

            var referredUserIndex = null;

            var uuidArray = new Array();
            for(var i=0; i<data.length; i++){
                if(applicant_userid == data[i].referred_userid){
                    referredUserIndex = i;
                    uuidArray.push(data[i].userid); //Referrer's userid
                    break;
                }
            }
            
            var notifData = {
                Category : 'ReferralApplicationUpdate',
                Status : 'Pending',
                JobName : data[referredUserIndex].title,
                Referee : data[referredUserIndex].firstname + " " + data[referredUserIndex].lastname
            };
            
            notify.notification(uuidArray, notifData, function(err){

                if(err){
                    console.error(err);
                    throw err;
                }
               
                //End of flow
                
            });
            
        }
        
    });
    
}

router.post('/applications',function(request,response,next){
    var uuid = request.body.uuid;
    var auth_key = request.body.authkey;
    var ApplicationForms = new Array();
    
    var sqlQuery = 'SELECT jobs.title,jobs.companyname,jobs.Active,apply.Application_status FROM apply INNER JOIN jobs ON jobs.JUUID = apply.jobid WHERE apply.userid = ? AND apply.Status = ?';
    
    var responseData = {};
    responseData.tokenstatus = {};
    responseData.applicationsdata = new Array();
    
    console.log('Request in jobApplications is ' + JSON.stringify(request.body, null, 3));
    
    authtokenvalidation.checkToken(uuid, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            responseData.tokenstatus = 'invalid';
            response.send(responseData);
            response.end();
        }
        else{
            responseData.tokenstatus = 'valid';
            
            _connection.query(sqlQuery,[uuid,'Applied'],function(error,row){
                
                console.log('Users applications are ' + JSON.stringify(row, null, 3));
                
                if (error) throw error;
            
                for(var j=0 ; j<row.length ; j++){
                    var localJson = {};
                    localJson['title'] = row[j].title;
                    localJson['companyname'] = row[j].companyname;
                    localJson['status'] = row[j].Application_status;
                    localJson['active'] = JSON.stringify(row[j].Active);
            
                    ApplicationForms.push(localJson);
                }
                
                responseData.applicationsdata = ApplicationForms;
        
                response.send(responseData);
                response.end();
        
                ApplicationForms=[];
            });   
        }
    });
});

module.exports = router;
