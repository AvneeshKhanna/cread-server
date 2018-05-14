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
var entityutils = require('../entity/EntityUtils');
var utils = require('../utils/Utils');
var consts = require('../utils/Constants');
var cache_time = consts.cache_time;

router.post('/load', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var web_access_token = request.body.wat;
    var entityid = request.body.entityid;

    var connection;
    var products;
    var entityurl;

    _auth.authValidWeb(web_access_token)
        .then(function (payload) {
            if(web_access_token){
                uuid = payload.uuid;
            }
        })
        .then(function () {
            if(!web_access_token){
                return _auth.authValid(uuid, authkey)
            }
        })
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
            return entityutils.getEntityUrl(connection, entityid);
        })
        .then(function (url) {
            entityurl = url;
            return buyutils.loadAllProducts(connection);
        })
        .then(function (products) {
            return structureProductDetails(connection, products, entityid);
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
                    entityurl: entityurl,
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
                response.status(err.status === 404  ? err.status : 500).send({
                    message: 'Some error occurred at the server'
                }).end();
            }
        });
});

/**
 * For loading a particular product's details in a separate page in web-store
 * */
router.get('/load/:product_id', function (request, response) {

    var productid = request.params.product_id;
    var entityid = decodeURIComponent(request.query.entityid);
    var web_access_token = request.headers.wat;

    var connection;
    var entityurl;

    _auth.authValidWeb(web_access_token)
        .then(function (payload) {
            if(!payload){   //Since this endpoint is only accessed by web
                response.send({
                    tokenstatus: 'invalid'
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function () {
           return config.getNewConnection()
        })
        .then(function (conn) {
            connection = conn;
            return entityutils.getEntityUrl(connection, entityid);
        })
        .then(function (url) {
            entityurl = url;
            return buyutils.loadProduct(connection, productid);
        })
        .then(function (products) {
            return structureProductDetails(connection, products, entityid);
        })
        .then(function (prducts) {
            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if(request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')){
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    data: {
                        entityurl: entityurl,
                        product: prducts[0]
                    }
                });
                response.end();
            }

            throw new BreakPromiseChainError();
        })
        .catch(function (err) {
            config.disconnect(connection);
            if(err instanceof BreakPromiseChainError){
                //Do nothing
            }
            else{
                console.error(err);
                response.status(err.status === 404  ? err.status : 500).send({
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

function structureProductDetails(connection, products, entityid) {
    return new Promise(function (resolve, reject) {
        entityutils.getEntityCoffeeMugNJournalUrls(connection, entityid)
            .then(function (urls) {
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
                        product.deliverycharge = 1/*80*/;
                        product.productentityurl = null;
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
                        product.deliverycharge = 1/*80*/;
                        product.productentityurl = null;
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
                        product.deliverycharge = 1/*80*/;
                        product.productentityurl = null;
                    }
                    else if(product.type === 'JOURNAL'){
                        product.sizes = [
                            'medium'
                        ];
                        product.colors = [
                            'white',
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
                        product.deliverycharge = 1/*80*/;
                        product.productentityurl = urls.journalurl;
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
                        product.deliverycharge = 1/*80*/;
                        product.productentityurl = urls.coffeemugurl;
                    }
                });
                resolve(products);
            })
            .catch(reject);
    });
}

router.post('/load-multi-posts', function (request, response) {
    
    var entity_data = request.body.entity_data;
    var web_access_token = request.body.wat;
    
    var connection;

    _auth.authValidWeb(web_access_token)
        .then(function (payload) {
            if(!payload){   //Since this endpoint is only accessed by web
                response.send({
                    tokenstatus: 'invalid'
                });
                response.end();
                throw new BreakPromiseChainError();
            }
        })
        .then(function () {
            return config.getNewConnection()
        })
        .then(function (conn) {
            connection = conn;
            return getProductDetailsForEntities(connection, entity_data);
        })
        .then(function (entity_data) {
            var result = entity_data.map(function (edata) {
                return {
                    entityid: edata.entityid,
                    products: edata.products
                }
            });

            response.set('Cache-Control', 'public, max-age=' + cache_time.medium);

            if(request.header['if-none-match'] && request.header['if-none-match'] === response.get('ETag')){
                response.status(304).send().end();
            }
            else {
                response.status(200).send({
                    tokenstatus: 'valid',
                    data: {
                        items: result
                    }
                });
                response.end();
            }

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

function getProductDetailsForEntities(connection, entity_data) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT productid, type, imageurl AS productimgurl ' +
            'FROM Product', [null], function (err, products) {
            if (err) {
                reject(err);
            }
            else {
                try{

                    //Placing Coffee Mug at position 1
                    var coffee_mug_index = products.indexOf(products.filter(function (p) {
                        return p.type === 'COFFEE_MUG'
                    })[0]);

                    if(coffee_mug_index !== 0){
                        products = utils.swap(products, 0, coffee_mug_index);
                    }

                    //Placing Journal at position 2
                    var journal_index = products.indexOf(products.filter(function (p) {
                        return p.type === 'JOURNAL'
                    })[0]);

                    if(journal_index !== 1){
                        products = utils.swap(products, 1, journal_index);
                    }

                    //getProductEntityUrl() can throw an error
                    entity_data.map(function (edata) {
                        edata.products = products.map(function (p) {
                            return {
                                productentityurl: ["COFFEE_MUG", "JOURNAL"].includes(p.type) ? getProductEntityUrl(p.type, edata.uuid, edata.captureid, edata.shoid) : null,
                                productimgurl: ["COFFEE_MUG", "JOURNAL"].includes(p.type) ? null : p.productimgurl,
                                productid: p.productid,
                                type: p.type
                            }
                        });
                    });

                    resolve(entity_data);
                }
                catch (ex){
                    reject(ex);
                }
            }
        });
    });
}

function getProductEntityUrl(ptype, uuid, capid, shoid) {
    var url;

    if(ptype === 'COFFEE_MUG'){
        if(capid){
            url = utils.getCaptureCoffeeMugOverlayUrl(uuid, capid);
        }
        else {
            url = utils.getShortCoffeeMugOverlayUrl(uuid, shoid);
        }
    }
    else if(ptype === 'JOURNAL'){
        if(capid){
            url = utils.getCaptureJournalOverlayUrl(uuid, capid);
        }
        else{
            url = utils.getShortJournalOverlayUrl(uuid, shoid);
        }
    }
    else {
        throw new TypeError('Invalid argument value for "ptype"');
    }

    return url;
}

module.exports = router;