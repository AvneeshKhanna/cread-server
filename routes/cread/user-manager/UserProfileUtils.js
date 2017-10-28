/**
 * Created by avnee on 27-09-2017.
 */
'use-strict';

var utils = require('../utils/Utils');
var requestclient = require('request');

var envconfig = require('config');

var fs = require('fs');
var jimp = require('jimp');

var config = require('../../Config');
var AWS = config.AWS;
var s3bucket = envconfig.get('s3.bucket');

function loadTimeline(connection, uuid, limit, page) {

    var offset = limit * page;

    return new Promise(function (resolve, reject) {

        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'USING(entityid) ' +
            'LEFT JOIN Short ' +
            'USING(entityid) ' +
            'WHERE Capture.uuid = ? ' +
            'OR Short.uuid = ? ', [], function(err, data){
            if(err){
                reject(err);
            }
            else{
                var totalcount = data[0].totalcount;

                connection.query('SELECT * ' +
                    'FROM Entity ' +
                    'LEFT JOIN Capture ' +
                    'USING(entityid) ' +
                    'LEFT JOIN Short ' +
                    'USING(entityid) ' +
                    'WHERE Capture.uuid = ? ' +
                    'OR Short.uuid = ? ' +
                    'ORDER BY Entity.regdate DESC', [uuid, uuid], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {

                        resolve({
                            requestmore: totalcount > (offset + limit),
                            items: rows
                        });
                    }
                });

            }
        });


    });
}

function loadProfileInformation(connection, requesteduuid){
    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.uuid, User.firstname, User.lastname, User.bio, User.watermarkstatus, User.email, User.phone, Follow.followee, Follow.follower ' +
            'FROM User ' +
            'LEFT JOIN Follow ' +
            'ON (Follow.followee = User.uuid OR Follow.follower = User.uuid) ' +
            'WHERE User.uuid = ?', [requesteduuid], function (err, rows) {
            if (err) {
                reject(err)
            }
            else {
                var followercount = rows.filter(function (elem) {
                    return (elem.followee === requesteduuid);
                }).length;

                var following = rows.filter(function (elem) {
                    return (elem.follower === requesteduuid);
                });

                var followingcount = following.length;

                var userdata = rows[0];

                userdata.profilepicurl = utils.createProfilePicUrl(userdata.uuid);

                userdata.followstatus = (following.filter(function (elem) {
                    return (elem.uuid === requesteduuid)
                }).length !== 0);

                userdata.followercount = followercount;
                userdata.followingcount = followingcount;

                connection.query('SELECT COUNT(entityid) AS postcount ' +
                    'FROM Entity ' +
                    'LEFT JOIN Capture ' +
                    'USING(entityid) ' +
                    'LEFT JOIN Short ' +
                    'USING(entityid) ' +
                    'WHERE Capture.uuid = ? ' +
                    'OR Short.uuid = ?', [requesteduuid, requesteduuid], function(err, data){
                    if(err){
                        reject(err);
                    }
                    else{
                        userdata.postcount = data[0].postcount;
                        resolve(userdata);
                    }
                });
            }
        });
    });
}

function updateProfile(connection, uuid, details) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE User SET ? WHERE uuid = ?', [details, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function loadFacebookFriends(connection, uuid, fbid, fbaccesstoken, nexturl) {
    return new Promise(function (resolve, reject) {

        var graphurl = (nexturl) ? nexturl : 'https://graph.facebook.com/v2.10/'
            + fbid
            + '/'
            + 'friends'
            + '?'
            + 'access_token='
            + fbaccesstoken;

        requestclient(graphurl, function (error, res, body) {

            console.log("body-response " + JSON.stringify(JSON.parse(body), null, 3));

            if(error){
                reject(error);
            }
            else if(JSON.parse(body).error){
                reject(JSON.parse(body).error);
            }
            else{
                var response = JSON.parse(body);

                var friendsids = response.data.map(function (element) {
                    return element.id;
                });

                var result = {};

                if(friendsids.length === 0){
                    result.requestmore = false;
                    result.friends = response.data;
                    resolve(result);
                }
                else{
                    connection.query('SELECT User.firstname, User.lastname, User.uuid, ' +
                        'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS binarycount ' +
                        'FROM User ' +
                        'LEFT JOIN Follow ' +
                        'ON User.uuid = Follow.followee ' +
                        'WHERE User.fbid IN (?) ' +
                        'GROUP BY User.uuid', [uuid, friendsids], function (err, rows) {

                        if (err) {
                            reject(err);
                        }
                        else {

                            console.log("rows from User LEFT JOIN Follow query is " + JSON.stringify(rows, null, 3));

                            if(response.paging.next){
                                result.nexturl = response.paging.next;
                            }

                            result.requestmore = !!response.paging.next;

                            rows.map(function (elem) {
                                elem.profilepicurl = utils.createProfilePicUrl(elem.uuid);
                                elem.followstatus = elem.binarycount > 0;
                                return elem;
                            });

                            result.friends = rows;

                            resolve(result);
                        }
                    });
                }

            }
        });

    });
}

/**
 * A recursive implementation of loadFacebookFriends() that returns uuids of all the Facebook friends of the user who
 * have installed the app
 * */
function loadAllFacebookFriends(connection, uuid, fbid, fbaccesstoken, nexturl){
    return new Promise(function (resolve, reject) {

        var friends = [];

        function recursive(nexturl){
            loadFacebookFriends(connection, uuid, fbid, fbaccesstoken, nexturl)
                .then(function (result) {

                    //To collate only those users who have not been followed
                    friends = friends.concat(result.friends.filter(function (elem) {
                        return !elem.followstatus;
                    }));

                    if(result.requestmore){
                        recursive(result.nexturl);
                    }
                    else {
                        console.log("result.requestmore is false");
                        resolve(friends.map(function (element) {
                            return element.uuid;
                        }));
                    }
                })
                .catch(function (err) {
                    reject(err);
                })
        }

        recursive(nexturl);
    });
}

/**
 * npm package multer uploads an image to the server with a randomly generated guid without an extension. Hence,
 * the uploaded file needs to be renamed
 * */
function renameFile(filebasepath, file, guid) {
    console.log("renameFile() called");
    return new Promise(function (resolve, reject) {
        console.log('file path is ' + file.path);
        fs.rename(file.path, /*'./images/uploads/profile_picture/'*/filebasepath + guid + '.jpg', function (err) {
            if (err) {
                console.log("fs.rename: onReject()");
                reject(err);
            }
            else {
                /*fs.open('./images/uploads/profile_picture/' + guid + '.jpg', 'r+', function (err, renamed) {
                    if(err){
                        console.log("fs.readFile: onReject()");
                        reject(err);
                    }
                    else{
                        console.log('renamed file path ' + renamed.path);
                        resolve('./images/uploads/profile_picture/' + guid + '.jpg');
                    }
                });*/
                resolve(filebasepath + guid + '.jpg');
            }
        });
    });
}

function createSmallImage(readingpath, writingbasepath, guid, height, width) {
    console.log("createSmallImage() called readingpath " + readingpath);
    return new Promise(function (resolve, reject) {
        jimp.read(readingpath, function (err, resized) {
            if (err) {
                reject(err);
            }
            else{
                resized.resize(height, width)            // resize
                    .quality(80)                    // set JPEG quality
                    .write(/*"./images/uploads/profile_picture/"*/writingbasepath + guid + "-small.jpg", function (err) {
                        if(err){
                            reject(err);
                        }
                        else{
                            resolve(/*"./images/uploads/profile_picture/"*/writingbasepath + guid + "-small.jpg");
                        }
                    });    // save
            }
        });
    });
}

function uploadImageToS3(filepath, uuid, type, filename /* ,filekey*/) {
    console.log("uploadImageToS3() called file.path " + filepath);
    return new Promise(function (resolve, reject) {
        var params = {
            Body: fs.createReadStream(filepath),
            Bucket: s3bucket,
            Key: "Users/" + uuid + "/" + type + "/" + filename,
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
    });
}

module.exports = {
    loadTimeline: loadTimeline,
    loadProfileInformation: loadProfileInformation,
    loadFacebookFriends: loadFacebookFriends,
    loadAllFacebookFriends: loadAllFacebookFriends,
    updateProfile: updateProfile,
    renameFile: renameFile,
    createSmallImage: createSmallImage,
    uploadImageToS3: uploadImageToS3
};