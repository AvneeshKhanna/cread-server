var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');

var config = require('./Config');
var _connection = config.createConnection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/',function(request,response,next){
    var authKey = request.body.authtoken;
    var uuid = request.body.uuid;
    
    var authQuery = 'SELECT UUID FROM users WHERE UUID=? AND Auth_key=?';
    
    _connection.query(authQuery,[uuid,authKey],function(error,result){
        if(error) throw error;
        
        var resultLength = result.length;
        
        if(resultLength == 0){
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
    
    _connection.query(authQuery,[uuid,auth_key],function(error,row){
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