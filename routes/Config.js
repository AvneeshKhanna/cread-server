var mysql = require('mysql');
var AWS = require('aws-sdk');

var connection = mysql.createConnection({
			host : 'testrdsinstance.cfjbzkm4dzzx.ap-northeast-1.rds.amazonaws.com',
			user : 'ttrds',
			password : 'amazonpass2015',
			database : 'testdb',
            port : '3306'
		});

var dbConnect = function(){
    connection.connect(function(err,result){
        if (err) throw err
        
        console.log('Connected to rds...');
    });
}

var dynamodbCredentials = function(){
    AWS.config.region = 'ap-northeast-1'; 
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
    }); 
}

module.exports = {
	'secretKey' : '12345-67890-09876-54321',
    'createConnection' : connection,
    'connectDb' : dbConnect,
    'dynamodbCredentials' : dynamodbCredentials
}