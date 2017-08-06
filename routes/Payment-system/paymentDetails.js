//This page is designed to display earnings and pending amount in payment page and also to response back the user bank details

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var AWS = require('aws-sdk');
var dynamo_marshal = require('dynamodb-marshaler');    //package to convert plain JS/JSON objects to DynamoDB JSON
var authtokenvalidation = require('../auth-token-management/AuthTokenManager');   //module to authenticate user before making request

var config = require('../Config');
var _connection = config.createConnection;
//var bankdetailsArray = new Array();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

AWS.config.region = 'ap-northeast-1';
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

router.post('/',function(request, response, next){
    var uuid = request.body.uuid;
    var auth_key = request.body.authkey;
    
    var sqlQuery = 'SELECT referralAmount, paymentStatus FROM Earnings INNER JOIN Referrals ON Referrals.Refcode = Earnings.refCode WHERE Referrals.userid=?';
    var approvedUser = 0;
    var pendingUser =0;
    var localJson = {};
    
    console.log(uuid);
    
    authtokenvalidation.checkToken(uuid, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            var invalidJson = {};
            invalidJson['tokenstatus'] = 'invalid';
            response.send(invalidJson);
            response.end();
        }
        
        else{            
            localJson['tokenstatus'] = 'valid';
            _connection.query(sqlQuery,uuid,function(error,result){
        
                if(error) throw error;

                for(var i=0 ; i<result.length ; i++){
                    if(result[i].paymentStatus == 'Pending'){
                        pendingUser = pendingUser+result[i].referralAmount;
                    }
                    else{
                        approvedUser = approvedUser+result[i].referralAmount;
                    }
                }

                console.log('The earnings: ' + approvedUser);
                console.log('The pendings: ' + pendingUser);
                localJson['earnings'] = approvedUser;
                localJson['pending'] = pendingUser;

                getbankDetails(response, localJson, uuid);
            });
        }
    });
});

function getbankDetails(response, localjson, uuid){
    var params = {
        TableName: userstbl_ddb,
        Key: {
            UUID: uuid
        }
    }
    
    docClient.get(params, function(err, data) {
        if (err) {
            throw err;
        }
        
        console.log(data.Item.BankDetails);
        //bankdetailsArray.push(data.Item.Bank_details);
        
        if(data.Item.BankDetails){
            
            localjson['bankDetails'] = data.Item.BankDetails;
            localjson['bankStatus'] = true;
            console.log("Bank Status " + localjson.bankStatus);
            response.send(JSON.stringify(localjson));
            response.end();
            
        }
        else{
            
            localjson['bankStatus'] = false;            
            console.log("Bank Status " + localjson.bankStatus);
            response.send(JSON.stringify(localjson));
            response.end();
            
        }        
        
        //bankdetailsArray = [];
    });
}

module.exports = router;