var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var AWS = require('aws-sdk');

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
}); 

var docClient = new AWS.DynamoDB.DocumentClient();
var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var appconfig = require('./Config');
var _connection = appconfig.createConnection;

/*var items = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'
    ];

var batchsize = 9;
    
batchHandler(items, batchsize, 0, response);*/

router.post('/', function(request, response){
    
    /*var items = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'
    ];
    
    batchHandler(items, 0, response);*/
    
    getTokens(function(tokens){
       
        console.log('Tokens are ' + JSON.stringify(tokens, null, 3));
        console.log('Total tokens are ' + tokens.length);
        response.send('Okay');
        
    });
    
});

//function batchHandler(items, batchsize, counter/*, response*/){
//    
//    var iterations = Math.floor(items.length/batchsize) + ((items.length % batchsize) != 0 ? 1 : 0);
//    console.log('No of iterations are ' + JSON.stringify(iterations, null, 3));
//    
//    if(counter == (iterations - 1)){ //Last iteration
//        console.log('Last iteration condition is met');
//        var lastitemindex = items.length;
//    }
//    else{        
//        var lastitemindex = batchsize * (counter + 1);
//    }
//    
//    var batchitems = items.slice(batchsize * counter, lastitemindex);
//    console.log('items after slicing ' + JSON.stringify(items, null, 3));
//    
//    processItems(counter, batchitems, function(err, result){
//       
//        if(err){
//            throw err;
//        }
//        else{
//            
//            if(counter == (iterations - 1)){
//                console.log('Completed');
//                /*response.send('Okay');*/
//            }
//            else{
//                counter++;
//                batchHandler(items, batchsize, counter/*, response*/);
//            }
//            
//        }
//        
//    });
//}

//function processItems(counter, batchItems, callback){
//    
//    console.log('Batch ' + (counter+1) + ' is ' + JSON.stringify(batchItems));
//    callback(null, 'okay');
//}
//
//
//function sendBatchNotifications(sender, message, registrationTokens){
//    
//    sender.send(message, { registrationTokens : batchTokens }, 3 , function (err, response) {
//            if(err){
//                console.error(err);
//                throw err;
//            }
//            else{
//                console.log(response);
//                callback();
//            }
//
//        }); 
//    
//}

/*Function to get the FCM Tokens of all the users from the DynamoDB table. An optional city filter is also catered*/
function getTokens(callback){
    var table = userstbl_ddb;
    
    var params = {
        TableName : table,
        AttributesToGet : ['Fcm_token']
    };
    
    docClient.scan(params , function(error , data){
        if(error){
            console.error(error);
            throw error;
            
        }
        
        var fcmTokens = pushTokens(data.Items);
        
        callback(fcmTokens);
    });
}

/*Function to formulate an array of FCM Tokens as received using getTokens(cities, callback) function*/
function pushTokens(tokens){
    var finalTokens = [];
    
    for(var j=0 ; j<tokens.length ; j++){
        for(var z=0 ; z<tokens[j].Fcm_token.length ; z++){
            finalTokens.push(tokens[j].Fcm_token[z]);
        }
    }
    
    return finalTokens;
}

module.exports = router;