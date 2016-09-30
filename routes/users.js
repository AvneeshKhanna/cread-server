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
    var firstname = request.body.firstname;
    var lastname = request.body.lastname;
    var password = request.body.password;
    var phoneNo = request.body.conatctnumber;
    var emailid = request.body.emailid;
    var key = firstname+password;
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
        
                response.send(JSON.stringify(localJson));
                response.end();
            });
        }
    });
});

router.post('/login' , function(request,response,next){
    var phoneNo = request.body.conatctnumber;
    var password = request.body.password;
    var localJson ={};
    _connection.query('SELECT Auth_key,UUID FROM users WHERE phoneNo=? AND password=?',[phoneNo , password],function(err,result){
        if (err) throw err;
        
        else if(result.length == 0){
            var localJson = {};
            localJson['authtoken'] = 'false';
            localJson['uuid'] = 'false';
            response.send(JSON.stringify(localJson));
            response.end();
        }
        
        else{
            localJson['uuid'] = result[0].UUID;
            localJson['token'] = result[0].Auth_key;
//            response.send(result[0].Auth_key);
            response.send(JSON.stringify(localJson));
            response.end();
        }
    });
});

module.exports = router;

