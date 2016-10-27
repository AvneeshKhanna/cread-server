//This module validate the auth token in every user request.By taking uuid and auth Token as parameters in its arguments. 

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');

var config = require('./Config');
var _connection = config.createConnection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/',function(request, response, next){
    
    console.log('authtokenValidation router ' + JSON.stringify(request.body, null, 3));
    
    var authKey = request.body.authtoken;
    var uuid = request.body.uuid;
    
    var authQuery = 'SELECT UUID FROM users WHERE UUID = ? AND Auth_key=?';
    
    _connection.query(authQuery,[uuid,authKey],function(error,result){
        if(error) throw error;
        
        var resultLength = result.length;
        
        if(result.length == 0){
            response.send(false);
            response.end();
        }
        else{
            response.send(true);
            response.end();
        }
    });
});

var tokenValidation = function(uuid,auth_key, callback){
    var authQuery = 'SELECT UUID FROM users WHERE UUID=? AND Auth_key=?';
    
    _connection.query(authQuery, [uuid,auth_key], function(error, row){
        
        console.log('Row in authtokenValidation.tokenValidation is ' + JSON.stringify(row, null, 3));
        
        if(error) {
            callback(error, null);
        }
        else{
            //checking happens
            var rowLength = row.length;
            callback(null, rowLength);
        }
    });
}

module.exports = router;
module.exports.checkToken = tokenValidation;