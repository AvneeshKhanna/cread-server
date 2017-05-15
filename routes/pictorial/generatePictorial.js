/**
 * Created by avnee on 04-05-2017.
 */
var express = require('express');
var router = express.Router();

var fs = require('fs');
var opentype = require('opentype.js');
var request_client = require('request');
var jimp = require('jimp');

const path = require('path');

var AWS = require('aws-sdk');
AWS.config.region = 'ap-northeast-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff',
});

var docClient = new AWS.DynamoDB.DocumentClient();
var envconfig = require('config');
var userstbl_ddb = envconfig.get('dynamoDB.users_table');
var s3bucket = envconfig.get('s3.bucket');
var s3 = new AWS.S3();

var profilepicwidth = 108;

var canvaswidth = 800,
    canvasheight = 450;

var Canvas = require('canvas'),
    Image = Canvas.Image;

/*var oswald_light = new Font('Oswald-Light', '../../public/fonts/oswald/Oswald-Light.ttf');
var oswald_extra_light = new Font('Oswald-ExtraLight', '../../public/fonts/oswald/Oswald-Light.ttf');*/

// Canvas.registerFont('../../public/fonts/oswald/Oswald-Light.ttf', {family: 'Oswald'});

var username = "Avneesh Khanna";

var res, req;
var uuid, profilepicurl, template_name;

var rootpath = path.join(__dirname, '../../');

router.post('/', function (request, response) {

    uuid = request.body.uuid;
    profilepicurl = request.body.profilepicurl;
    template_name = request.body.template_name;
    username = request.body.username;

    req = request;
    res = response;

    generate(profilepicurl);

});

//generate('http://design.ubuntu.com/wp-content/uploads/bcce/cof_orange_hex.jpg');

function generate(profilepicurl){

    console.log('generate');

    var sourceimagepath;

    downloadProfileToServer(profilepicurl, rootpath + '/public/images/profile-pic-dwnld.jpg', function (err) {
        if(err){
            sourceimagepath = rootpath + '/public/images/user_profile_placeholder.png';
            console.log('image does not exists');
            readPngProfilePic(sourceimagepath); //Skipping png conversion
        }
        else{
            sourceimagepath = rootpath + '/public/images/profile-pic-dwnld.jpg';
            convertToPng(sourceimagepath);
            console.log('done');
        }
    });

}

function convertToPng(imagepath) {

    //reading jpg image
    jimp.read(imagepath, function (err, image) {
        if (err) {
            throw err;
        }

        // converting to png
        image.write(rootpath + '/public/images/profile-pic.png', function (err, image) {

            if(err){
                console.error(err);
                throw err;
            }

            readPngProfilePic(rootpath + '/public/images/profile-pic.png');
        });

    });

}

function readPngProfilePic(imagepath) {

    fs.readFile(imagepath, function(err, image){
        if (err) {
            throw err;
        }

        img = new Image;
        img.src = image;

        circleImage(img);
    });

}

function downloadProfileToServer(uri, filepath, callback){
    request_client.head(uri, function(err, res, body){

        console.log('content-type:', res.headers['content-type']);
        console.log('content-length:', res.headers['content-length']);

        //Image doesn't exists
        if(res.headers['content-length'] == undefined){
            callback(new Error('Empty URL'));
            return;
        }

        request_client(uri)
            .pipe(fs.createWriteStream(filepath))
            .on('close', function () {
                this.end();
                callback();
            });
    });
}

function circleImage(img){

    var profilepiccanvas = new Canvas(profilepicwidth, profilepicwidth),
        profilepicctx = profilepiccanvas.getContext('2d');

    profilepicctx.beginPath();
    profilepicctx.arc(profilepicwidth/2, profilepicwidth/2, profilepicwidth/2, 0, Math.PI * 2, true);
    profilepicctx.closePath();
    profilepicctx.clip();

    profilepicctx.drawImage(img, 0, 0, profilepicwidth, profilepicwidth);

    profilepicctx.beginPath();
    profilepicctx.arc(0, 0, profilepicwidth/2, 0, Math.PI * 2, true);
    profilepicctx.clip();
    profilepicctx.closePath();
    profilepicctx.restore();

    writeCircledImg(profilepiccanvas);
}

function createTemplate() {

    var templatecanvas = new Canvas(canvaswidth, canvasheight)
        , tempctx = templatecanvas.getContext('2d');


    //selecting template name based on
    fs.readFile(rootpath + '/public/images/pictorial/' + template_name + '.png', function(err, image){
        if (err) {
            throw err;
        }

        img = new Image;
        img.src = image;

        tempctx.drawImage(img, 0, 0, canvaswidth, canvasheight);

        fs.readFile(rootpath + '/public/images/profile-pic-created.png', function(err, image){
            if (err) {
                throw err;
            }

            img = new Image;
            img.src = image;

            tempctx.drawImage(img, 39, 71);

            writeTemplateImg(templatecanvas, function () {
                fillTextOnImg(templatecanvas);
            });

        });

    });
}

function writeCircledImg(profilepiccanvas) {

    var out = fs.createWriteStream(rootpath + '/public/images/profile-pic-created.png')
        , stream = profilepiccanvas.pngStream();

    stream.pipe(out);

    /*stream.on('data', function(chunk){
        out.write(chunk);
    });

    stream.on('end', function(){
        out.end();
        console.log('saved profile png');
        createTemplate();
    });*/

    console.log('saved profile png');
    createTemplate();
}

function writeTemplateImg(templatecanvas, callback) {

    console.log('writeTemplateImg');

    var out = fs.createWriteStream(rootpath + '/public/images/pictorial_template_created.png')
        , stream = templatecanvas.pngStream();

    stream.pipe(out);

    /*stream.on('data', function(chunk){
        out.write(chunk);
    });

    stream.on('end', function(){
        out.end();
        console.log('template saved');
        callback();
    });*/

    console.log('template saved');
    callback();

}

function fillTextOnImg(templatecanvas){

    console.log('fillTextOnImg');

    var ctx = templatecanvas.getContext('2d');

    var font = opentype.loadSync(rootpath + '/public/fonts/oswald/Oswald-Light.ttf');
    font.draw(ctx, username, 163, 151, 56.25);

    font = opentype.loadSync(rootpath + '/public/fonts/oswald/Oswald-ExtraLight.ttf');
    font.draw(ctx, 'recommended you for a job on', 39, 268, 29.17);

    font = opentype.loadSync(rootpath + '/public/fonts/oswald/Oswald-Light.ttf');
    font.draw(ctx, 'Market Recruit', 39, 321, 46);

    writeTemplateImg(templatecanvas, function () {
        uploadToServer(rootpath + '/public/images/pictorial_template_created.png');
    });


    /*opentype.load(rootpath + '/public/fonts/oswald/Oswald-Light.ttf', function(err, font) {
        if (err) {
            console.log('Font could not be loaded: ' + err);
            throw err;
        } else {
            var ctx = templatecanvas.getContext('2d');
            // Construct a Path object containing the letter shapes of the given text.
            // The other parameters are x, y and fontSize.
            // Note that y is the position of the baseline.
            var path = font.getPath(username, 163, 151, 56.25);
            // If you just want to draw the text you can also use font.draw(ctx, text, x, y, fontSize).
            //path.draw(ctx);
            font.draw(ctx, username, 163, 151, 56.25);

            writeTemplateImg(templatecanvas, function () {
                res.sendFile(rootpath + '/public/images/pictorial_template_created.png');
            });
        }
    });*/

    /*gm(rootpath + '/public/images/pictorial_template_created.png')
        .font(rootpath + "/public/fonts/economica/Economica-Bold.ttf", 56.25)
        .drawText(163, 151, username)
        .font(rootpath + "/public/fonts/economica/Economica-Regular.ttf", 29.17)
        .drawText(39, 268, 'recommended you for a job on')
        .font(rootpath + "/public/fonts/economica/Economica-Bold.ttf", 46)
        .drawText(39, 321, 'Market Recruit')
        .write(rootpath + "/public/images/pictorial_template_created.png", function (err) {
            if (err){
                throw err;
            }else {
                console.log('saved pictorial png');

                res.sendFile(rootpath + '/public/images/pictorial_template_created.png');
            }
        });*/

    /*var tempctx = templatecanvas.getContext('2d');

    tempctx.font = '56.25px "Oswald-Light.ttf"';
    tempctx.fillText(username, 163, 151);

    writeTemplateImg(templatecanvas, function () {
        res.sendFile(rootpath + '/public/images/pictorial_template_created.png');
    });*/
}

function uploadToServer(imagepath) {

    console.log('upload s3');

    var readStream = fs.createReadStream(imagepath);

    var params = {
        TableName: userstbl_ddb,
        Key: {
            'UUID' : uuid
        },
        UpdateExpression: 'set #template = :val',
        ExpressionAttributeNames: {'#template' : 'PicTemplate'},
        ExpressionAttributeValues: {
            ':val' : template_name
        }
    };

    docClient.update(params, function (err, data) {
        if(err){
            throw err;
        }
        else {

            console.log('ddb update');

            var params = {
                Bucket: s3bucket,
                Key: 'Users/' + uuid+ '/Pictorial/' + template_name + '.png', /* required */
                ACL: 'public-read',
                Body: readStream
            };

            s3.putObject(params, function(err, data) {

                console.log('s3 putObject');

                if (err) {
                    console.log(err, err.stack);
                    throw err;
                }
                else{
                    readStream.close();
                    res.send('Done');
                    res.end();
                }
            });
        }
    });

    /*readStream.on('data', function () {

    });

    readStream.on('end', function () {
        this.end();
    });

    readStream.on('error', function (err, data) {
       throw err;
    });*/



}

module.exports = router;