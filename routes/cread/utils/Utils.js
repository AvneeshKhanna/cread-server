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

var BreakPromiseChainError = require('./BreakPromiseChainError');

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
 * A function to return all the indexes of a value within an array
 * */
function getAllIndexes(arr, val){

    var indexes = [];
    var pos = -1;

    while((pos = arr.indexOf(val, pos + 1)) !== -1){
        indexes.push(pos);
    }

    return indexes;
}

function getUniqueValues(arr) {
    return arr.filter(function (value, index, self) {
        return self.indexOf(value) === index;
    });
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

function rollbackTransaction(connection, resultfromprev, err) {
    console.log('TRANSACTION rollbacked');
    return new Promise(function (resolve, reject) {
        connection.rollback(function () {
            reject(err);
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

/**
 * This function is used to convert the profile mention formatted parts to simply names in texts for backward compatibility with
 * profile mention
 * */
function filterProfileMentions(items, item_text_key) {

    items.map(function (item) {
        if(!!item[item_text_key]){
            item[item_text_key] = convertProfileMentionToName(item[item_text_key]);
        }
    });

    return items;
}

/**
 * This function is used to convert the part of encoded profile mention string in the entire text to simply the name of the user for
 * app versions that do not contain profile mention feature
 *
 * Profile Mention Pattern: @[(u:*****-*****-*****-*****+n:*****)] where '*' can alphanumeric or hyphen
 * */
function convertProfileMentionToName(text){

    var mentionregex = /\@\[\(u:[\w\-]+\+n:([^\x00-\x7F]|\w|\s|\n)+\)\]/;  //To extract the profile mention part
    var nameregex = /\+n:([^\x00-\x7F]|\w|\s|\n)+/;  //To further extract the name part from profile mention part

    var match;

    while ((match = mentionregex.exec(text)) !== null) {
        var profilename = nameregex.exec(match[0])[0].split(":")[1];
        text = text.replace(match[0], profilename);
    }

    return text;
}

/**
* A function to extract all the unique UUIDs from Profile Mentions in the text
* */
function extractProfileMentionUUIDs(text) {

    var mentionregex = /\@\[\(u:[\w\-]+\+n:([^\x00-\x7F]|\w|\s|\n)+\)\]/;  //To extract the profile mention part
    var uuidregex = /u:[\w\-]+/;  //To further extract the uuid part from profile mention part

    var match;
    var uniqueuuids = [];

    while ((match = mentionregex.exec(text)) !== null) {
        console.log("profile mention match is " + JSON.stringify(match, null, 3));
        text = text.replace(match[0].trim(), "");
        var uuid = uuidregex.exec(match[0])[0].split(":")[1];
        uniqueuuids.push(uuid);
    }

    console.log("uniqueuuids are " + JSON.stringify(uniqueuuids, null, 3));
    return getUniqueValues(uniqueuuids);
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
    downloadFile: downloadFile,
    getAllIndexes: getAllIndexes,
    filterProfileMentions: filterProfileMentions,
    extractProfileMentionUUIDs: extractProfileMentionUUIDs
};