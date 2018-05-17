/**
 * Created by avnee on 17-05-2018.
 */
'use-strict';

var moment = require('moment');

var config = require('../../../Config');

var CLOUDFRONT = config.CLOUDFRONT;
var AWS = config.AWS;
var cloudfrontClient = new AWS.CloudFront();

/**
 * A function to invalidate an object from AWS Cloudfront distribution
 * */
function invalidateCloudfrontObject(object_paths, options) {
    return new Promise(function (resolve, reject) {
        var params = {
            DistributionId: CLOUDFRONT.distributionid,
            InvalidationBatch: {
                CallerReference: moment().format('x'), /* Unique string value to identify the request */
                Paths: {
                    Quantity: options.Quantity,
                    Items: object_paths
                }
            }
        };
        cloudfrontClient.createInvalidation(params, function(err, data) {
            if (err) {
                reject(err);    // an error occurred
            }
            else     {
                console.log(data);
                resolve(data);  // successful response
            }
        });
    });
}

module.exports = {
    invalidateCloudfrontObject: invalidateCloudfrontObject
}