/*
This script is used to send the applications to the applications-log screen at the dashboard
*/
var express = require('express');
var app = express();
var router = express.Router();

var mysql = require('mysql');

var AWS = require('aws-sdk');

var appconfig = require('../../Config');
var _connection = appconfig.createConnection;

router.get('/', function(request, response){
    
    _connection.query('SELECT DISTINCT users.UUID, users.firstname, users.lastname, jobs.JUUID, jobs.title, jobs.RefAmount, apply.Application_status, apply.Refcode, apply.reg_date FROM users INNER JOIN apply ON apply.userid = users.UUID INNER JOIN jobs ON apply.jobid=jobs.JUUID ORDER BY apply.reg_date DESC LIMIT 25', null, function(err, appliedRows){
        
        if (err){
            throw err;
        }
        
        console.log('appliedRows are ' + JSON.stringify(appliedRows, null, 3));
        var applicationsData = new Array();
        
        var counter = 0;
        console.log('applicationsData before is ' + JSON.stringify(applicationsData));
        
        mapAppliedData(appliedRows, applicationsData, counter, response);
        
    });
    
});

/*
Function to map all the applicant's data to the respective referrer's data (if applicable)
*/
function mapAppliedData(appliedRows, applicationsData, counter/*, callback*/, response){
        
        if(counter<appliedRows.length){
            
            applicationsData[counter] = {};
            applicationsData[counter].reg_date = appliedRows[counter].reg_date;
            applicationsData[counter].job = {
                JUUID : appliedRows[counter].JUUID,
                title : appliedRows[counter].title,
                RefAmount : appliedRows[counter].RefAmount
            };
            applicationsData[counter].appliedUser = {
                        UUID : appliedRows[counter].UUID,
                        Name : appliedRows[counter].firstname + ' ' + appliedRows[counter].lastname
                    };
        
            //applicationsData[counter].refCode = appliedRows[counter].Refcode;
            
            console.log('applicationsData after is ' + JSON.stringify(applicationsData, null, 3));
            
            if(appliedRows[counter].refCode == 'none'){
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
                            Name : referRows[0].firstname + ' ' + referRows[0].lastname
                            };
                        }                        
                        
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
    
};

module.exports = router;