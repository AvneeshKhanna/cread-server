var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');

var config = require('./Config');
var _connection = config.createConnection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/', function(request, response){
    var juuid = request.body.juuid;
    
    var sql = 'SELECT * FROM users INNER JOIN apply ON users.UUID = apply.userid INNER JOIN Referrals ON apply.Refcode = Referrals.Refcode WHERE apply.jobid=?';
    
    _connection.query(sql , [juuid] , function(err,row){
        if(err) throw err;
        
        console.log(row);
        response.end('done');
    });
});

module.exports = router;