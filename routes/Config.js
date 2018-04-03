var mysql = require('mysql');
var AWS = require('aws-sdk');
var AWS_EU_WEST_1 = require('aws-sdk');
var config = require('config');
var dbConfig = config.get('rdsDB.dbConfig');
var envtype = config.get('type');

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
    multipleStatements: true,   //To run multiple queries within the same connection callback loop
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
    multipleStatements: true,   //To run multiple queries within the same connection callback loop
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
    if(connection && connection.state !== "disconnected"){
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

function getServerBaseUrl(){
    if(envtype === 'PRODUCTION'){
        return 'http://cread-server-main.ap-northeast-1.elasticbeanstalk.com';
    }
    else{
        return 'http://cread-server-dev.ap-northeast-1.elasticbeanstalk.com';
    }
}

function getCreadKalakaarUUID(){
    if(envtype === 'PRODUCTION'){
        return '6732bb8e-cffd-4e1b-906f-dc75873a5d92';
    }
    else{
        return '40e88526-6e2f-49f1-82ae-ed2e52fc54fe';
    }
}

function getNishantMittalUUID(){
    if(envtype === 'PRODUCTION'){
        return '0a5a46bc-13f1-42b5-ae9b-ff518c044b80';
    }
    else{
        return '8d905ac6-881d-492c-9aa9-e81f066f4d6f';
    }
}

/**
 * Returns the default chat message from Cread Kalakaar whenever a new user signs up
 * */
function getCreadKalakaarDefaultMessage() {
    return "Hello, my artist friend! \n" +
        "\n" +
        "I'm reaching out to you with a lot of good feelings and hope! I'm glad that you decided to connect with this beautiful community of artists, and hope you enjoy every second of it! On Cread, people create great art, sometimes alone and sometimes in collaboration. They connect with each other, digitally and even through meetups. And finally, they share their work anywhere they want, to give people an opportunity to like and also buy it. \n" +
        "\n" +
        "There's a million ways in which Cread can become better. And only you can tell us how. So if you have any feedback/suggestion, please (PLEASE) reach out to me. Your feedback is gold. \n" +
        "\n" +
        "Looking forward to your art. \n" +
        "Cread Kalakaar";
}

function isProduction(){
    return envtype === 'PRODUCTION';
}

module.exports = {
    'secretKey': '12345-67890-09876-54321',
    'createConnection': connection,
    'getNewConnection': getNewConnection,
    'connectionPool': connectionPool,
    'disconnect': disconnect,
    'connectDb': dbConnect,
    'envtype': envtype,
    'dynamodbCredentials': dynamodbCredentials,
    'AWS': AWS,
    'AWS-EU-WEST-1': AWS_EU_WEST_1,
    'server_url': getServerBaseUrl(),
    'crypto-secret-key': "0da2d13d-3eaa-4ee8-a918-d0ca08d1e897",
    'firebase_web_api_key': 'AIzaSyAylJMEEhFauggwGb2j0gvGMh22K5oVrxY',
    'cread-fb-app-id': '362799884145458',
    'cread-fb-app-secret': '93a98159204ae6ca8647b3cbe00cbf2a',
    'firebase_dynamiclink_domain': 'https://n7sgf.app.goo.gl',  //Obtained from Firebase Developer Console
    'fcm-server-key': 'AAAAWOwUO0Q:APA91bEI7_FLG9hRz2_nHRkBgSnQftSMrGzOzzKod1lPYNyX88jEqUIJRhE7SpxyVQ_a1ugWAZ0CbVgC3pTylZm9w8ZJib8P5B5MTXVh42_48RN_37-Cob0FtTV5-xxRzlSfGgYVobcc',
    getCreadKalakaarUUID: getCreadKalakaarUUID,
    getNishantMittalUUID: getNishantMittalUUID,
    getCreadKalakaarDefaultMessage: getCreadKalakaarDefaultMessage,
    isProduction: isProduction
};