/**
 * Created by avnee on 26-03-2018.
 */
'use-strict';

var CryptoJS = require('crypto-js');

var config = require('../../../Config');
var serverbaseurl = config.server_url;

function getEncryptedReferralPayload(referrer_uuid){
    var payload = {
        referrer_uuid: referrer_uuid
    };

    return CryptoJS.AES.encrypt(JSON.stringify(payload), config['crypto-secret-key']);
}

function generateShareAppDeepLink(referrer_uuid){

    var cipher_text = getEncryptedReferralPayload(referrer_uuid);

    return serverbaseurl
        + '?referral_code='
        + encodeURIComponent(cipher_text);
}

module.exports = {
    generateShareAppDeepLink: generateShareAppDeepLink,
    getEncryptedReferralPayload: getEncryptedReferralPayload
};
