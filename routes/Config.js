var mysql = require('mysql');
var AWS = require('aws-sdk');
var config = require('config');
var dbConfig = config.get('rdsDB.dbConfig');

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
});

var connection = mysql.createConnection({
			host : dbConfig.host,
			user : dbConfig.user,
			password : dbConfig.password,
			database : dbConfig.database,
            timezone: 'UTC',
            port : dbConfig.port
		});

var dbConnect = function(){
    connection.connect(function(err, result){
        if (err) {
            throw err;
        }
        
        console.log('Connected to rds...');
        console.log(config.get('type') + ' version running');
    });
};

var dynamodbCredentials = function(){
    AWS.config.region = 'ap-northeast-1';
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
    });
};

module.exports = {
	'secretKey' : '12345-67890-09876-54321',
    'createConnection' : connection,
    'connectDb' : dbConnect,
    'dynamodbCredentials' : dynamodbCredentials,
    'AWS' : AWS
};