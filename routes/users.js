var express = require('express');
var app = express();
var router = express.Router();
var expressJwt = require('express-jwt');
var Jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var passport = require('passport');
var localStrategy = require('passport-local');
var mysql = require('mysql');
var uuidGenerator = require('uuid');
var AWS = require('aws-sdk');

var userSchema = require('./Schema');
var _auth = require('./Authentication');
var config = require('./Config');
var notify = require('./Notification-System/notify');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
}); 

var docClient = new AWS.DynamoDB.DocumentClient();
var _User = userSchema.User;
var _connection = config.createConnection;
config.connectDb();

//we use res.send when data is to be send once only and res.write used when we have to send multiple data to client 

router.post('/register', function(request,response,next){
    var firstname = request.body.firstname;
    var lastname = request.body.lastname;
    var password = request.body.password;
    var phoneNo = request.body.contactnumber;
    var emailid = request.body.emailid;
    var fcmToken = request.body.fcmtoken;
    var key = firstname+password+phoneNo;
    var name = firstname+' '+lastname;
        
    //checking if user already exists in db use deasync
    _connection.query('SELECT UUID FROM users WHERE phoneNo=?',[phoneNo],function(error,row){
        if (error) throw error;
        
        else if (row.length == 1){
            var localJson = {};
            localJson['authtoken'] = 'false';
            localJson['uuid'] = 'false';
            response.send(JSON.stringify(localJson));
            response.end();
        }
        
        else{
            var localJson = {};
            var uuid = uuidGenerator.v4();
            var Id = _auth.getToken(key);
            localJson['authtoken'] = Id;
            localJson['uuid'] = uuid;
            var user = new _User({UUID : uuid , username : firstname , password : password , firstname : firstname , lastname : lastname , email : emailid , phoneNo : phoneNo , Auth_key : Id });
            
            _connection.query('INSERT INTO users SET ?',user,function(err,result){
                if (err) throw err;
                
                notify.registerFCM(uuid , fcmToken , localJson , name , emailid , phoneNo , response);
            }); 
        }
    });
});

router.post('/login' , function(request,response,next){
    var phoneNo = request.body.contactnumber;
    var password = request.body.password;
//<<<<<<< Updated upstream
    var fcmtoken  = request.body.fcmtoken;
    
    _connection.query('SELECT Auth_key,UUID FROM users WHERE phoneNo=? AND password=?',[phoneNo , password],function(err,result){
        var localJson = {};
        if (err) throw err;
        
        else if(result.length == 0){
            localJson['authtoken'] = 'false';
            localJson['uuid'] = 'false';
            response.send(JSON.stringify(localJson));
            response.end();
        }
        
        else{
            localJson['uuid'] = result[0].UUID;
            localJson['authtoken'] = result[0].Auth_key;
//            response.send(result[0].Auth_key);
            notify.loginFCM(result[0].UUID , fcmtoken , localJson , response);
        }
    });
});

router.post('/logout' , function(request,response,next){
    var uuid = request.body.uuid;
    var fcmToken = request.body.fcmtoken;
    var table = 'User_Profile';
    
    var deleteParams = {
        TableName : table,
        Key : {
            UUID : uuid
        },
        ConditionExpression : "Fcm_token == :val",
        ExpressionAttributeValues : {
            ':val' : fcmToken
        }
//        AttributeUpdates : {
//            Fcm_token : {
//                Action : 'DELETE', 
//                Value : [fcmToken]
//            }
//        }
    };  
    
    docClient.delete(deleteParams, function(error, data) {
        if (error) throw error;

        console.log(data);
        response.send('Lgged out');
        response.end();
    });
});
    
module.exports = router;