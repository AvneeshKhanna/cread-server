var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');
var AWS = require('aws-sdk');
var bodyParser = require('body-parser');

var config = require('../Config');
var _connection = config.createConnection;
var authtokenvalidation = require('../auth-token-management/AuthTokenManager');   //module to authenticate user before making request

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/', function(request, response){
    var uuid = request.body.uuid;
    var auth_key = request.body.authkey;
    var firstName = request.body.firstname;
    var lastName = request.body.lastname;
    var emailId = request.body.emailid;
    
    authtokenvalidation.checkToken(uuid, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            var invalidJson = {};
            invalidJson['tokenstatus'] = 'Invalid';
            response.send(JSON.stringify(invalidJson));
            response.end();
        }
        
        else{
            var updateProfile = {firstname : firstName , lastname : lastName , email : emailId};
            
            _connection.query('UPDATE users SET ? WHERE UUID = ?',[updateProfile , uuid] , function(error,row){
                if(error) throw error;
                
                console.log(row);
                response.send(true);
                response.end();
            });
        }
    });
    
});

module.exports = router;

