/**
 * Created by avnee on 11-05-2018.
 */
'use-strict';

var CryptoJS = require('crypto-js');

var config = require('../Config');

function encryptPayloadForAuth(payload) {
    return CryptoJS.AES.encrypt(JSON.stringify(payload), config['crypto-secret-key']);
}

function decryptPayloadAuth(encrypted) {
    return new Promise(function (resolve, reject) {
        try{
            // Decrypt Data
            var decryptedBytes = CryptoJS.AES.decrypt(encrypted, config['crypto-secret-key']);
            resolve(JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8)));
        }
        catch(err){
            reject(err)
        }
    });
}

module.exports = {
    encryptPayloadForAuth: encryptPayloadForAuth,
    decryptPayloadAuth: decryptPayloadAuth
};