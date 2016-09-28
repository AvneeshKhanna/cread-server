var express = require('express');
var app = express();
var router = express.Router();
var expressJwt = require('express-jwt');
var Jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var passport = require('passport');
var localStrategy = require('passport-local');
var mysql = require('mysql');

var userSchema = require('./Schema');
var _auth = require('./Authentication');
var config = require('./Config');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var _User = userSchema.User;
var _connection = config.createConnection;
config.connectDb();

//we use res.send when data is to be send once only and res.write used when we have to send multiple data to client 

router.post('/register', function(request,response,next){
    var uuid = request.body.uuid;
    var username = request.body.username;
    var password = request.body.password;
    var phoneNo = request.body.mobile;
    var key = username+password;
    //checking if user already exists in db use deasync
    _connection.query('SELECT UUID FROM users WHERE username = ?',username,function(error,row){
        if (error) throw error;
        
        else if (row.length == 1){
            response.send('false');
            response.end();
        }
        
        else{
            var Id = _auth.getToken(key);
            var user = new _User({UUID : uuid , username : username , password : password , firstname : 'gaurav' , lastname : 'sharma' , email :'gaurav@gmail.com' , phoneNo : phoneNo , address : 'home' , age : '20' , Auth_key : Id });
            _connection.query('INSERT INTO users SET ?', user,function(err,result){
                if (err) throw err;
        
                response.send(Id);
                response.end();
            });
        }
    });
});

router.post('/login' , function(request,response,next){
    var username = request.body.username;
    var password = request.body.password;
    _connection.query('SELECT Auth_key FROM users WHERE username=? AND password=?',[username , password],function(err,result){
        if (err) throw err;
        
        else if(result.length == 0){
            response.send('false');
            response.end();
        }
        
        else{
            response.send(result[0].Auth_key);
            response.end();
        }
    });
});

module.exports = router;

