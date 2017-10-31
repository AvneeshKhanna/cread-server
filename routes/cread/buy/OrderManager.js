/**
 * Created by avnee on 27-10-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var uuidgen = require('uuid');

var config = require('../../Config');

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');
var buyutils = require('./BuyUtils');

router.post('/place', function (request, response) {

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var productid = request.body.productid;
    var shipmentdetails = request.body.shipmentdetails;
    var price = request.body.price;
    var qty = request.body.qty;
    var billing_name = request.body.billing_name;
    var billing_alt_contact = request.body.billing_alt_contact;

    var sqlparams = {
        orderid: uuidgen.v4(),
        uuid: uuid,
        entityid: entityid,
        productid: productid,
        ship_adddr_1: shipmentdetails.ship_adddr_1,
        ship_adddr_2: shipmentdetails.ship_adddr_2,
        ship_city: shipmentdetails.ship_city,
        ship_state: shipmentdetails.ship_state,
        ship_pincode: shipmentdetails.ship_pincode,
        billing_name: billing_name,
        billing_alt_contact: billing_alt_contact
    };

    var connection;

    _auth.authValid(uuid, authkey)
        .then(function () {
            return config.getNewConnection();
        })
        .then(function (conn) {
            connection = conn;
            return buyutils.saveOrderDetails(connection, sqlparams);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
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

/*
router.post('/populate-screen', function (request, response) {
    var uuid = request.body.uuid;
    var authkey = request.body.authkey;

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
            return retrieveLastPlacedDetails(connection, uuid);
        })
        .then(function (details) {
            response.send({
                tokenstatus: 'valid',
                data: {
                    exist: !!(details),
                    details: details
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
        connection.query('SELECT ship_addr_1, ship_addr_2, ship_city, ship_state, ship_pincode, billing_alt_contact, billing_name ' +
            'FROM Orders ' +
            'WHERE uuid = ? ' +
            'ORDER BY regdate DESC ' +
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
*/

module.exports = router;