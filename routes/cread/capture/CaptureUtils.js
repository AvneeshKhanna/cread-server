/**
 * Created by avnee on 01-11-2017.
 */
'use-strict';

var request_client = require('request');
var fs = require('fs');
var imagesize = require('image-size');

var utils = require('../utils/Utils');

var Canvas = require('canvas'),
    Image = Canvas.Image;

var gm = require('gm');
var rootpath = './images/uploads/capture/';

/**
 * Function to download the high resolution version of capture to the server
 * */
function downloadCapture(uuid, captureid, tofilepath){
    return new Promise(function (resolve, reject) {
        console.log("capture url is " + JSON.stringify(utils.createCaptureUrl(uuid, captureid), null, 3));
        request_client.head(utils.createCaptureUrl(uuid, captureid), function(err, res, body){

            console.log('content-type:', res.headers['content-type']);
            console.log('content-length:', res.headers['content-length']);

            //Image doesn't exists
            if(res.headers['content-length'] === undefined){
                reject(new Error('Image does not exists'));
            }
            else{
                request_client(utils.createCaptureUrl(uuid, captureid))
                    .pipe(fs.createWriteStream(tofilepath))
                    .on('close', function () {
                        this.end();
                        resolve(tofilepath);
                    });
            }
        });
    })
}

function addWatermarkToCapture(captureimg, watermark, captureid) {
    return new Promise(function (resolve, reject) {

        gm(captureimg)
            .size(function (err, size) {
                if(err){
                    reject(err);
                }
                else{
                    fs.readFile(captureimg, function(err, image){
                        if (err) {
                            reject(err);
                        }
                        else{

                            console.log("size " + JSON.stringify(size, null, 3));

                            var img = new Image;
                            img.src = image;

                            Canvas.registerFont('./public/fonts/helvetica-neue/HelveticaNeueMedium.ttf', {family: 'Helvetica'});

                            var canvas = new Canvas.createCanvas(size.width, size.height),
                                ctx = canvas.getContext('2d');

                            //Draw base image on canvas
                            ctx.drawImage(img, 0, 0, size.width, size.height);

                            //Draw black box on bottom left corner

                            ctx.fillStyle = '#FFFFFF';
                            ctx.strokeStyle = '#424242';

                            var textsize = 0.025 * size.height;
                            var leftpadding = 0.015 * size.height;

                            var btmoffset = 0.0075 * size.height;

                            ctx.font = textsize + 'px "Helvetica"';
                            ctx.fillText(watermark, leftpadding, (size.height - textsize) + btmoffset);

                            var out = fs.createWriteStream(rootpath + captureid + '.jpg')
                                , stream = canvas.jpegStream();

                            stream
                                .pipe(out)
                                .on('close', function () {
                                    this.end();
                                    resolve(rootpath + captureid + '.jpg');
                                });

                        }
                    });

                    /*resolve({
                        imagepath: image,
                        size: size
                    });*/
                }
            });
    });
}

module.exports = {
    downloadCapture: downloadCapture,
    addWatermarkToCapture: addWatermarkToCapture
};