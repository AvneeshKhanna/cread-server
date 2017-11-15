/**
 * Created by avnee on 01-11-2017.
 */
'use-strict';

var request_client = require('request');
var fs = require('fs');
var imagesize = require('image-size');

var utils = require('../utils/Utils');

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

function isMerchantable(imgpath) {
    return new Promise(function (resolve, reject) {
        if(imagesize(imgpath).width < 2000){
            resolve(true);
        }
        else{
            resolve(false);
        }
    });
}

module.exports = {
    downloadCapture: downloadCapture
};