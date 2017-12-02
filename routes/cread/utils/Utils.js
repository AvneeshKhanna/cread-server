/**
 * Created by avnee on 22-06-2017.
 */

var config = require('../../Config');
var AWS = config.AWS;

var envconfig = require('config');
var request_client = require('request');
var fs = require('fs');

var s3bucket = envconfig.get('s3.bucket');
var s3bucketheader = 's3-ap-northeast-1.amazonaws.com';
var profilepicfilename = 'display-pic.jpg';
var profilepicfilename_small = 'display-pic-small.jpg';
var urlprotocol = 'https://';

/**
 * Function to add/update the given key value as query parameter to the uri
 * */
function updateQueryStringParameter(uri, key, value) {
    var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
    var separator = uri.indexOf('?') !== -1 ? "&" : "?";
    if (uri.match(re)) {
        return uri.replace(re, '$1' + key + "=" + value + '$2');
    }
    else {
        return uri + separator + key + "=" + value;
    }
}

/**
* Sends an AWS Transactional SMS to the given phonenumber
* */
function sendAWSSMS(message, phonenumber, callback){

    if(phonenumber.length !== 10){
        phonenumber = phonenumber.slice(3, phonenumber.length);
    }

    var sns = new AWS.SNS();

    var params = {
        attributes : {
            DefaultSMSType : 'Transactional'
        }
    };

    sns.setSMSAttributes(params, function(err, data){

        if(err){
            callback(err, null);
        }
        else{

            var params = {
                Message : message,
                PhoneNumber : '+91' + phonenumber
            };

            console.log('sns request sending');

            sns.publish(params, function(err, data){

                if(err){
                    callback(err, null);
                }
                else{
                    callback(null, data);
                }

            });
        }
    });

}

/**
 * Returns a url storing the profile pic of an app user using uuid
 * */
function createProfilePicUrl(uuid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Profile/' + profilepicfilename;
}

/**
 * Returns a url storing the small version of profile pic of an app user using uuid
 * */
function createSmallProfilePicUrl(uuid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Profile/' + profilepicfilename_small;
}

function changePropertyName(object, from, to) {
    if(object.hasOwnProperty(from)){
        object[to] = object[from];
        delete object[from];
    }
}

function createSmallCaptureUrl(uuid, captureid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Capture/' + captureid + '-small.jpg';
}

function createCaptureUrl(uuid, captureid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Capture/' + captureid + '.jpg';
}

function createSmallShortUrl(uuid, shoid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Short/' + shoid + '-small.jpg';
}

function createShortUrl(uuid, shoid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Short/' + shoid + '.jpg';
}

function commitTransaction(connection, resultfromprev) {
    return new Promise(function (resolve, reject) {
        connection.commit(function (err) {
            if(err){
                reject(err);
            }
            else{
                console.log('TRANSACTION committed successfully');
                resolve(resultfromprev);
            }
        });
    });
}

function rollbackTransaction(connection, resultfromprev) {
    console.log('TRANSACTION rollbacked');
    return new Promise(function (resolve, reject) {
        connection.rollback(function () {
            resolve();
        });
    });
}

function beginTransaction(connection) {
    return new Promise(function (resolve, reject) {
        connection.beginTransaction(function (err) {
            if (err) {
                connection.rollback(function () {
                    reject(err);
                });
            }
            else {
                resolve();
            }
        });
    });
}

function downloadFile(filebasepath, filename, downloadurl){
    return new Promise(function (resolve, reject) {
        request_client(downloadurl)
            .pipe(fs.createWriteStream(filebasepath + '/' + filename))
            .on('close', function () {
                resolve(filebasepath + '/' + filename);
            })
            .on('error', function (err) {
                reject(err);
            });
    });
}

module.exports = {
    updateQueryStringParameter: updateQueryStringParameter,
    sendAWSSMS: sendAWSSMS,
    createProfilePicUrl: createProfilePicUrl,
    createSmallProfilePicUrl: createSmallProfilePicUrl,
    changePropertyName: changePropertyName,
    createSmallCaptureUrl: createSmallCaptureUrl,
    createCaptureUrl: createCaptureUrl,
    createSmallShortUrl: createSmallShortUrl,
    createShortUrl: createShortUrl,
    commitTransaction: commitTransaction,
    beginTransaction: beginTransaction,
    rollbackTransaction: rollbackTransaction,
    downloadFile: downloadFile
};