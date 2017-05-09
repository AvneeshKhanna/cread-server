/*
This script updates the user's application status when a request is issued from the dashboard. If the status recieved is 'FINALISED', the 'Earnings' table has to be updated as well.
*/
var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');

var sendNotification = require('../../../Notification-System/notificationFramework');

var appconfig = require('../../../Config');
var _connection = appconfig.createConnection;

var application_status;

router.post('/', function(request, response){
    
    var uuid = request.body.uuid;
    var jobid = request.body.jobid;
    application_status = request.body.applicationstatus;
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
        };
        
        _connection.query('INSERT INTO Earnings SET ?', tableValues, function(err, rows){
            
            if (err){
                throw err;
            }
            else{                
                updateAplcnStatus(application_status , uuid , jobid , jobName , refcode, response);
            }            
        });        
    }
    else{
        updateAplcnStatus(application_status , uuid , jobid , jobName , refcode, response);
    }
});

/*
Method to update the application status of an applicant and send him a push notification for the same
*/
function updateAplcnStatus(application_status , uuid , jobid , jobName , refcode, response){
    var uuidArray = [];
    uuidArray.push(uuid);
    
    var notificationData = {
        Category : 'ApplicationStatus',
        Status : application_status,
        JobName : jobName
    };
    
    _connection.query('UPDATE apply SET Application_status = ? WHERE userid = ? AND jobid = ?', [application_status, uuid, jobid], function(err, rows){
        
        if(err){
            throw err;
        }
        else{
            /*if(application_status !== 'Buffer'){
                sendNotification.Notification(uuidArray , notificationData , function(){
                    response.send(true);
                    response.end(); 
                });
            }
            else{
                response.send(true);
                response.end(); 
            }*/
            sendNotification.Notification(uuidArray , notificationData , function(){
                response.send(true);
                response.end();
            });

            //Since the notification is to be sent to the referrer and the server response to be sent to
            // applicant, we can call the below functions AFTER response.send() and response.end()
            // functions have been called
            if(refcode != 'none'){
                sendNotifToReferrer(refcode, uuid);
            }
        }
    });

}

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

            var uuidArray = new Array();

            var referredUserIndex = null;

            for(var i=0; i<data.length; i++){
                if(applicant_userid == data[i].referred_userid){
                    referredUserIndex = i;
                    uuidArray.push(data[i].userid); //Referrer's userid
                    console.log('UUID Array for referrer notification is ' + JSON.stringify(uuidArray, null, 3));
                    break;
                }
            }

            var notifData = {
                Category : 'ReferralApplicationUpdate',
                Status : application_status,
                JobName : data[referredUserIndex].title,
                Referee : data[referredUserIndex].firstname + " " + data[referredUserIndex].lastname
            };

            sendNotification.Notification(uuidArray, notifData, function(){

                //End of flow

            });

        }

    });

}

module.exports = router;