var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');

var AWS = require('aws-sdk');

var appconfig = require('../../../Config');
var _connection = appconfig.createConnection;

/*AWS.config.region = 'ap-northeast-1'; 
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();*/

router.post('/', function(request, response){
    
    var juid = request.body.juid;
        
    console.log('juid in response is' + juid);
    
    _connection.query('SELECT DISTINCT users.UUID, users.firstname, users.lastname, users.email, users.phoneNo, apply.aid AS apply_id, apply.Application_status, apply.Refcode, apply.Seen, apply.Note FROM users INNER JOIN apply ON apply.userid = users.UUID WHERE apply.jobid = ? ORDER BY apply.reg_date DESC', juid, function(err, appliedRows){
        
        if (err){
            throw err;
        }
        
        console.log('appliedRows are ' + JSON.stringify(appliedRows, null, 3));
        var applicationsData = new Array();
        
        var counter = 0;
        console.log('applicationsData before is ' + JSON.stringify(applicationsData));
        
        console.log('applicationsData after dummy data is ' + JSON.stringify(applicationsData));
        
        mapAppliedData(appliedRows, applicationsData, counter, response);
        
    });
    
});

/*
This functions retreive's the referrer's data by checking the refcode from applied-users data in a separate array and maps the referrer's data
to the respective applicant's data thus, creating a single array
*/
function mapAppliedData(appliedRows, applicationsData, counter/*, callback*/, response){
        
        if(counter<appliedRows.length){
            
            applicationsData[counter] = {};
            applicationsData[counter].Seen = appliedRows[counter].Seen;
            applicationsData[counter].Note = appliedRows[counter].Note;
            applicationsData[counter].apply_id = appliedRows[counter].apply_id;
            applicationsData[counter].appliedUser = {
                        UUID : appliedRows[counter].UUID,
                        Name : appliedRows[counter].firstname + ' ' + appliedRows[counter].lastname,
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
                
                console.log('Refcode before querying is ' + appliedRows[counter].Refcode);                
                
                _connection.query('SELECT users.UUID, users.firstname, users.lastname, users.email, users.phoneNo FROM users INNER JOIN Referrals ON users.UUID = Referrals.userid WHERE Referrals.Refcode = ?', appliedRows[counter].Refcode, function(err, referRows){
                    
                    if(err){
                        throw err;
                    }
                    else{
                        console.log('Data after querying is ' + JSON.stringify(referRows, null, 3));
                        
                        //This case is incorporated to cater an anamoly in the data which occured because a user profile was incorrectly deleted manually
                        if(referRows.length == 0){
                            //Do nothing
                        }
                        else{
                            applicationsData[counter].referrerUser = {
                            UUID : referRows[0].UUID,
                            Name : referRows[0].firstname + ' ' + referRows[0].lastname,
                            Email : referRows[0].email,
                            Phone : referRows[0].phoneNo
                            };
                        }                        
                        
                        counter++;
                        mapAppliedData(appliedRows, applicationsData, counter, response);                        
                    }            
                });
            }            
        }
        else{
            console.log('Response is ' + JSON.stringify(applicationsData, null, 3));
            response.send(applicationsData);
        }
    
};

/*
For marking job-applications as seen
*/
router.post('/mark-seen', function(request, response){
    
    var juuid = request.body.juuid;
    var uuidarray = request.body.uuidarray;
    
    console.log('Request is ' + JSON.stringify(request.body, null, 3));
    
    _connection.query('UPDATE apply SET Seen = ? WHERE jobid =? AND userid IN (?)', ['1', juuid, uuidarray], function(err, data){

        if(err){
            console.error(err);
            throw err;
        }
        
        response.send(true);
        response.end();
        
    });
    
    
});

router.post('/update-note', function (request, response) {

    var note = request.body.Note;
    var apply_id = request.body.apply_id;

    console.log('Request is ' + JSON.stringify(request.body));

    _connection.query('UPDATE apply SET Note = ? WHERE aid = ?', [note, apply_id], function (err, result) {

        if(err){
            console.error(err);
            throw err;
        }
        else{

            response.send(true);
            response.end();

        }

    });

});

module.exports = router;