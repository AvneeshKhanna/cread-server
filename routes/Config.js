var mysql = require('mysql');
var AWS = require('aws-sdk');
var AWS_EU_WEST_1 = require('aws-sdk');
var config = require('config');
var dbConfig = config.get('rdsDB.dbConfig');

AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff'
});

AWS_EU_WEST_1.config.region = 'eu-west-1';
AWS_EU_WEST_1.config.credentials = new AWS_EU_WEST_1.CognitoIdentityCredentials({
    IdentityPoolId: 'eu-west-1:d29fce0a-ac1a-4aaf-b3f6-0bc48b58b87e'
});

var connection = mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    timezone: 'UTC',
    port: dbConfig.port,
    charset: 'utf8mb4_unicode_ci'
});

var connectionPool = mysql.createPool({
    connectionLimit : 50,
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    timezone: 'UTC',
    port: dbConfig.port,
    charset: 'utf8mb4_unicode_ci'
});

function getNewConnection() {
    return new Promise(function (resolve, reject) {
        connectionPool.getConnection(function (err, connection) {
            if(err){
                reject(err);
            }
            else{
                resolve(connection);
            }
        })
    })
}

function disconnect(connection) {
    if(connection.state != "disconnected"){
        console.log('connection released');
        connection.release();
    }
}

var dbConnect = function () {
    connection.connect(function (err, result) {
        if (err) {
            throw err;
        }

        console.log('Connected to rds...');
        console.log(config.get('type') + ' version running');
    });
};

var dynamodbCredentials = function () {
    AWS.config.region = 'ap-northeast-1';
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
    });
};

module.exports = {
    'secretKey': '12345-67890-09876-54321',
    'createConnection': connection,
    'getNewConnection': getNewConnection,
    'connectionPool': connectionPool,
    'disconnect': disconnect,
    'connectDb': dbConnect,
    'dynamodbCredentials': dynamodbCredentials,
    'AWS': AWS,
    'AWS-EU-WEST-1': AWS_EU_WEST_1
};