/**
 * Created by avnee on 22-06-2017.
 */

var config = require('../../Config');
var AWS = config.AWS;

var envconfig = require('config');
var request_client = require('request');
var fs = require('fs');
var async = require('async');

var s3bucket = envconfig.get('s3.bucket');
var s3bucketheader = 's3-ap-northeast-1.amazonaws.com';
var profilepicfilename = 'display-pic.jpg';
var profilepicfilename_small = 'display-pic-small.jpg';
var urlprotocol = 'https://';

var downloads_file_basepath = './downloads';

const bitly = config.getBitlyClient();

var firstPostCommentsCK = [
    {
        prefix: "Beautiful first post, ",
        suffix: ". Cheers to you! Welcome to Cread community. :)"
    },
    {
        prefix: "Beautiful work and this is the first post! Congratulations, ",
        suffix: "! Welcome to Cread community. :)"
    },
    {
        prefix: "Sweet post, and this is the first! Congratulations on joining Cread community, ",
        suffix: ". Cheers to you! :)"
    },
    {
        prefix: "First post and it's beautiful! Cheers to you, ",
        suffix: "! Congratulations on joining Cread community. :)"
    },
    {
        prefix: "Welcome to Cread community, ",
        suffix: "! Your first post is beautiful! Cheers to you! :)"
    }
];

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
function getAllIndexes(arr, val) {

    var indexes = [];
    var pos = -1;

    while ((pos = arr.indexOf(val, pos + 1)) !== -1) {
        indexes.push(pos);
    }

    return indexes;
}

function getUniqueValues(arr) {
    return arr.filter(function (value, index, self) {
        return self.indexOf(value) === index;
    });
}

function shuffle(arr) {
    for (var i = arr.length - 1; i >= 0; i--) {

        var randomIndex = Math.floor(Math.random() * (i + 1));
        var itemAtIndex = arr[randomIndex];

        arr[randomIndex] = arr[i];
        arr[i] = itemAtIndex;
    }
    return arr;
}

/**
 * Sends an AWS Transactional SMS to the given phonenumber
 * */
function sendAWSSMS(message, phonenumber, callback) {

    if (!phonenumber.includes("+91")) {   //If phone number doesn't contain '+91'
        phonenumber = "+91" + phonenumber;
    }

    var sns = new AWS.SNS();

    var params = {
        attributes: {
            DefaultSMSType: 'Transactional'
        }
    };

    sns.setSMSAttributes(params, function (err, data) {

        if (err) {
            callback(err, null);
        }
        else {

            var params = {
                Message: message,
                PhoneNumber: phonenumber
            };

            console.log('sns request sending');

            sns.publish(params, function (err, data) {

                if (err) {
                    callback(err, null);
                }
                else {
                    callback(null, data);
                }

            });
        }
    });

}

function sendAWSTextEmail(subject, body, toAddresses, bccAddresses) {
    return new Promise(function (resolve, reject) {
        var params = {
            Destination: {
                ToAddresses: toAddresses,
                BccAddresses: bccAddresses
            },
            Message: {
                Body: {
                    Text: {
                        Charset: "UTF-8",
                        Data: body
                    }
                },
                Subject: {
                    Charset: "UTF-8",
                    Data: subject
                }
            },
            Source: "Cread Inc. <admin@cread.in>"
        };

        setAWSConfigForSES(AWS);
        var ses = new AWS.SES();

        ses.sendEmail(params, function (err, data) {

            resetAWSConfig(AWS);

            if (err) {
                reject(err);
                //throw err;
            }
            else {
                console.log("Transaction email response " + JSON.stringify(data, null, 3));
                resolve(data);
            }

            /*
             data = {
                MessageId: "EXAMPLE78603177f-7a5433e7-8edb-42ae-af10-f0181f34d6ee-000000"
             }
             */
        });
    });
}

/**
 * Resets the region and identity-pool-id for AWS to AP_NORTHEAST_1
 * */
function resetAWSConfig(AWS) {
    AWS.config.region = 'ap-northeast-1';
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff'
    });
}

/**
 * Resets the region and identity-pool-id for AWS to EU_WEST_1
 * */
function setAWSConfigForSES(AWS) {
    AWS.config.region = 'eu-west-1';
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'eu-west-1:d29fce0a-ac1a-4aaf-b3f6-0bc48b58b87e'
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
    if (object.hasOwnProperty(from)) {
        object[to] = object[from];
        delete object[from];
    }
}

function createSmallCaptureUrl(uuid, captureid) {
    return urlprotocol + /*'d2vvojd6jjmi1r.cloudfront.net'*/ s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Capture/' + captureid + '-small.jpg';
}

function createCaptureUrl(uuid, captureid) {
    return urlprotocol + /*'d2vvojd6jjmi1r.cloudfront.net'*/ s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Capture/' + captureid + '.jpg';
}

function createSmallShortUrl(uuid, shoid) {
    return urlprotocol + /*'d2vvojd6jjmi1r.cloudfront.net'*/ s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Short/' + shoid + '-small.jpg';
}

function createShortUrl(uuid, shoid) {
    return urlprotocol + /*'d2vvojd6jjmi1r.cloudfront.net'*/ s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Short/' + shoid + '.jpg';
}

function getShortCoffeeMugOverlayUrl(uuid, shoid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Short/' + shoid + '-overlay-coffee-mug.png';
}

function getCaptureCoffeeMugOverlayUrl(uuid, capid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Capture/' + capid + '-overlay-coffee-mug.png';
}

function getShortJournalOverlayUrl(uuid, shoid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Short/' + shoid + '-overlay-journal.png';
}

function getCaptureJournalOverlayUrl(uuid, capid) {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Users/' + uuid + '/Capture/' + capid + '-overlay-journal.png';
}

function commitTransaction(connection, resultfromprev) {
    return new Promise(function (resolve, reject) {
        connection.commit(function (err) {
            if (err) {
                reject(err);
            }
            else {
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

function downloadFile(filebasepath, filename, downloadurl) {
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

function uploadFileToS3(sourcefilepath, destFileKey) {
    return new Promise(function (resolve, reject) {
        var params = {
            Body: fs.createReadStream(sourcefilepath),
            Bucket: s3bucket,
            Key: destFileKey,
            ACL: "public-read"
        };

        var s3 = new AWS.S3();
        s3.putObject(params, function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    })
}

function getS3ConfigFileUrl() {
    return urlprotocol + s3bucketheader + '/' + s3bucket + '/Config/config.json';
}

function changeS3ConfigFile(token) {
    return new Promise(function (resolve, reject) {

        var data = {
            web_access_token: encodeURIComponent(token)
        };

        fs.writeFile(downloads_file_basepath + '/config.json', JSON.stringify(data, null, 3), function (err) {
            if(err){
                reject(err);
            }
            else{
                resolve();
            }
        });
    });
}

function updateS3ConfigFile(token) {
    return new Promise(function (resolve, reject) {
        downloadFile(downloads_file_basepath, "config.json", getS3ConfigFileUrl())
            .then(function () {
                return changeS3ConfigFile(token);
            })
            .then(function () {
                return uploadFileToS3(downloads_file_basepath + '/config.json', "Config/config.json");
            })
            .then(resolve, reject);
    });
}

/**
 * This function is used to convert the profile mention formatted parts to simply names in texts for backward compatibility with
 * profile mention
 * */
function filterProfileMentions(items, item_text_key) {

    items.map(function (item) {
        if (!!item[item_text_key]) {
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
function convertProfileMentionToName(text) {

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

function getRandomFirstPostComment(name) {
    var comment_data = firstPostCommentsCK[Math.floor(Math.random() * firstPostCommentsCK.length)];
    return comment_data.prefix + name + comment_data.suffix;
}

function firstLetterToUpper(word) {
    word = word.trim();
    return word.charAt(0).toUpperCase() + word.substr(1);
}

function deleteUnrequiredFiles(files) {
    return new Promise(function (resolve, reject) {
        async.each(files, function (file, callback) {

            fs.unlink(file, function (err) {
                if (err) {
                    callback(err);
                }
                else {
                    callback();
                }
            });

        }, function (err) {
            if (err) {
                console.error(err);
                reject(err);
            }
            else {
                console.log('Files Deleted');
                resolve();
            }
        });
    })
}

function getShortBitlyLink(longUrl) {
    return new Promise(function (resolve, reject) {
        request_client(bitly.api_base_url + "/v3/link/lookup?url=" +
            decodeURIComponent(longUrl) +
            "&access_token=" +
            bitly.generic_access_token, function (err, res, body) {
            if (err) {
                reject(err);
            }
            else if(res.statusCode !== 200){
                console.log(body);
                reject(new Error('Short link from Bitly could not be generated due to an error'));
            }
            else {  //res.statusCode === 200
                body = JSON.parse(body);
                resolve(body.data.link_lookup.aggregdate_link).end();
            }
        })
    });
}

module.exports = {
    updateQueryStringParameter: updateQueryStringParameter,
    sendAWSSMS: sendAWSSMS,
    sendAWSTextEmail: sendAWSTextEmail,
    createProfilePicUrl: createProfilePicUrl,
    createSmallProfilePicUrl: createSmallProfilePicUrl,
    changePropertyName: changePropertyName,
    createSmallCaptureUrl: createSmallCaptureUrl,
    createCaptureUrl: createCaptureUrl,
    createSmallShortUrl: createSmallShortUrl,
    createShortUrl: createShortUrl,
    getCaptureCoffeeMugOverlayUrl: getCaptureCoffeeMugOverlayUrl,
    getShortCoffeeMugOverlayUrl: getShortCoffeeMugOverlayUrl,
    getShortJournalOverlayUrl: getShortJournalOverlayUrl,
    getCaptureJournalOverlayUrl: getCaptureJournalOverlayUrl,
    commitTransaction: commitTransaction,
    beginTransaction: beginTransaction,
    rollbackTransaction: rollbackTransaction,
    downloadFile: downloadFile,
    updateS3ConfigFile: updateS3ConfigFile,
    getAllIndexes: getAllIndexes,
    filterProfileMentions: filterProfileMentions,
    extractProfileMentionUUIDs: extractProfileMentionUUIDs,
    shuffle: shuffle,
    getUniqueValues: getUniqueValues,
    getRandomFirstPostComment: getRandomFirstPostComment,
    firstLetterToUpper: firstLetterToUpper,
    deleteUnrequiredFiles: deleteUnrequiredFiles,
    getShortBitlyLink: getShortBitlyLink
};