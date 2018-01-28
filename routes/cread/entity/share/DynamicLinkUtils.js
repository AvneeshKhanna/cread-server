/**
 * Created by avnee on 08-12-2017.
 */
'use-strict';

var request_client = require('request');
var config = require('../../../Config');
var serverbaseurl = config.server_url;

function generateShareEntityDeepLink(entityid, entityurl, creatorname){
    return serverbaseurl + '/entity-share-link?' +
        'entityid=' +
        entityid +
        '&creatorname=' +
        creatorname +
        '&entityurl=' +
        encodeURIComponent(entityurl);
}

function generateLongDynamicLink(deeplink){
    return config.firebase_dynamiclink_domain +
        '?link=' +
        encodeURIComponent(deeplink) +
        '&apn=' +
        'com.thetestament.cread' +    //Android Package Name
        '&ibi=' +
        'com.TheTestament.Cread' +  //iOS Bundle ID
        '&imv=' +
        '1.0.13' +  //iOS minimum version
        '&amv=' +
        '12'; //Android minimum version code
}

/**
 * Function to shorten a long firebase dynamic link
 * */
function shortenDynamicLink(dylink) {
    return new Promise(function (resolve, reject) {
        var firebase_request_params = {
            json: {
                longDynamicLink: dylink,
                suffix: {
                    option: "UNGUESSABLE"
                }
            }
        };

        request_client.post(
            'https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=' + config.firebase_web_api_key,
            firebase_request_params,
            function (error, res, body) {

                console.log("firebase shorten link response is " + JSON.stringify(res, null, 3));

                if(error){
                    reject(error);
                }
                else if (res.statusCode === 200) {
                    resolve(body.shortLink);
                }
                else{
                    reject(new Error('Could not generate shortened dynamic link via Firebase'));
                }
            }
        );
    });
}

module.exports = {
    generateShareEntityDeepLink: generateShareEntityDeepLink,
    generateLongDynamicLink: generateLongDynamicLink,
    shortenDynamicLink: shortenDynamicLink
};