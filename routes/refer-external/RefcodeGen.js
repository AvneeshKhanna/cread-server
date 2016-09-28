/*
This module takes care of generating a referral code (if required), storing it in DB and sending it in response whenever a user attempts to refer another user using external referral system.

This script would be invoked when a user tries to refer someone using external referral system.
*/
var express = require('express');
var router = express.Router();

var mysql = require('mysql');

var uuidGenerator = require('uuid');

var connection = mysql.createConnection({
    host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
    user : 'ttrds',
    password : 'amazonpass2015',
    database : 'testdb',
    port : '3306'
});

router.post('/', function (request, response){
    
    var userid = request.body.userid;
    var jobid = request.body.jobid;

    //Check if referral code exists or not
    checkRefCode(userid, jobid, function(send_result){
        
        if(send_result){
            response.send(send_result);
            response.end();
        }
        else{
            response.send('The requested data could not be found');
            response.end();
        }
        
    });
});

//To check if referral code exists or not
function checkRefCode(userid, jobid, onCheck){
    
    connection.query('SELECT * FROM Referrals WHERE userid = ? AND jobid = ?', [userid, jobid], function(err, rows){
        
        if(err){
            console.log('Error');
            onCheck();
        }
        else{
            
            var check_result = {};
            
            //Referral code exists; send it as response
            if(rows[0]){
                
                check_result.refcode = rows[0].Refcode;
                
                //Retrieve company-name and title using jobid from DB
                getJobDetails(jobid, function(jobResult){
                    
                    if(jobResult){
                        
                        check_result.company = jobResult.companyname;
                        check_result.title = jobResult.title;
                    
                        onCheck(check_result);
                    }
                    else{
                        onCheck();
                    }
                    
                });
                
            }
            //Referral code doesn't exists; generate, save and send as response
            else{
                
                var refcode = refcode_genrtr();
                
                var check_result = {};
                
                saveRefDetails(userid, jobid, refcode, function(refdetails){
                    
                    if(refdetails){
                        
                        check_result.refcode = refdetails.Refcode;
                        
                        //Retrieve company-name and title using jobid from DB
                        getJobDetails(refdetails.jobid, function(jobResult){
                    
                            if(jobResult){

                                check_result.company = jobResult.companyname;
                                check_result.title = jobResult.title;

                                onCheck(check_result);
                            }
                            else{
                                onCheck();
                            }
                    
                        });                        
                        
                    }
                    else{
                        onCheck();                        
                    }
                    
                });
            }            
        }        
    });    
}

//Function to simulate random-refcode generator
function refcode_genrtr(){
    
    return uuidGenerator.v4();
    
}

//Function to store referral details into DB
function saveRefDetails(userid, jobid, refcode, onDetailsSaved){
    
    var refDetailsData = {};
    refDetailsData['Refcode'] = refcode;
    refDetailsData['userid'] = userid;
    refDetailsData['jobid'] = jobid;
    
    connection.query('INSERT INTO Referrals SET ?', refDetailsData, function(err, rows){
        
        if(err){
            throw err;
        }
        else{
            
            /*console.log('Row returned after insert query is: ' + rows.Refcode + ' userid: ' + rows.userid);
            onDetailsSaved(rows);*/
            
            connection.query('SELECT * FROM Referrals WHERE Refcode = ?', refDetailsData.Refcode, function(err, rows){
                
                if(err){
                    throw err;
                }
                else{
                    
                    console.log('Row returned after insert query is: ' + rows);
                    onDetailsSaved(rows[0]);
                    
                }              
                
            });              
        }        
    });    
}

//Function to fetch company-name and job-title from DB based on job-id
function getJobDetails(jobid, onDetailsRetreived){
    
    connection.query('SELECT title, companyname FROM jobs WHERE JUUID = ?', [jobid], function(err, rows){
        
        if(err){
            throw err;
        }
        else{
            
            if(rows[0]){
                onDetailsRetreived(rows[0]);
            }
            else{
                onDetailsRetreived();
            }
            
        }
        
    });
    
}

module.exports = router;