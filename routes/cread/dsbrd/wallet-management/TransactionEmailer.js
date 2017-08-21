/**
 * Created by avnee on 21-08-2017.
 */
'use strict';

var ejs = require('ejs');

var AWS = require('aws-sdk');
var ses = new AWS.SES();

function sendTransactionEmail(clientemail, paymentdetails, subject, billingdetails, callback) {

    var renderdata = {
        clientname: clientname,
        paymentid: paymentdetails.paymentid,
        billingname: billingdetails.billingname,
        billingaddr: billingdetails.billingaddr,
        amount: paymentdetails.amount
    };

    ejs.renderFile(filename, renderdata, function (err, strhtml) {
        if(err){
            callback(err, null);
        }
        else {

            var params = {
                Destination: {
                    ToAddresses: [
                        clientemail
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
                Source: "admin@cread.in"
            };

            ses.sendEmail(params, function(err, data) {
                if (err) {
                    callback(err, null);
                    //throw err;
                }
                else {
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

module.exports = {
    sendTransactionEmail: sendTransactionEmail
};