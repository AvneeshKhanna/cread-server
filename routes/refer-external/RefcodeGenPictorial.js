/*
This module takes care of generating a referral code (if required), storing it in DB and sending it in response whenever a user attempts to refer another user using external referral system.

This script would be invoked when a user tries to refer someone using external referral system.
*/
var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var uuidGenerator = require('uuid');
var Hashids = require('hashids');

var request_client = require('request');

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');
var s3bucket = envconfig.get('s3.bucket');

var AWS = require('aws-sdk');
AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
});

var docClient = new AWS.DynamoDB.DocumentClient();

var authtokenvalidation = require('../auth-token-management/AuthTokenManager');   //module to authenticate user before making request

var config = require('../Config');
var connection = config.createConnection;

var web_api_key = 'AIzaSyC8nnQXBJEsnfxgpIapFDtFDkr62xDLke4';

var rooturl = 'http://marketrecruitserver-env.ap-northeast-1.elasticbeanstalk.com';

router.post('/', function (request, response){
    
    var userid = request.body.userid;
    var jobid = request.body.jobid;
    var auth_key = request.body.authkey;
    var jobname = request.body.jobname;
    var jobsalary = request.body.jobsalary;
    var companyname = request.body.companyname;
    var referrername = request.body.referrername;
    var profilepicurl = request.body.profilepicurl;

    console.log('Request is ' + JSON.stringify(request.body, null, 3));

    //Check if referral code exists or not
    authtokenvalidation.checkToken(userid, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            var invalidJson = {};
            invalidJson['tokenstatus'] = 'invalid';
            response.send(JSON.stringify(invalidJson));
            response.end();
        }
        else{
            checkRefCode(userid, jobid, jobname, companyname, function(send_result){
                if(send_result){
                    send_result.tokenstatus = 'valid';

                    var getParams = {
                        TableName : userstbl_ddb,
                        Key : {
                            UUID : userid
                        },
                        AttributesToGet : [
                            'UUID',
                            'Designation',
                            'PicTemplate'
                        ]
                    };

                    //extracting designation and pictorial-template from DynamoDB
                    docClient.get(getParams, function (err, data) {
                        if(err){
                            console.error(err);
                            throw err;
                        }
                        else {

                            console.log('data from DynamoDB is' + JSON.stringify(data, null, 3));

                            //Shortening Firebase long dynamic link
                            var firebase_request_params = {
                                json: {
                                    longDynamicLink: getLongReferralLink(send_result.refcode, referrername, jobname, companyname,
                                        jobsalary, profilepicurl, data),
                                    suffix: {
                                        option: "UNGUESSABLE"
                                    }
                                }
                            };

                            request_client.post(
                                'https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=' + web_api_key,
                                firebase_request_params,
                                function (error, res, body) {

                                    if (!error && res.statusCode == 200) {

                                        console.log(JSON.stringify(body, null, 3));

                                        send_result.referral_link = body.shortLink;

                                        response.send(send_result);
                                        response.end();
                                    }
                                    else if(error){
                                        console.error(error);
                                        throw error;
                                    }
                                }
                            );
                        }
                    });
                }
                else{
                    response.send('The requested data could not be found');
                    response.end();
                }
        
            });
        }
    });
});

/*
* To check if referral code exists or not
* */
function checkRefCode(userid, jobid, jobname, companyname, onCheck){
    
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
                check_result.company = companyname;//jobResult.companyname;
                check_result.title = jobname;//jobResult.title;

                onCheck(check_result);
                
                //Retrieve company-name and title using jobid from DB
                /*getJobDetails(jobid, function(jobResult){
                    
                    if(jobResult){
                        
                        check_result.company = jobResult.companyname;
                        check_result.title = jobResult.title;
                    
                        onCheck(check_result);
                    }
                    else{
                        onCheck();
                    }
                    
                });*/
                
            }
            //Referral code doesn't exists; generate, save and send as response
            else{
                
                var refcode = refcode_genrtr(userid , jobid);
                
                check_result = {};
                
                saveRefDetails(userid, jobid, refcode, function(refdetails){
                    
                    if(refdetails){
                        
                        check_result.refcode = refdetails.Refcode;
                        check_result.company = companyname;
                        check_result.title = jobname;

                        onCheck(check_result);
                        
                        //Retrieve company-name and title using jobid from DB
                        /*getJobDetails(refdetails.jobid, function(jobResult){
                    
                            if(jobResult){

                                check_result.company = jobResult.companyname;
                                check_result.title = jobResult.title;

                                onCheck(check_result);
                            }
                            else{
                                onCheck();
                            }
                    
                        });*/
                        
                    }
                    else{
                        onCheck();                        
                    }
                    
                });
            }            
        }        
    });    
}

/*
* Function to simulate random-refcode generation
* */
function refcode_genrtr(uuid , juuid){
    var hashkey = uuid+juuid;
    var hashid = new Hashids(hashkey,10);
    var refCode = hashid.encode(1);
    
    return refCode;
    
}

/*
* Function to store referral details into DB
* */
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

            onDetailsSaved(refDetailsData);
            
            /*connection.query('SELECT * FROM Referrals WHERE Refcode = ?', refDetailsData.Refcode, function(err, rows){
                
                if(err){
                    throw err;
                }
                else{
                    
                    console.log('Rows returned after insert query is: ' + rows);
                    onDetailsSaved(rows[0]);
                    
                }              
                
            });*/
        }        
    });    
}

/*
* Returns the long dynamic firebase link to be used in referring
* */
function getLongReferralLink(refcode, referrername, jobname, companyname, salary, profilepicurl, ddb_data) {

    var deeplink = rooturl + '/referrer-details-web?name='+
        referrername +
        '&job=' +
        jobname +
        '&company=' +
        companyname +
        '&refcode=' +
        refcode +
        '&salary=' +
        salary +
        '&profilepicurl=' +
        profilepicurl;

    if(ddb_data.Item.hasOwnProperty('Designation')){
        deeplink += "&designation=" + ddb_data.Item.Designation;
    }

    if(ddb_data.Item.hasOwnProperty('PicTemplate')){
        deeplink += "&pictoriallink=https://s3-ap-northeast-1.amazonaws.com/" + s3bucket + "/Users/" + ddb_data.Item.UUID + "/Pictorial/" + ddb_data.Item.PicTemplate + ".png"; // + ddb_data.Item.PicTemplate;
    }

    return getFirebaseDynamicLink(deeplink);
}

/*
* Function to wrap the deep link into Firebase components and return
* */
function getFirebaseDynamicLink(deeplink){

    return 'https://d8hxy.app.goo.gl/?link='
        +  encodeURIComponent(deeplink)
        + '&apn='
        + 'in.thetestament.marketrecruit'    //package name
        + '&amv='
        + '49'; //App minimum version code
}

/*
* Function to fetch company-name and job-title from DB based on job-id
* */
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