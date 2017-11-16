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

router.post('/load', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;

    var connection;
    var products;

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
        .then(function (prdcts) {
            products = prdcts;
            return retrieveLastPlacedDetails(connection, uuid);
        })
        .then(function (details) {
            try{
                var billing_contact = details.billing_contact;
                var detailsexist = false;

                delete details.billing_contact;

                if(!details.ship_addr_2){
                    details.ship_addr_2 = "";
                }

                if(!details.billing_alt_contact){
                    details.billing_alt_contact = "";
                }

                for(var key in details){
                    if(details[key]){
                        detailsexist = true;
                    }
                }
            }
            catch(err){
                throw err;
            }

            console.log("products are " + JSON.stringify(products, null, 3));
            console.log("details are " + JSON.stringify(details, null, 3));

            response.send({
                tokenstatus: 'valid',
                data: {
                    products: products,
                    detailsexist: detailsexist,
                    details: details,
                    billing_contact: billing_contact,
                    deliverytime: 'Estimated delivery time is 7-8 days'
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

function retrieveLastPlacedDetails(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.phone as billing_contact, Orders.ship_addr_1, Orders.ship_addr_2, Orders.ship_city, Orders.ship_state, Orders.ship_pincode, Orders.billing_alt_contact, Orders.billing_name  ' +
            'FROM User ' +
            'LEFT JOIN Orders ' +
            'USING(uuid) ' +
            'WHERE User.uuid = ? ' +
            'ORDER BY Orders.regdate DESC ' +
            'LIMIT 1', [uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows[0]);
            }
        });
    });
}

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
                    'black',
                    'white'
                ];
                product.price = [
                    399,
                    399,
                    399
                ];
                product.quantity = [
                    1,
                    2,
                    3,
                    4,
                    5
                ];
                product.deliverycharge = 80;
            }
            else if(product.type === 'POSTER'){
                product.sizes = [
                    '11 x 11 inches'
                ];
                product.colors = [
                    'white'
                ];
                product.price = [
                    199
                ];
                product.quantity = [
                    1,
                    2,
                    3,
                    4,
                    5
                ];
                product.deliverycharge = 80;
            }
            else if(product.type === 'FRAME'){
                product.sizes = [
                    '11 x 11 inches'
                ];
                product.colors = [
                    'black'
                ];
                product.price = [
                    299
                ];
                product.quantity = [
                    1,
                    2,
                    3,
                    4,
                    5
                ];
                product.deliverycharge = 80;
            }
            else{   //COFFEE_MUG
                product.sizes = [
                    'medium'
                ];
                product.colors = [
                    'white'
                ];
                product.price = [
                    199
                ];
                product.quantity = [
                    1,
                    2,
                    3,
                    4,
                    5
                ];
                product.deliverycharge = 80;
            }
        });
        resolve(products);
    });
}

module.exports = router;