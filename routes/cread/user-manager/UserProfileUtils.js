/**
 * Created by avnee on 27-09-2017.
 */
'use-strict';

var utils = require('../utils/Utils');
var requestclient = require('request');

var envconfig = require('config');

var fs = require('fs');
var jimp = require('jimp');
var uuidgen = require('uuid');
var moment = require('moment');

var config = require('../../Config');
var AWS = config.AWS;
var s3bucket = envconfig.get('s3.bucket');

var imagesize = require('image-size');

var feedutils = require('../feed/FeedUtils');

function loadTimelineLegacy(connection, requesteduuid, requesteruuid, limit, page) {

    var offset = limit * page;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'USING(entityid) ' +
            'LEFT JOIN Short ' +
            'USING(entityid) ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'WHERE User.uuid = ? ' +
            'AND Entity.status = "ACTIVE" ', [requesteduuid], function(err, data){
            if(err){
                reject(err);
            }
            else{
                var totalcount = (data[0]) ? data[0].totalcount : 0;

                if(totalcount > 0){
                    connection.query('SELECT Entity.entityid, Entity.merchantable, Entity.type, User.uuid, User.firstname, User.lastname, Short.shoid, Capture.capid AS captureid, ' +
                        'COUNT(DISTINCT HatsOff.hoid) AS hatsoffcount, COUNT(DISTINCT Comment.commid) AS commentcount ' +
                        'FROM Entity ' +
                        'LEFT JOIN Capture ' +
                        'USING(entityid) ' +
                        'LEFT JOIN Short ' +
                        'USING(entityid) ' +
                        'JOIN User ' +
                        'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
                        'LEFT JOIN HatsOff ' +
                        'ON HatsOff.entityid = Entity.entityid ' +
                        'LEFT JOIN Comment ' +
                        'ON Comment.entityid = Entity.entityid ' +
                        'WHERE User.uuid = ? ' +
                        'AND Entity.status = "ACTIVE" ' +
                        'GROUP BY Entity.entityid ' +
                        'ORDER BY Entity.regdate DESC ' +
                        'LIMIT ? ' +
                        'OFFSET ?', [requesteduuid, limit, offset], function (err, rows) {
                        if (err) {
                            reject(err);
                        }
                        else {

                            var feedEntities = rows.map(function (elem) {
                                return elem.entityid;
                            });

                            connection.query('SELECT entityid, uuid ' +
                                'FROM HatsOff ' +
                                'WHERE uuid = ? ' +
                                'AND entityid IN (?) ' +
                                'GROUP BY entityid', [requesteruuid, feedEntities], function(err, hdata){

                                if(err){
                                    reject(err);
                                }
                                else{
                                    rows.map(function (element) {

                                        var thisEntityIndex = hdata.map(function (el) {
                                            return el.entityid;
                                        }).indexOf(element.entityid);

                                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                                        element.creatorname = element.firstname + ' ' + element.lastname;
                                        element.hatsoffstatus = thisEntityIndex !== -1;
                                        element.merchantable = (element.merchantable !== 0);

                                        if(element.type === 'CAPTURE'){
                                            element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                                        }
                                        else{
                                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                                        }

                                        if(element.firstname){
                                            delete element.firstname;
                                        }

                                        if(element.lastname){
                                            delete element.lastname;
                                        }

                                        return element;
                                    });

                                    resolve({
                                        requestmore: totalcount > (offset + limit),
                                        items: rows
                                    });
                                }
                            });
                        }
                    });
                }
                else{
                    resolve({
                        requestmore: totalcount > (offset + limit),
                        items: []
                    });
                }
            }
        });


    });
}

function loadTimeline(connection, requesteduuid, requesteruuid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.caption, Entity.entityid, Entity.regdate, Entity.merchantable, Entity.type, User.uuid, ' +
            'User.firstname, User.lastname, Short.shoid, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, ' +
            'Capture.capid AS captureid, ' +
            'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS fbinarycount, ' +
            'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
            'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
            'COUNT(DISTINCT Comment.commid) AS commentcount ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'USING(entityid) ' +
            'LEFT JOIN Short ' +
            'USING(entityid) ' +
            'JOIN User ' +
            'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
            'LEFT JOIN HatsOff ' +
            'ON HatsOff.entityid = Entity.entityid ' +
            'LEFT JOIN Comment ' +
            'ON Comment.entityid = Entity.entityid ' +
            'LEFT JOIN Follow ' +
            'ON User.uuid = Follow.followee ' +
            'WHERE User.uuid = ? ' +
            'AND Entity.status = "ACTIVE" ' +
            'AND Entity.regdate < ? ' +
            'GROUP BY Entity.entityid ' +
            'ORDER BY Entity.regdate DESC ' +
            'LIMIT ? '/* +
            'OFFSET ?'*/, [requesteruuid, requesteruuid, requesteduuid, lastindexkey, limit/*, offset*/], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                var feedEntities = rows.map(function (elem) {
                    return elem.entityid;
                });

                if(rows.length > 0){
                    rows.map(function (element) {

                        /*var thisEntityIndex = hdata.map(function (el) {
                            return el.entityid;
                        }).indexOf(element.entityid);*/

                        element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                        element.creatorname = element.firstname + ' ' + element.lastname;
                        element.hatsoffstatus = element.hbinarycount > 0;
                        element.followstatus = element.fbinarycount > 0;
                        element.merchantable = (element.merchantable !== 0);

                        if(element.type === 'CAPTURE'){
                            element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                        }
                        else{
                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                        }

                        if(element.firstname){
                            delete element.firstname;
                        }

                        if(element.lastname){
                            delete element.lastname;
                        }

                        if(element.hasOwnProperty('hbinarycount')) {
                            delete element.hbinarycount;
                        }

                        if(element.hasOwnProperty('fbinarycount')) {
                            delete element.fbinarycount;
                        }

                        return element;
                    });

                    feedutils.getCollaborationData(connection, rows)
                        .then(function (rows) {

                            /*rows.map(function (e) {
                                e.collabcount = 0;
                                return e;
                            });*/

                            return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                        })
                        .then(function (rows) {
                            console.log("rows after getCollabCounts is " + JSON.stringify(rows, null, 3));
                            resolve({
                                requestmore: rows.length >= limit,//totalcount > (offset + limit),
                                lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                                items: rows
                            });
                        })
                        .catch(function (err) {
                            reject(err);
                        });

                }
                else{   //Case of no data
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        items: []
                    });
                }
            }
        });
    });
}

function loadProfileInformation(connection, requesteduuid, requesteruuid){

    var today = moment().format('YYYY-MM-DD 00:00:00');

    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.uuid, User.firstname, User.lastname, User.bio, User.watermarkstatus, ' +
            'User.email, User.phone, Follow.followee, Follow.follower, FA.featured_id ' +
            'FROM User ' +
            'LEFT JOIN ' +
                '(SELECT uuid, featured_id ' +
                'FROM FeaturedArtists ' +
                'WHERE regdate > ? ' +
                'ORDER BY featured_score DESC ' +
                'LIMIT 4) FA ' +
            'ON (FA.uuid = User.uuid) ' +
            'LEFT JOIN Follow ' +
            'ON (Follow.followee = User.uuid OR Follow.follower = User.uuid) ' +
            'WHERE User.uuid = ?', [today, requesteduuid], function (err, rows) {
            if (err) {
                reject(err)
            }
            else {

                //People who follow the requesteduuid
                var followers = rows.filter(function (elem) {
                    return (elem.followee === requesteduuid);
                });

                //People who the requesteduuid follows
                var following = rows.filter(function (elem) {
                    return (elem.follower === requesteduuid);
                });

                var followercount = followers.length;
                var followingcount = following.length;

                var userdata = rows[0];

                userdata.profilepicurl = utils.createProfilePicUrl(userdata.uuid);
                userdata.featured = !!userdata.featured_id;

                if(userdata.hasOwnProperty('featured_id')){
                    delete userdata.featured_id;
                }

                //Follow status of the requester w.r.t. the requested
                userdata.followstatus = (followers.filter(function (elem) {
                    return (elem.follower === requesteruuid)
                }).length !== 0);

                userdata.followercount = followercount;
                userdata.followingcount = followingcount;

                connection.query('SELECT COUNT(DISTINCT E.entityid) AS postcount, ' +
                    'COUNT(DISTINCT CASE WHEN(E.type = "SHORT") THEN SC.capid ' +
                    'WHEN(E.type = "CAPTURE") THEN CS.shoid END) AS collaborationscount, ' +
                    'COUNT(DISTINCT Cmt.commid) AS commentscount, ' +
                    'COUNT(DISTINCT H.entityid, H.uuid) AS hatsoffscount ' +
                    'FROM Entity E ' +
                    'LEFT JOIN Capture C ' +
                    'ON E.entityid = C.entityid ' +
                    'LEFT JOIN Short CS ' +
                    'ON C.capid = CS.capid ' +
                    'LEFT JOIN Short S ' +
                    'ON E.entityid = S.entityid ' +
                    'LEFT JOIN Capture SC ' +
                    'ON S.shoid = SC.shoid ' +
                    'LEFT JOIN HatsOff H ' +
                    'ON E.entityid = H.entityid  ' +
                    'LEFT JOIN Comment AS Cmt ' +
                    'ON E.entityid = Cmt.entityid ' +
                    'WHERE (S.uuid = ? OR C.uuid = ?) ' +
                    'AND E.status = "ACTIVE"', [requesteduuid, requesteduuid], function(err, data){
                    if(err){
                        reject(err);
                    }
                    else{
                        userdata.postcount = data[0].postcount; //Total posts uploaded by this user
                        userdata.commentscount = data[0].commentscount; //Total comments received by this user's posts
                        userdata.hatsoffscount = data[0].hatsoffscount; //Total hatsoffs received by this user's posts
                        userdata.collaborationscount = data[0].collaborationscount; //Total posts created by others using this user's posts
                        resolve(userdata);
                    }
                });
            }
        });
    });
}

function loadCollaborationTimeline(connection, requesteduuid, requesteruuid, limit, lastindexkey) {
    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    //TODO: Change query
    return new Promise(function (resolve, reject) {
        connection.query('SELECT firstname, lastname ' +
            'FROM User ' +
            'WHERE uuid = ?', [requesteduuid], function (err, requesteduuiddetails) {
            if(err){
                reject(err);
            }
            else{
                connection.query('SELECT Entity.caption, Entity.entityid, Entity.regdate, Entity.merchantable, Entity.type, User.uuid, ' +
                    'User.firstname, User.lastname, Short.shoid, Short.capid AS shcaptureid, Capture.shoid AS cpshortid, ' +
                    'Capture.capid AS captureid, CShort.entityid AS csentityid, SCapture.entityid AS scentityid, ' +
                    'COUNT(CASE WHEN(Follow.follower = ?) THEN 1 END) AS fbinarycount, ' +
                    'COUNT(CASE WHEN(HatsOff.uuid = ?) THEN 1 END) AS hbinarycount, ' +
                    'COUNT(DISTINCT HatsOff.uuid, HatsOff.entityid) AS hatsoffcount, ' +
                    'COUNT(DISTINCT Comment.commid) AS commentcount ' +
                    'FROM Entity ' +
                    'LEFT JOIN Capture ' +
                    'USING(entityid) ' +
                    'LEFT JOIN Short ' +
                    'USING(entityid) ' +
                    'JOIN User ' +
                    'ON (Short.uuid = User.uuid OR Capture.uuid = User.uuid) ' +
                    'LEFT JOIN HatsOff ' +
                    'ON HatsOff.entityid = Entity.entityid ' +
                    'LEFT JOIN Comment ' +
                    'ON Comment.entityid = Entity.entityid ' +
                    'LEFT JOIN Short CShort ' +
                    'ON Capture.shoid = CShort.shoid ' +
                    'LEFT JOIN Capture SCapture ' +
                    'ON Short.capid = SCapture.capid ' +
                    'LEFT JOIN Follow ' +
                    'ON User.uuid = Follow.followee ' +
                    'WHERE (SCapture.uuid = ? OR CShort.uuid = ?) ' +
                    'AND User.uuid <> ? ' +
                    'AND Entity.status = "ACTIVE" ' +
                    'AND Entity.regdate < ? ' +
                    'GROUP BY Entity.entityid ' +
                    'ORDER BY Entity.regdate DESC ' +
                    'LIMIT ? ', [requesteruuid, requesteruuid, requesteduuid, requesteduuid, requesteduuid, lastindexkey, limit], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {

                        var feedEntities = rows.map(function (elem) {
                            return elem.entityid;
                        });

                        if(rows.length > 0){
                            rows.map(function (element) {

                                element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);
                                element.creatorname = element.firstname + ' ' + element.lastname;
                                element.followstatus = element.fbinarycount > 0;
                                element.hatsoffstatus = element.hbinarycount > 0;
                                element.merchantable = (element.merchantable !== 0);

                                if(element.type === 'CAPTURE'){
                                    element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.captureid);
                                    element.cpshort = {
                                        name: requesteduuiddetails[0].firstname + ' ' + requesteduuiddetails[0].lastname,
                                        entityid: element.csentityid,
                                        uuid: requesteduuid
                                    }
                                }
                                else if(element.type === 'SHORT'){
                                    element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                                    element.shcapture = {
                                        name: requesteduuiddetails[0].firstname + ' ' + requesteduuiddetails[0].lastname,
                                        entityid: element.scentityid,
                                        uuid: requesteduuid
                                    }
                                }

                                if(element.firstname){
                                    delete element.firstname;
                                }

                                if(element.lastname){
                                    delete element.lastname;
                                }

                                if(element.hasOwnProperty('hbinarycount')) {
                                    delete element.hbinarycount;
                                }

                                if(element.hasOwnProperty('fbinarycount')) {
                                    delete element.fbinarycount;
                                }

                                return element;
                            });

                            /*feedutils.getCollaborationData(connection, rows)
                                .then(function (rows) {

                                    /!*rows.map(function (e) {
                                        e.collabcount = 0;
                                        return e;
                                    });*!/

                                    return feedutils.getCollaborationCounts(connection, rows, feedEntities);
                                })*/
                            feedutils.getCollaborationCounts(connection, rows, feedEntities)
                                .then(function (rows) {
                                    console.log("rows after getCollabCounts is " + JSON.stringify(rows, null, 3));
                                    resolve({
                                        requestmore: rows.length >= limit,
                                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                                        items: rows
                                    });
                                })
                                .catch(function (err) {
                                    reject(err);
                                });

                        }
                        else{   //Case of no data
                            resolve({
                                requestmore: rows.length >= limit,
                                lastindexkey: null,
                                items: []
                            });
                        }
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

            if(error){
                reject(error);
            }
            else if(JSON.parse(body).error){
                reject(JSON.parse(body).error);
            }
            else{
                console.log("body-response " + JSON.stringify(JSON.parse(body), null, 3));
                var response = JSON.parse(body);

                var friendsids = response.data.map(function (element) {
                    return element.id;
                });

                var result = {};

                if(friendsids.length === 0){    //Case of no data
                    result.nexturl = null;
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

                            result.nexturl = (response.paging.next) ? response.paging.next : null;
                            result.requestmore = !!response.paging.next;

                            rows.map(function (elem) {
                                elem.profilepicurl = utils.createSmallProfilePicUrl(elem.uuid);
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

function getFbAppAccessToken() {
    return new Promise(function (resolve, reject) {

        var graphurl = 'https://graph.facebook.com/v2.10/'
            + 'oauth/access_token?client_id='
            + config['cread-fb-app-id']
            + '&client_secret='
            + config['cread-fb-app-secret']
            + '&grant_type=client_credentials';

        requestclient(graphurl, function (error, res, body) {

            if(error){
                reject(error);
            }
            else if(JSON.parse(body).error){
                reject(JSON.parse(body).error);
            }
            else{
                console.log("body-response " + JSON.stringify(JSON.parse(body), null, 3));
                var response = JSON.parse(body);

                resolve(response.access_token);
            }
        });
    });
}

function getUserFbFriendsViaAppToken(connection, user_fbid, uuid) {
    return new Promise(function (resolve, reject) {
        getFbAppAccessToken()
            .then(function (fb_app_access_token) {
                return loadAllFacebookFriends(connection, uuid, user_fbid, fb_app_access_token);
            })
            .then(function (fuuids) {
                resolve(fuuids);
            })
            .catch(function (err) {
                reject(err);
            });
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

function uploadImageToS3(sourcefilepath, uuid, type, destfilename /* ,filekey*/) {
    console.log("uploadImageToS3() called file.path " + sourcefilepath);
    return new Promise(function (resolve, reject) {
        var params = {
            Body: fs.createReadStream(sourcefilepath),
            Bucket: s3bucket,
            Key: "Users/" + uuid + "/" + type + "/" + destfilename,
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

/**
 * Method to copy Facebook's profile picture to S3
 * */
function copyFacebookProfilePic(fbpicurl, uuid) {
    var downloadpath;
    return new Promise(function (resolve, reject) {
        utils.downloadFile('./images/downloads/profilepic', uuid + '.jpg', fbpicurl)
            .then(function (downldpath) {
                downloadpath = downldpath; 

                console.log("downldpath is " + JSON.stringify(downldpath, null, 3));

                var imagedimensions = imagesize(downloadpath);

                if(imagedimensions.width > 500){    //To resize
                    return createSmallProfilePic(downloadpath, uuid, 128, 128);
                }
                else{   //Not to resize
                    return new Promise(function (resolve, reject) {
                        resolve(downloadpath);
                    });
                }
            })
            .then(function (smallpicpath) {
                return uploadImageToS3(smallpicpath, uuid, 'Profile', 'display-pic-small.jpg');
            })
            .then(function () {
                return uploadImageToS3(downloadpath, uuid, 'Profile', 'display-pic.jpg');
            })
            .then(function () {
                resolve(uuid);
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

function createSmallProfilePic(renamedpath, uuid, height, width) {

    console.log("createSmallProfilePic() called renamedpath " + renamedpath);
    var writepath = "./images/uploads/profile_picture/" + uuid + "-small.jpg";

    return new Promise(function (resolve, reject) {
        jimp.read(renamedpath, function (err, resized) {
            if (err) {
                reject(err);
            }
            else{
                resized.resize(height, width)            // resize
                    .quality(80)                    // set JPEG quality
                    .write(writepath, function (err) {
                        if(err){
                            reject(err);
                        }
                        else{
                            resolve(writepath);
                        }
                    });    // save
            }
        });
    })
}

module.exports = {
    loadTimelineLegacy: loadTimelineLegacy,
    loadTimeline: loadTimeline,
    loadCollaborationTimeline: loadCollaborationTimeline,
    loadProfileInformation: loadProfileInformation,
    loadFacebookFriends: loadFacebookFriends,
    loadAllFacebookFriends: loadAllFacebookFriends,
    getUserFbFriendsViaAppToken: getUserFbFriendsViaAppToken,
    updateProfile: updateProfile,
    renameFile: renameFile,
    createSmallImage: createSmallImage,
    uploadImageToS3: uploadImageToS3,
    copyFacebookProfilePic: copyFacebookProfilePic,
    createSmallProfilePic: createSmallProfilePic
};