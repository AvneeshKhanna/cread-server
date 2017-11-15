/**
 * Created by avnee on 03-11-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var userprofileutils = require('../user-manager/UserProfileUtils');

var uuidgen = require('uuid');
var fs = require('fs');
var opentype = require('opentype.js');

var utils = require('../utils/Utils');

var entityutils = require('../entity/EntityUtils');
var captureutils = require('../capture/CaptureUtils');

var rootdownloadpath = './images/downloads/';

var Canvas = require('canvas'),
    Image = Canvas.Image,
    Font = Canvas.registerFont;

var scaleFactor = 1.2;  //TODO: Remove default value

var gm = require('gm');

router.post('/', function (request, response) {

    var entityid = request.body.entityid;

    var connection;
    var short;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return entityutils.retrieveShortDetails(connection, entityid);
        })
        .then(function (shrt) {
            console.log("shrt is " + JSON.stringify(shrt, null, 3));
            short = shrt;
            return captureutils.downloadCapture(short.captureuuid, short.capid, rootdownloadpath + short.capid + '.jpg');
        })
        .then(function (dwnldcapturepath) {
            return readImageDimensions(dwnldcapturepath);
        })
        .then(function (capture) {

            scaleFactor = capture.size.width / short.img_width;

            console.log("scaleFactor: " + JSON.stringify(scaleFactor, null, 3));

            fs.readFile(capture.imagepath, function(err, image){
                if (err) {
                    throw err;
                }
                else{
                    var img = new Image;
                    img.src = image;

                    return canvasGenerate(capture.size.width,
                        capture.size.height,
                        img,
                        short.txt,
                        scaleFactor * short.dx,
                        scaleFactor * short.dy,
                        scaleFactor * short.textsize,
                        short.textcolor/*,
                        short.textgravity*/);
                }
            });
            /*gm(capture.imagepath)
                // .region(scaleFactor * short.width, scaleFactor * short.height, scaleFactor * short.dx, scaleFactor * short.dy)
                .fill('#' + short.textcolor.slice(2, short.textcolor.length))
                // .gravity(short.textgravity)
                .quality(100)
                // .fill('#' + short.textcolor.slice(2, short.textcolor.length))  //To remove the alpha channel values
                .font('./public/fonts/helvetica-neue/HelveticaNeueMedium.ttf')
                .fontSize(scaleFactor * short.textsize)
                // .setDraw('color', 0, 0, 'reset')
                .drawText(scaleFactor * (short.dx), scaleFactor * (short.dy), short.txt, short.textgravity)
                .write(rootdownloadpath + 'gm.jpg', function (err) {
                    if (err){
                        throw err;
                    }
                    else{
                        response.send('done').end();
                    }
                });*/
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

function canvasGenerate(width, height, captureimg, shorttxt, x, y, fontSize, textcolor, textgravity) {
    return new Promise(function (resolve, reject) {
        try{

            console.log("dx and dy are " + JSON.stringify(x + " " + y, null, 3));

            var font = Font('./public/fonts/ubuntu/Ubuntu-Medium.ttf', {family: 'Ubuntu'});
            // var font = Font('./public/fonts/barlow/Barlow-Medium.ttf', {family: 'Barlow'});

            var canvas = new Canvas.createCanvas(width, height),
                ctx = canvas.getContext('2d');

            var txtcolor = '#' + textcolor.slice(2, textcolor.length);

            console.log("textcolor is " + JSON.stringify(txtcolor, null, 3));

            ctx.fillStyle = txtcolor;
            ctx.drawImage(captureimg, 0, 0, width, height);

            ctx.font = fontSize + 'px "Ubuntu"';/*Ubuntu  Barlow*/
            ctx.fillText(shorttxt, x, y);

            /*var font = opentype.loadSync('./public/fonts/helvetica-neue/HelveticaNeueMedium.ttf');
            font.draw(ctx, shorttxt, x, y, fontSize);*/

            var out = fs.createWriteStream(rootdownloadpath + 'gm.jpg')
                , stream = canvas.jpegStream();

            stream
                .pipe(out)
                .on('close', function () {
                    this.end();
                    resolve();
                });
        }
        catch (err){
            reject(err);
        }
    })
}

function readImageDimensions(image) {
    return new Promise(function (resolve, reject) {
        gm(image)
            .size(function (err, size) {
                if(err){
                    reject(err);
                }
                else{
                    resolve({
                        imagepath: image,
                        size: size
                    });
                }
            });
    });
}

module.exports = router;