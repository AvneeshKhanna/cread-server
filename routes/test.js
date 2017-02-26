var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');

var appconfig = require('./Config');
var _connection = appconfig.createConnection;

router.post('/', function(request, response){
    
    //var formattedDate = getBacktrackedDate();
    
    _connection.query('SELECT * FROM users WHERE', null, function(err, data){
        
        if(err){
            throw err;
        }
        else{
            console.log(JSON.stringify(data, null, 3));
            response.send(data);
            response.end();
        }
        
    });
    
});

/*Returns the UTC date backtracked to 30 days from the current date in the format: 2010-10-02 14:11:57*/
function getBacktrackedDate(){
    
    var currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 30);    //backtracking 30 days
    currentDate.setDate(currentDate.getUTCDate());      //converting to UTC
    console.log('Threshold date is ' + currentDate.toISOString());
    
    var formattedDate = currentDate.toISOString().replace('T', ' ');
    formattedDate = formattedDate.replace('Z', '');
    formattedDate = formattedDate.slice(0, formattedDate.indexOf('.'));
    
    console.log('Formatted date is ' + formattedDate);
    
    
    return formattedDate;
}

module.exports = router;