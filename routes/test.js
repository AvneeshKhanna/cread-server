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
//    var title = request.body.title;
    var json = {};
    
    var sql = 'SELECT reg_date FROM datacounts ORDER BY countid DESC LIMIT 3';
    
    _connection.query(sql , function(err,row){
        if(err) throw err;
        
        console.log(row.length);
//        var date = new Date();
//        var din = date.getDate();
//        var hrs = date.getHours();
//        var min = date.getMinutes();
//        
//        console.log('date is ->'+din);
//        console.log('time is ->'+hrs+':'+min);
//        
        var date = new Date(row[0].reg_date+' UTC');
        var istDate = date.getDate() + '/'+ date.getMonth()+1 + '/'+ date.getFullYear();
//        var istTime = date.getHours() +':'+ date.getMinutes() +':'+ date.getSeconds();
//        json.date = istDate;
//        json.time = istTime;
////        var update = date.toString();
////        json.date = update;
//        
//        console.log(date.getDate() + '/'+ date.getMonth()+1 + '/'+ date.getFullYear());
        console.log(istDate);
        response.send(JSON.stringify(json));
        response.end();
    });
});

module.exports = router;