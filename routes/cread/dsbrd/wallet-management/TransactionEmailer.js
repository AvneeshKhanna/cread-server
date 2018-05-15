/**
 * Created by avnee on 21-08-2017.
 */
'use strict';

var ejs = require('ejs');
var path = require('path');

var projectpath = path.join(__dirname, '../../../../');

var envconfig = require('config');
var envtype = envconfig.get('type');

var config = require('../../../Config');
var AWS = config.AWS;

function sendTransactionEmail(type, clientdetails, subject, paymentdetails, billingdetails, callback) {

    var filename;

    switch (type) {
        case "SUCCESS":
            filename = "success.ejs";
            break;
        case "FAIL":
            filename = "fail.ejs";
            break;
        case "REFUND":
            filename = "refund.ejs";
            break;
        default:
            callback(new Error("Invalid argument \"type\""));
            return;
    }

    var renderdata = {
        clientname: clientdetails.clientname,
        paymentid: paymentdetails.paymentid,
        billingname: billingdetails.billingname,
        billingcontact: billingdetails.billingcontact,
        amount: paymentdetails.amount
    };

    ejs.renderFile(projectpath + "/views/email/client-wallet-transaction/" + filename, renderdata, function (err, strhtml) {
        if (err) {
            callback(err, null);
        }
        else {

            var params = {
                Destination: {
                    ToAddresses: [
                        clientdetails.clientemail
                    ]
                },
                Message: {
                    Body: {
                        Html: {
                            Charset: "UTF-8",
                            Data: strhtml
                        }/*,
                         Text: {
                         Charset: "UTF-8",
                         Data: "This is the message body in text format."
                         }*/
                    },
                    Subject: {
                        Charset: "UTF-8",
                        Data: subject
                    }
                },
                Source: "Cread Inc. <admin@cread.in>"
            };

            setAWSConfigForSES(AWS);
            var ses = new AWS.SES();

            ses.sendEmail(params, function (err, data) {

                resetAWSConfig(AWS);

                if (err) {
                    callback(err, null);
                    //throw err;
                }
                else {
                    console.log("Transaction email response " + JSON.stringify(data, null, 3));
                    callback(null, data);
                }

                /*
                 data = {
                 MessageId: "EXAMPLE78603177f-7a5433e7-8edb-42ae-af10-f0181f34d6ee-000000"
                 }
                 */
            });

        }
    });

}

function sendOrderTransactionEmail(type, customerdetails, subject, paymentdetails, productdetails, callback) {

    var filename;

    switch (type) {
        case "SUCCESS":
            filename = "success.ejs";
            break;/*
        case "FAIL":
            filename = "fail.ejs";
            break;
        case "REFUND":
            filename = "refund.ejs";
            break;*/
        default:
            callback(new Error("Invalid argument \"type\""));
            return;
    }

    var renderdata = {
        name: customerdetails.name,
        paymentid: paymentdetails.paymentid,
        payment_mode: paymentdetails.payment_mode,
        billingname: customerdetails.billingname,
        billingcontact: customerdetails.billingcontact,
        amount: paymentdetails.amount,
        product_name: productdetails.product_name,
        product_details: productdetails.product_details,
        shippingaddress: customerdetails.shippingaddress
    };

    ejs.renderFile(projectpath + "/views/email/order-place/" + filename, renderdata, function (err, strhtml) {
        if (err) {
            callback(err, null);
        }
        else {

            var params = {
                Destination: {
                    ToAddresses: [
                        customerdetails.email
                    ]
                },
                Message: {
                    Body: {
                        Html: {
                            Charset: "UTF-8",
                            Data: strhtml
                        }/*,
                         Text: {
                         Charset: "UTF-8",
                         Data: "This is the message body in text format."
                         }*/
                    },
                    Subject: {
                        Charset: "UTF-8",
                        Data: subject
                    }
                },
                Source: "Cread Support. <help@cread.in>"
            };

            if(config.isProduction()){
                params.Destination.BccAddresses = [
                    'admin@thetestament.com',
                    'nishantmittal2410@gmail.com',
                    'avneesh.khanna92@gmail.com'
                ];

                params.Destination.ToAddresses.push('admin@cread.in');  //This is done in case, customer's email address is invalid, a mandatory mail is sent to Cread's account
            }

            setAWSConfigForSES(AWS);
            var ses = new AWS.SES();

            ses.sendEmail(params, function (err, data) {

                resetAWSConfig(AWS);

                if (err) {
                    callback(err, null);
                    //throw err;
                }
                else {
                    console.log("Ordering email response " + JSON.stringify(data, null, 3));
                    callback(null, data);
                }

                /*
                 data = {
                 MessageId: "EXAMPLE78603177f-7a5433e7-8edb-42ae-af10-f0181f34d6ee-000000"
                 }
                 */
            });

        }
    });

}

/**
 * Resets the region and identity-pool-id for AWS to EU_WEST_1
 * */
function setAWSConfigForSES(AWS) {
    AWS.config.region = 'eu-west-1';
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'eu-west-1:d29fce0a-ac1a-4aaf-b3f6-0bc48b58b87e'
    });
}

/**
 * Resets the region and identity-pool-id for AWS to AP_NORTHEAST_1
 * */
function resetAWSConfig(AWS) {
    AWS.config.region = 'ap-northeast-1';
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'ap-northeast-1:863bdfec-de0f-4e9f-8749-cf7fd96ea2ff'
    });
}

module.exports = {
    sendTransactionEmail: sendTransactionEmail,
    sendOrderTransactionEmail: sendOrderTransactionEmail,
    setAWSConfigForSES: setAWSConfigForSES,
    resetAWSConfig: resetAWSConfig
};