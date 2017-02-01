var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var AWS = require('aws-sdk');

var config = require('../Config');
//testing on dummy db
var _connection = config.createConnection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/', function(request,response){
    var columnName = request.body.columnName;
    var sqlQuery;
    var globalJson = {};
    var localJson = {};
    var graphArray = [];
    var graphDate = [];
    
    if(columnName == 'totalApplications'){
        sqlQuery = 'SELECT reg_date,totalReferralApps+totalWoReferralApps AS totalApplications FROM analyticsData ORDER BY countid DESC LIMIT 10';
    }
    else if(columnName == 'totalSelections'){
        sqlQuery = 'SELECT reg_date,totalWoReferralSelections+totalRefSelections AS totalSelections FROM analyticsData ORDER BY countid DESC LIMIT 10';
    }
    else if(columnName == 'totalShortlisted'){
        sqlQuery = 'SELECT reg_date,nonreferralShortlisted+referralShortlisted AS totalShortlisted FROM analyticsData ORDER BY countid DESC LIMIT 10'
    }
    else{
        sqlQuery = 'SELECT '+columnName+',reg_date FROM analyticsData ORDER BY countid DESC LIMIT 10';
    }
    
    _connection.query(sqlQuery , function(error,result){
        if(error) throw error;
        
        console.log(result);
        
        for(var i=result.length-1 ; i>-1 ; i--){
            var date = new Date(result[i].reg_date+' UTC');
            var istDate = date.getDate() + '/'+ date.getMonth()+1;
            
            graphDate.push(istDate);
            graphArray.push(result[i][columnName]);
        }
        
        localJson.Data = graphArray;
        localJson.Dates = graphDate;
        globalJson.Graph = localJson;
        localJson = {};
        
        console.log('The array is ->' +graphArray);
        
        response.send(JSON.stringify(globalJson));
        response.end();
    });
});

module.exports = router;