/*
This module stores respective entries into 'apply' table and 'referredUsers' table once the user clicks on 'Apply' button in a job
 posting using external-referral.
*/

var express = require('express');
var router = express.Router();
var mysql = require('mysql');

var authtokenvalidation = require('../authtokenValidation');   //module to authenticate user before making request
var notify = require('../Notification-System/notificationFramework');

var config = require('../Config');
var connection = config.createConnection;

router.post('/', function(request, response){
    var userid = request.body.userid_referred;
    var auth_key = request.body.authkey;
    
    console.log('request data is ' + JSON.stringify(request.body));
    
    var apply_data = {};    
    apply_data.userid = request.body.userid_referred;
    apply_data.Refcode = request.body.refcode;
    apply_data.jobid = request.body.jobid;
    apply_data.Status = /*request.body.status*/"Applied";
    apply_data.Application_status = /*request.body.application_status*/"Pending";
    
    console.log('apply_data is ' + JSON.stringify(apply_data));
    
    authtokenvalidation.checkToken(userid, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            var invalidJson = {};
            invalidJson['tokenstatus'] = 'invalid';
            response.send(JSON.stringify(invalidJson));
            response.end();
        }
        
        else{
            checkApplyTable(apply_data , function(applyTableResult){
                var validJson = {};
                
                if(applyTableResult == null){
                    saveInApplyTbl(apply_data, function(onApplyResult){
//                    var validJson = {};
                
                        if(onApplyResult){
                            var refusers_data = {};
                            refusers_data.Refcode = request.body.refcode;
                            refusers_data.refUser = request.body.userid_referred;
                
                            saveInRefUsersTbl(refusers_data, function(onSaveRefUsrsResult){
                                if(onSaveRefUsrsResult){
                                    validJson['tokenstatus'] = 'valid';
                                    validJson['status'] = 'OK';
                                    response.send(JSON.stringify(validJson));
                                    response.end();
                                    
                                    //Since the notification is to be sent to the referrer and the server response to be sent to
                                    // applicant, we can call the below functions AFTER response.send() and response.end()
                                    // functions have been called
                                    sendNotifToReferrer(request.body.refcode, userid);
                                }
                                else{
                                //response.send('The referral could not be registered due to some reason');
                                    validJson['tokenstatus'] = 'valid';
                                    validJson['status'] = 'error';
                                    response.send(JSON.stringify(validJson));
                                    response.end();
                                }
                            });
                        }
                        else{
                            //response.send('The application could not be registered due to some reason');
                            validJson['tokenstatus'] = 'valid';
                            validJson['status'] = 'error';
                            response.send(validJson);
                            response.end();
                        }        
                    });
                }
                else{
                    validJson['tokenstatus'] = 'valid';
                    validJson['status'] = 'userexists';
                    response.send(JSON.stringify(validJson));
                    response.end();
                }
            });
        }
    });
});

/*Used to save data into 'apply' table*/
function saveInApplyTbl(data, onApplySave){
    
    connection.query('INSERT INTO apply SET ?', data, function(err, row){
        
        if(err){
            throw err;
        }
        else{
            
            if(row){
                onApplySave(row);
            }
            else{
                onApplySave(null);
            }            
        }        
    });
    
}

/*Used to save data into 'referredUsers' table*/
function saveInRefUsersTbl(data, onRefUsersSave){
    
    connection.query('INSERT INTO referredUsers SET ?', data, function(err, row){
        
        if(err){
            throw err;
        }
        else{
            
            if(row){
                onRefUsersSave(row);
            }
            else{
                onRefUsersSave(null);
            }            
        }
        
    });
    
}

//this function checks if user has already applied for a job or not 
function checkApplyTable(data,callback){
    connection.query('SELECT aid FROM apply WHERE userid = ? AND jobid = ?',[data.userid,data.jobid],function(error,row){
        if(error) throw error;
        
        else if(row.length !== 0){
            callback(row.length);
        }
        else{
            callback(null);
        }
    });
}

/*
Sending a push notification to the referrer
*/
function sendNotifToReferrer(refcode, applicant_userid){
    
    connection.query('SELECT Referrals.userid, referredUsers.refUser AS referred_userid, users.firstname, users.lastname, jobs.title ' +
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

module.exports = router;