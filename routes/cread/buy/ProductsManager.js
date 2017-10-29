/**
 * Created by avnee on 27-10-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var buyutils = require('./BuyUtils');

//TODO: Add image url for entityid in response
router.post('/load', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        }, function () {
            response.send({
                tokenstatus: 'invalid'
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .then(function (conn) {
            connection = conn;
            return buyutils.loadAllProducts(connection);
        })
        .then(function (products) {
            return structureProductDetails(products);
        })
        .then(function (products) {
            console.log("products are " + JSON.stringify(products, null, 3));
            response.send({
                tokenstatus: 'valid',
                data: {
                    products: products
                }
            });
            response.end();
            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

function structureProductDetails(products) {
    return new Promise(function (resolve, reject) {
        products.forEach(function (product) {
            if(product.type === 'SHIRT'){
                product.sizes = [
                    'small',
                    'medium',
                    'large'
                ];
                product.colors = [
                    '#000000',
                    '#FFFFFF',
                    '#A2A2A2'
                ];
                product.price = [
                    400,
                    400,
                    400
                ];
                product.quantity = [
                    1,
                    2,
                    3,
                    4,
                    5
                ];
                product.entityimgurl = 'https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/quote.jpg';
            }
            else if(product.type === 'POSTER'){
                product.sizes = [
                    'small',
                    'medium',
                    'large'
                ];
                product.colors = [
                    '#000000',
                    '#FFFFFF',
                    '#A2A2A2'
                ];
                product.price = [
                    400,
                    400,
                    400
                ];
                product.quantity = [
                    1,
                    2,
                    3,
                    4,
                    5
                ];
                product.entityimgurl = 'https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/quote.jpg';
            }
            else if(product.type === 'FRAME'){
                product.sizes = [
                    'small',
                    'medium',
                    'large'
                ];
                product.colors = [
                    '#000000',
                    '#FFFFFF',
                    '#A2A2A2'
                ];
                product.price = [
                    400,
                    400,
                    400
                ];
                product.quantity = [
                    1,
                    2,
                    3,
                    4,
                    5
                ];
                product.entityimgurl = 'https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/quote.jpg';
            }
            else{   //COFFEE_MUG
                product.sizes = [
                    'small',
                    'medium',
                    'large'
                ];
                product.colors = [
                    '#000000',
                    '#FFFFFF',
                    '#A2A2A2'
                ];
                product.price = [
                    400,
                    400,
                    400
                ];
                product.quantity = [
                    1,
                    2,
                    3,
                    4,
                    5
                ];
                product.entityimgurl = 'https://s3-ap-northeast-1.amazonaws.com/testamentbucketdev/quote.jpg';
            }
        });

        resolve(products);

    });
}

module.exports = router;