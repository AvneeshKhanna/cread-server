/**
 * Created by avnee on 22-06-2017.
 */

var config = require('../../Config');
var AWS = config.AWS;

/**
 * Function to add/update the given key value as query parameter to the uri
 * */
function updateQueryStringParameter(uri, key, value) {
    var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
    var separator = uri.indexOf('?') !== -1 ? "&" : "?";
    if (uri.match(re)) {
        return uri.replace(re, '$1' + key + "=" + value + '$2');
    }
    else {
        return uri + separator + key + "=" + value;
    }
}

/**
* Sends an AWS Transactional SMS to the given phonenumber
* */
function sendAWSSMS(message, phonenumber, callback){

    if(phonenumber.length != 10){
        var err = new Error('Phone number must be exactly 10-digits in length');
        callback(err, null);
        return;
    }

    var sns = new AWS.SNS();

    var params = {
        attributes : {
            DefaultSMSType : 'Transactional'
        }
    };

    sns.setSMSAttributes(params, function(err, data){

        if(err){
            callback(err, null);
        }
        else{

            var params = {
                Message : message,
                PhoneNumber : '+91' + phonenumber
            };

            console.log('sns request sending');

            sns.publish(params, function(err, data){

                if(err){
                    callback(err, null);
                }
                else{
                    callback(null, data);
                }

            });
        }
    });

}

module.exports = {
    updateQueryStringParameter: updateQueryStringParameter,
    sendAWSSMS: sendAWSSMS
};