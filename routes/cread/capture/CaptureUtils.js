/**
 * Created by avnee on 01-11-2017.
 */
'use-strict';

var request_client = require('request');
var utils = require('../utils/Utils');

/**
 * Function to download the high resolution version of capture to the server
 * */
function downloadCapture(uuid, captureid, toFile){
    return new Promise(function (resolve, reject) {
        request_client.head(utils.createCaptureUrl(uuid, captureid), function(err, res, body){

            console.log('content-type:', res.headers['content-type']);
            console.log('content-length:', res.headers['content-length']);

            //Image doesn't exists
            if(res.headers['content-length'] === undefined){
                reject(new Error('Image does not exists'));
            }
            else{
                request_client(utils.createCaptureUrl(uuid, captureid))
                    .pipe(fs.createWriteStream(toFile))
                    .on('close', function () {
                        this.end();
                        resolve();
                    });
            }
        });
    })
}

module.exports = {
    downloadCapture: downloadCapture
};