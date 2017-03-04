/*
This script updates the user's application status when a request is issued from the dashboard. If the status recieved is 'FINALISED', the 'Earnings' table has to be updated as well.
*/
var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');

var sendNotification = require('../../Notification-System/notificationFramework');

var appconfig = require('../../Config');
var _connection = appconfig.createConnection;

router.post('/', function(request, response){
    
    var uuid = request.body.uuid;
    var jobid = request.body.jobid;
    var application_status = request.body.applicationstatus;
    var refAmount = request.body.refamount;
    var refcode = request.body.refcode;
    var jobName = request.body.jobname;
    
    console.log('Request is ' + JSON.stringify(request.body, null, 3));
    
    if(application_status == 'Finalised' && refcode != 'none'){
        
        var tableValues = {
            
            paymentStatus : 'Pending',
            referralAmount : refAmount,
            refCode : refcode,
            applieduserid : uuid
        }
        
        _connection.query('INSERT INTO Earnings SET ?', tableValues, function(err, rows){
            
            if (err){
                throw err;
            }
            else{                
                updateAplcnStatus(application_status , uuid , jobid , jobName , response, refcode);
            }            
        });        
    }
    else{
        updateAplcnStatus(application_status , uuid , jobid , jobName , response, refcode);
    }
});

/*
Method to update the application status of an applicant and send him a push notification for the same
*/
function updateAplcnStatus(application_status , uuid , jobid , jobName , response, refcode){
    var uuidArray = [];
    uuidArray.push(uuid);
    
    var applicantNotifData = {
        Category : 'ApplicationStatus',
        Status : application_status,
        JobName : jobName
    };
    
    _connection.query('UPDATE apply SET Application_status = ? WHERE userid = ? AND jobid = ?', [application_status, uuid, jobid], function(err, rows){
        
        if(err){
            throw err;
        }
        else{  
            if(application_status !== 'Buffer'){
                sendNotification.Notification(uuidArray, applicantNotifData, function(){
                    
                    //If refcode is not 'none', send a push notification to referrer as well 
                    if(refcode != 'none'){
                        
                        //extract referrer's full-name and userid to send as parameters to the notification API
                        _connection.query('SELECT Referrals.userid, users.firstname, users.lastname FROM Referrals INNER JOIN users ON Referrals.userid = users.UUID WHERE Refcode = ?', refcode, function(err, data){
                            
                            console.log('Referrer data is ' + JSON.stringify(data, null, 3));
                            
                            uuidArray = [];
                            uuidArray.push(data[0].userid);
                            
                            var referrerNotifData = {
                                Category : 'ReferralApplicationUpdate',
                                Status : application_status,
                                JobName : jobName,
                                Referee : data[0].firstname + " " + data[0].lastname
                            }
                            
                            sendNotification.Notification(uuidArray, referrerNotifData, function(){
                                
                                response.send(true);
                                response.end();
                                
                            });
                            
                        });
                        
                    }
                    else{
                        response.send(true);
                        response.end();
                    }                    
                    
                });
            }
            else{
                response.send(true);
                response.end(); 
            }
        }
    });

}

module.exports = router;