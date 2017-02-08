var express = require('express');
var app = express();
var router = express.Router();
var mysql = require('mysql');
var AWS = require('aws-sdk');

var config = require('../../Config');

AWS.config.region = 'ap-northeast-1'; 
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');

var _connection = config.createConnection;

router.get('/',function(request, response){
    var params = {
        TableName : userstbl_ddb,
        AttributesToGet: [
            'UUID',
            'Name',
            'Email_Id',
            'ProfilePicURL',
            'ContactNumber',
            'City'
        ]
    };
    
    docClient.scan(params, function(err, data) {
        if (err) throw err;
        
        getUsersOrderedbyRegDate(data, response);
        
    });
});

//Testing
//test();

//This function is used to get the ordered (ordered by reg-date) list of users from RDS using SQL 
function getUsersOrderedbyRegDate(data, response){
    
    _connection.query('SELECT UUID, reg_date FROM users ORDER BY reg_date DESC', null, function(err, rows){
        
        console.log(JSON.stringify(rows, null, 3));
        console.log("Count of data from RDS is " + rows.length);
        console.log("data from DynamoDB is: " + JSON.stringify(data, null, 3));
        reorderList(data.Items, rows, data, response);
        
    });
}

/*
Function to arrange the list of users by decreasing order of timestamp (latest being on top)
@param masterList: List of users acquired from DynamoDB
@param orderedsubList: List of ordered users acquired by SQL Server (ORDER BY reg_date DESC)
@param data: This is also the list of users acquired from DynamoDB. However, it contains some extra data such as 'Count', 'ScannedCount'
@param response: The parameter in the callback function of 'router.get()'
*/ 
function reorderList(masterList, orderedsubList, data, response){
    
    var mappedOrderedList = orderedsubList.map(function(x){return x.UUID});
    console.log("Unordered masterList is " + JSON.stringify(masterList, null, 3));
    
    for(var current = 0; current<mappedOrderedList.length; current++){
        
        var ordrdIndex = masterList.map(function(x){return x.UUID}).indexOf(mappedOrderedList[current]);
        swap(current, ordrdIndex, masterList);
        masterList[current].reg_date = orderedsubList[current].reg_date;
    }
    
    console.log("masterList after sorting is: " + JSON.stringify(masterList, null, 3));
    data.Items = masterList;
    
    response.send(data);
    response.end('No data');
}

//For testing
/*function test(){
    
    var oList = [
        {
            A : "A1",
            B : "B1",
            C: "C1"
        },
        {
            A : "A2",
            B : "B2",
            C: "C2"
        },
        {
            A : "A3",
            B : "B3",
            C: "C3"
        } ,
        {
            A : "A4",
            B : "B4",
            C: "C4"
        },
        {
            A : "A5",
            B : "B5",
            C: "C5"
        },
        {
            A : "A6",
            B : "B6",
            C: "C6"
        },
        {
            A : "A7",
            B : "B7",
            C: "C7"
        } ,
        {
            A : "A8",
            B : "B8",
            C: "C8"
        }
    ]
    
    var mList = [
        {
            A : "A2",
            B : "B2"
        },
        {
            A : "A3",
            B : "B3"
        },
        {
            A : "A5",
            B : "B5"
        },
        {
            A : "A4",
            B : "B4"
        },
        {
            A : "A1",
            B : "B1"
        },
        {
            A : "A8",
            B : "B8"
        },
        {
            A : "A7",
            B : "B7"
        },
        {
            A : "A6",
            B : "B6"
        }
    ]
    
    for(var current = 0; current<oList.length; current++){
        
        var ordrdIndex = mList.map(function(x){return x.A}).indexOf(oList[current].A);
        swap(current, ordrdIndex, mList);
        console.log("orderedIndex is " + ordrdIndex);
        
        mList[ordrdIndex].C = oList[ordrdIndex].C;
        
    }
    
    console.log("mList is " + JSON.stringify(mList, null, 3));
    console.log("oList is " + JSON.stringify(oList, null, 3));
    
}*/

function swap(from, to, list){
    var tmp = list[to];
    list[to] = list[from];
    list[from] = tmp;    
}

module.exports = router;