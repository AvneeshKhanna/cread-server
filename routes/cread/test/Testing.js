/**
 * Created by avnee on 26-06-2017.
 */
'use strict';

var express = require('express');
var router = express.Router();

var moment = require('moment');
var uuidGen = require('uuid');
var async = require('async');
var uuidgen = require('uuid');
var request_client = require('request');

var gm = require('gm');
var color_extract = require('colour-extractor');

//--------------

var config = require('../../Config');
var connection = config.createConnection;

var envconfig = require('config');
var dbConfig = envconfig.get('rdsDB.dbConfig');
var isProgressive = require('is-progressive');

//--------------

var AWS = require('aws-sdk');

var transEmail = require('../dsbrd/wallet-management/TransactionEmailer');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var utils = require('../utils/Utils');
var imgutils = require('../utils/images/ImageUtils');

/*AWS.config.region = 'eu-west-1';
 AWS.config.credentials = new AWS.CognitoIdentityCredentials({
 IdentityPoolId: 'eu-west-1:d29fce0a-ac1a-4aaf-b3f6-0bc48b58b87e'
 });*/

var monitor = require('../security/UserActivityMonitor');
var feedutils = require('../feed/FeedUtils');
var cachemanager = require('../utils/cache/CacheManager');
var cacheutils = require('../utils/cache/CacheUtils');

var interestTableData = {
    'Arts & Entertainment': [
        'Art',
        'Culture',
        'Film',
        'Food',
        'Humor',
        'Music',
        'Photography',
        'Social Media',
        'Sports'
    ],
    'Industry': [
        'Business',
        'Economy',
        'Entrepreneurship',
        'Marketing',
        'Freelancing',
        'Productivity',
        'Work'
    ],
    'Innovation & Tech': [
        'Artificial Intelligence',
        'Cyber Security',
        'Data Science',
        'Digital Design',
        'Math',
        'NeuroScience',
        'Programming',
        'Science',
        'Software Engineering',
        'Space',
        'Technology',
        'UI/UX'
    ],
    'Life': [
        'Creativity',
        'Family',
        'Health',
        'Mental Health & Wellness',
        'Psychology',
        'Relationships',
        'Self',
        'Sexuality',
        'Spirituality',
        'Travel',
        'Wellness'
    ],
    'Society': [
        'Education',
        'Environment',
        'Future',
        'History',
        'Media',
        'Philosophy',
        'Politics',
        'World'
    ]
};

function restructureData(users) {

    var master = [];

    users.forEach(function (elem) {
        master.push([
            uuidgen.v4(),
            "405354ca-b37c-4bc5-9b19-ae6d02c0c22b",
            elem,
            moment().format('YYYY-MM-DD HH:mm:ss')
        ])
    });

    return master;
}

router.post('/emailer', function (request, response) {

    transEmail.sendTransactionEmail('SUCCESS', {
            clientname: "Avneesh",
            clientemail: "avneesh.khanna92@gmail.com"
        }, "Hello",
        {paymentid: 'random', amount: "1000"},
        {billingname: "avneesh", billingcontact: "9999"},
        function (err, data) {

            if (err) {
                console.error(err);
                response.send(err);
                response.end();
            }
            else {
                console.log(data);
                response.send(data);
                response.end();
            }

        });

});

function performSearchUsers(connection, keyword) {
    console.log(keyword.split(" ").join("* ") + "*");
    return new Promise(function (resolve, reject) {
        connection.query('SELECT firstname, lastname ' +
            'FROM users ' +
            'WHERE MATCH(firstname) ' +
            'AGAINST(? IN BOOLEAN MODE)', [keyword.split(" ").join("* ") + "*"], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

function getRadiusOfCurvature(img_width, curve_bent_fraction) {
    return parseFloat(img_width * (1 + 4 * Math.pow(curve_bent_fraction, 2)) / parseFloat(8 * curve_bent_fraction));
}

function getOffsetAtX(x, radius, img_width) {
    return Math.abs(Math.sqrt(parseFloat(Math.pow(radius, 2) - Math.pow(x, 2)))) - Math.abs(Math.sqrt(parseFloat(Math.pow(radius, 2) - (Math.pow(img_width, 2) / 4))));
}

var img_width = 1152;
var img_height = 1152;
var curve_bent_center_fraction = 0.0675;    //Calculated from Coffee Mug photo and some iterations

var img_split_step_size = Math.floor(img_width * 0.008);    //In pixels

var img_path_arr = [];

for (var i = 0; i < (img_width / img_split_step_size); i++) {
    img_path_arr.push('./images/downloads/tile-' + i + '.png');
}

router.post('/gm-test', function (request, response) {

    var radius = getRadiusOfCurvature(img_width, curve_bent_center_fraction);
    console.log('radius is ' + radius);

    try {

        gm('./images/downloads/gm.jpg')
            .command('convert')
            .out('-crop')
            .out(img_split_step_size + 'x' + img_height)
            .out('+adjoin') //Used to split images into multiple
            .write('./images/downloads/tile-%d.png', function (error) {
                if (error) {
                    console.error(error);
                    response.send(error).end();
                }
                else {

                    var cntr = 0;
                    var x = -(img_width / 2.0);
                    (function r() {
                        gm(img_path_arr[cntr])
                            .background('transparent')
                            // .resize(imageWidth, imageHeight)
                            // .gravity('Center')
                            .extent(img_split_step_size, img_height + (curve_bent_center_fraction * img_width), '-0-' + getOffsetAtX(x, radius, img_width))
                            .write('./images/downloads/tile-' + cntr + '.png', function (error) {
                                if (error) {
                                    console.error(error);
                                    response.send(error).end();
                                } else {
                                    console.log('offset x is ' + getOffsetAtX(x, radius, img_width));
                                    console.log('x is ' + x);
                                    cntr += 1;
                                    x += img_split_step_size;
                                    if (cntr < (img_width / parseFloat(img_split_step_size))) {
                                        console.log("cntr is " + cntr);
                                        r();
                                    }
                                    else {
                                        var gmstate = gm(img_path_arr[0]);
                                        for (var i = 1; i < img_path_arr.length; i++) {
                                            gmstate.append(img_path_arr[i], true);
                                        }
                                        gmstate.resize(400, 400)
                                            .write('./images/downloads/appended.png', function (err) {
                                                if (err) {
                                                    console.error(err);
                                                    response.send(err).end();
                                                }
                                                else {
                                                    response.send('done').end();
                                                }
                                            });
                                    }
                                }
                            });
                    })();

                    // finally write out the file asynchronously
                    /*gmstate.write('./images/downloads/appended.jpg', function (err) {
                        if (err) {
                            console.error(err);
                            response.send(err).end();
                        }
                        else{

                            gm('./images/downloads/appended.jpg')
                                .background('transparent')
                                // .resize(imageWidth, imageHeight)
                                // .gravity('Center')
                                .extent(1152, (1152 + ((1152 * Math.sqrt(3))/2)))
                                .write('./images/downloads/extended.png', function(error) {
                                    if (error) {
                                        console.error(error);
                                        response.send(error).end();
                                    } else {
                                        response.send('done').end();
                                    }
                                });
                        }
                    });*/
                }
            });

        /*gm('./images/downloads/gm.jpg')
            .font('./public/fonts/ubuntu/Ubuntu-Medium.ttf')
            .drawText(50, 50, 'This is a test')
            .write('./images/downloads/gm1.jpg', function (err) {
                if (err){
                    console.error(err);
                    response.send(err).end();
                }
                else{
                    response.send('done').end();
                }
            });*/
    }
    catch (err) {
        console.error(err);
        response.send(err).end();
    }

});

router.post('/gm-merge', function (request, response) {

    gm()
        .command('composite')
        .in('./images/downloads/appended.png')
        .in('-geometry', '+228+102')    // location of overlaying img is x,y
        .in('./images/downloads/coffee-mug.png')
        .write('./images/downloads/appended-composite.png', function (err) {
            if (err) {
                console.error(err);
                response.send(err).end();
            }
            else {
                response.send('done').end();
            }
        });

});

router.post('/gm-journal', function (request, response) {

    var journal_aspect_ratio = parseFloat(512 / 733);
    var img_aspect_ratio = parseFloat(1000 / 1000);

    var journal_width = 512;
    var img_width = 1000;

    getDominantImgColorHex(function (dcolor) {
        gm('./images/downloads/gm2.jpg')
            .resize(journal_width, journal_width)
            .background(dcolor)
            .gravity('Center')
            .extent(journal_width + 5, (journal_width + 5) / journal_aspect_ratio)
            .write('./images/downloads/gm_extent.jpg', function (err) {
                if (err) {
                    console.error(err);
                    response.send(err).end();
                }
                else {
                    gm('./images/downloads/gm_extent.jpg')
                        .background('transparent')
                        //.gravity('Center')
                        .extent(750, 875, '-135-64')
                        .write('./images/downloads/base_layer.png', function (err) {
                            if (err) {
                                console.error(err);
                                response.send(err).end();
                            }
                            else {
                                gm()
                                    .command('composite')
                                    .in('./images/products/journal_layer_1.png')
                                    // .in('-geometry', '+228+102')    // location of overlaying img is x,y
                                    .in('./images/downloads/base_layer.png')
                                    .write('./images/downloads/j-overlayed.jpg', function (err) {
                                        if (err) {
                                            console.error(err);
                                            response.send(err).end();
                                        }
                                        else {
                                            response.send('done').end();
                                        }
                                    });
                            }
                        })
                }
            });
    });
});

function getDominantImgColorHex(callback) {
    color_extract.topColours('./images/downloads/gm2.jpg', true, function (colours) {
        callback(color_extract.rgb2hex(colours[0][1]));
    });
}

router.post('/upload-interests', function (request, response) {

    var values = restructureInterestList(interestTableData);

    connection.query('INSERT INTO Interests VALUES ?', [values], function (err, data) {

        if (err) {
            throw err;
        }
        else {
            response.send('Done');
            response.end();
        }

    });

});

function restructureInterestList(interestTableData) {

    var masterArr = [];

    var categories = Object.keys(interestTableData);

    categories.forEach(function (category) {

        for (var i = 0; i < interestTableData[category].length; i++) {

            masterArr.push([
                uuidGen.v4(),
                interestTableData[category][i],
                category,
                undefined,
                moment.utc().format('YYYY-MM-DD HH:mm:ss')
            ]);

        }

    });

    /*var masterArr = [];

     console.log("interestlist  is " + JSON.stringify(interestlist, null, 3));

     interestlist.forEach(function (interest) {
     var subArr = [uuid, interest];
     masterArr.push(subArr);
     });*/

    return masterArr;
}

router.post('/send-email', function (request, response) {

    var startDate = moment().format('x');

    var emails = request.body.emailaddresses;

    var ses = new AWS.SES();

    var params = {
        Destination: {
            ToAddresses: emails
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: "This message body contains HTML formatting. It can, contain links like this one: <a class=\"ulink\" href=\"http://docs.aws.amazon.com/ses/latest/DeveloperGuide\" target=\"_blank\">Amazon SES Developer Guide</a>."
                },
                Text: {
                    Charset: "UTF-8",
                    Data: "This is the message body in text format."
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: "Test email"
            }
        },
        Source: "avneesh.khanna92@gmail.com"
    };

    ses.sendEmail(params, function (err, data) {
        if (err) {  // an error occurred
            console.error(err, err.stack);
            //throw err;
        }
        else {  // successful response
            // console.log("data is " + JSON.stringify(data, null, 3));

            var stopDate = moment().format('x');

            response.send({
                startDate: startDate,
                stopDate: stopDate,
                aws: data
            });
        }


        /*
         data = {
         MessageId: "EXAMPLE78603177f-7a5433e7-8edb-42ae-af10-f0181f34d6ee-000000"
         }
         */
    });


});

router.post('/cross-pattern-explore', function (request, response) {

    //TODO: Remove
    /*var rows = [
        {
            type: "SHORT",
            i: 0
        },
        {
            type: "CAPTURE",
            i: 1
        },
        {
            type: "CAPTURE",
            i: 2
        },
        {
            type: "CAPTURE",
            i: 3
        },
        {
            type: "SHORT",
            i: 4
        },
        {
            type: "SHORT",
            i: 5
        },
        {
            type: "CAPTURE",
            i: 6
        },
        {
            type: "SHORT",
            i: 7
        }
    ];*/
    var rows = [];

    feedutils.structureDataCrossPattern(rows)
        .then(function (rows) {
            response.send(rows);
        });

});

router.post('/progressive-img', function (request, response) {

    gm('./public/images/high-res-sample.jpg')
        .strip() // Removes any profiles or comments. Work with pure data
        .interlace('Line') // Line interlacing creates a progressive build up
        .quality(80) // Quality is for you to decide
        .write('./public/images/high-res-sample-progressive.jpg', function (err) {
            if (err) {
                console.error(err);
                response.status(500).send(err).end()
            }
            else {

                isProgressive.file('./public/images/high-res-sample.jpg').then(function (progressive) {
                    console.log('Original image is progressive: ' + progressive);
                });

                isProgressive.file('./public/images/high-res-sample-progressive.jpg').then(function (progressive) {
                    console.log('Converted image is is progressive: ' + progressive);
                });

                response.status(200).send('Converted').end()
            }
        });

});

router.get('/get-all-data', function (request, response) {

    config.getNewConnection()
        .then(function (connection) {
            connection.query('SELECT * FROM Entity', null, function (err, data) {
                if (err) {
                    response.status(500).send(err).end();
                }
                else {
                    response.status(200).send("done").end();
                }
            });
        });

});

router.post('/download-config', function (request, response) {
    utils.downloadS3ConfigFile()
        .then(function () {
            response.send('done').end();
        })
        .catch(function (err) {
            console.error(err);
            response.send(err).end();
        })

});

router.post('/update-config', function (request, response) {

    var token = request.query.token;

    utils.updateS3ConfigFile(token)
        .then(function () {
            response.send('done').end();
        })
        .catch(function (err) {
            console.error(err);
            response.send(err).end();
        })

});

router.get('/bitly-link', function (request, response) {

    var bitly = config.getBitlyClient();

    var longUrl = 'http://www.google.com';

    request_client(bitly.api_base_url + "/v3/linkk/lookup?url=" +
        decodeURIComponent(longUrl) +
        "&access_token=" +
        bitly.generic_access_token, function (err, res, body) {
        if (err) {
            response.send(err).end();
        }
        else {
            response.send({
                res: res,
                body: body
            }).end();
        }
    })
});

router.post('/invalidate-cfrnt', function (request, response) {

    imgutils.invalidateCloudfrontObject([
        '/Users/5919758c-d32a-4294-9ee9-deabbe0a9d06/Capture/14214d36-a438-4eae-8795-d15de116b4a7-small.jpg'
    ], {
        Quantity: 1
    })
        .then(function (res) {
            response.send(res).end();
        })
        .catch(function (err) {
            response.status(500).send(err).end();
        });

});

router.get('/get-keys', function (request, response) {
    cachemanager.getAllCacheKeys("d:*")
        .then(function (res) {
            response.send(res)
            // return cachemanager.deleteCacheKeys(res);
        })
        .then(response.send, response.send);

});

router.get('/get-redis-fast', function (request, response) {
    cachemanager.getAllCacheKeys("d:ent:info*")
        .then(function (res) {
            return getMultipleRedisValuesFast(res);
        })
        .then(function () {
            response.send('done').end();
        }, function (err) {
            response.send(err).end();
        });

});

router.get('/get-redis-slow', function (request, response) {
    cachemanager.getAllCacheKeys("d:ent:info*")
        .then(function (res) {
            return getMultipleRedisValuesSlow(res);
        })
        .then(function () {
            response.send('done').end();
        }, function (err) {
            response.send(err).end();
        });

});

function getMultipleRedisValuesFast(keys) {
    return new Promise(function (resolve, reject) {

        var cntr = 0;

        async.each(keys, function (key, callback) {

            key = key.replace('d:', '');

            cachemanager.getCacheHMap(key)
                .then(function (val) {
                    console.log(cntr++);
                    callback();
                })
                .catch(function (err) {
                    callback(err);
                });

        }, function (err) {
            if(err){
                reject(err);
            }
            else{
                resolve();
            }
        });
    });
}

function getMultipleRedisValuesSlow(keys) {
    return new Promise(function (resolve, reject) {

        var cntr = 0;

        async.eachSeries(keys, function (key, callback) {

            key = key.replace('d:', '');

            cachemanager.getCacheHMap(key)
                .then(function (val) {
                    console.log(cntr++);
                    callback();
                })
                .catch(function (err) {
                    callback(err);
                });

        }, function (err) {
            if(err){
                reject(err);
            }
            else{
                resolve();
            }
        });
    });
}

router.post('/update-dy-column', function (request, response) {

    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return new Promise(function (resolve, reject) {
                connection.query('UPDATE User SET ? = ? WHERE uuid = "9ba39cfc-ac45-4a06-a20b-b5ab08cfc728"', ['firstname', 'Avneesh'], function(err, rows){
                    if(err){
                        reject(err);
                    }
                    else{
                        resolve();
                    }
                });
            });
        })
        .then(function () {
            response.send('done').end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

module.exports = router;

