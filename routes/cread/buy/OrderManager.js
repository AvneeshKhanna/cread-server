/**
 * Created by avnee on 27-10-2017.
 */
'use-strict';

var express = require('express');
var router = express.Router();

var uuidgen = require('uuid');

var config = require('../../Config');
var envtype = config.envtype;

var _auth = require('../../auth-token-management/AuthTokenManager');
var BreakPromiseChainError = require('../utils/BreakPromiseChainError');

var buyutils = require('./BuyUtils');
var utils = require('../utils/Utils');
var entityutils = require('../entity/EntityUtils');

var consts = require('../utils/Constants');

var notify = require('../../notification-system/notificationFramework');
var emailer = require('../dsbrd/wallet-management/TransactionEmailer');

//TODO: Modify notification system for royalty and for involving both the users who developed the artwork
router.post('/place', function (request, response) {

    console.log("request is " + JSON.stringify(request.body, null, 3));

    var uuid = request.body.uuid;
    var authkey = request.body.authkey;
    var entityid = request.body.entityid;
    var productname = request.body.productname;
    var productid = request.body.productid;
    var shipmentdetails = request.body.shipmentdetails;
    var price = request.body.price; //Price of one item
    var qty = request.body.quantity;
    var billing_name = request.body.billing_name;
    var billing_alt_contact = request.body.billing_alt_contact;
    var color = request.body.color;
    var size = request.body.size;

    var amount = buyutils.convertPaiseToINR(request.body.amount);    //Amount requested in paise
    var royalty_percentage = consts.royalty_percentage;
    var paymentid = request.body.paymentid; //ID of the payment transacted through payment gateway portal

    var shortuuid = request.body.shortuuid;
    var captureuuid = request.body.captureuuid;

    var sqlparams = {
        orderid: uuidgen.v4(),
        uuid: uuid,
        entityid: entityid,
        productid: productid,
        paymentid: paymentid,
        amount: amount,
        shortuuid: shortuuid,
        captureuuid: captureuuid,
        royalty_percentage: royalty_percentage,
        ship_addr_1: shipmentdetails.ship_addr_1,
        ship_addr_2: shipmentdetails.ship_addr_2,
        ship_city: shipmentdetails.ship_city,
        ship_state: shipmentdetails.ship_state,
        ship_pincode: shipmentdetails.ship_pincode,
        billing_name: billing_name,
        billing_alt_contact: billing_alt_contact,
        color: color,
        size: size,
        price: price,
        qty: qty
    };

    var connection;
    var requesterdetails;
    var notifuuids;

    _auth.authValid(uuid, authkey)
        .then(function (details) {
            requesterdetails = details;
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
            return utils.beginTransaction(connection);
        })
        .then(function () {
            return buyutils.saveOrderDetails(connection, sqlparams);
        })
        .then(function () {
            return buyutils.captureRazorpayPayment(connection, paymentid, buyutils.convertINRtoPaise(amount));
        })
        .then(function () {
            return utils.commitTransaction(connection);
        })
        .then(function () {
            response.send({
                tokenstatus: 'valid',
                data: {
                    status: 'done'
                }
            });
            response.end();
        })
        .then(function () { //Sending order confirmation email
            if(requesterdetails.email){
                return new Promise(function (resolve, reject) {

                    var paymentdetails = {
                        paymentid: paymentid,
                        amount: amount
                    };
                    var customerdetails = {
                        name: requesterdetails.firstname,
                        email: requesterdetails.email,
                        billingname: billing_name,
                        billingcontact: requesterdetails.phone,
                        shippingaddress: shipmentdetails.ship_addr_1
                        + ", "
                        + shipmentdetails.ship_addr_2
                        + ", "
                        + shipmentdetails.ship_city
                        + ", "
                        + shipmentdetails.ship_state
                        + ", "
                        + shipmentdetails.ship_pincode
                    };
                    var productdetails = {
                        product_name: productname,
                        product_details: '(x' + qty + '), '
                        + color
                        + ', '
                        + size
                    };

                    emailer.sendOrderTransactionEmail('SUCCESS',
                        customerdetails,
                        "Order confirmed for a " + productname + ": Cread",
                        paymentdetails,
                        productdetails, function (err, data) {
                            if(err){
                                reject(err);
                            }
                            else{
                                resolve();
                            }
                        });
                });
            }
        })
        /*.then(function () { //Sending notification
            return retrieveEntityUserDetails(connection, entityid);
        })*/
        .then(function () {
            return entityutils.getEntityUsrDetailsForNotif(connection, entityid);
        })
        .then(function (result) {   //Send a notification to the creator of this post
            notifuuids = result;
            if(notifuuids.creatoruuid !== uuid){    //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " has purchased a " + productname + " created using your post",
                    category: "buy",
                    entityid: entityid,
                    persistable: "Yes",
                    other_collaborator : false,
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(notifuuids.creatoruuid), notifData);
            }
        })
        .then(function () { //Send a notification to the collaborator of this post
            if(notifuuids.collabuuid && notifuuids.collabuuid !== uuid){    //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " has purchased a " + productname + " created using a post inspired by yours",
                    category: "buy",
                    entityid: entityid,
                    persistable: "Yes",
                    other_collaborator : true,
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(new Array(notifuuids.collabuuid), notifData);
            }
        })
        /*.then(function () {   //Sending notification

            //Filtering based on whether the post-creator uuids are not null and the same as buyer
            var userarray = [
                shortuuid,
                captureuuid
            ].filter(function (t) {
                return (!!t && t !== uuid);
            });

            if(userarray.length > 0){    //Send notification only when the two users involved are different
                var notifData = {
                    message: requesterdetails.firstname + " " + requesterdetails.lastname + " has purchased a " + productname + " created using your post",
                    category: "buy",
                    entityid: entityid,
                    persistable:"Yes",
                    actorimage: utils.createSmallProfilePicUrl(uuid)
                };
                return notify.notificationPromise(userarray, notifData);
            }
        })*/
        .then(function () {
            throw new BreakPromiseChainError(); //To disconnect server connection
        })
        .catch(function (err) {
            if(err instanceof BreakPromiseChainError){
                config.disconnect(connection);
            }
            else{
                connection.rollback(function () {
                    config.disconnect(connection);
                    console.error(err);
                    if(!response.headerSent){
                        response.status(500).send({
                            message: 'Some error occurred at the server'
                        }).end();
                    }
                });
            }
        });
});

/**
 * To load all the orders received on Cread app for operational purposes
 * */
router.post('/load-for-print', function (request, response) {
    var lastindexkey = request.body.lastindexkey;

    var limit = (envtype === 'PRODUCTION') ? 10 : 2;
    var connection;

    config.getNewConnection()
        .then(function (conn) {
            connection = conn;
            return buyutils.loadOrdersForPrint(connection, limit, lastindexkey);
        })
        .then(function (result) {
            console.log("result is " + JSON.stringify(result, null, 3));
            response.send({
                data: result
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

/*function retrieveEntityUserDetails(connection, entityid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.uuid ' +
            'FROM Entity ' +
            'LEFT JOIN Capture ' +
            'ON Capture.entityid = Entity.entityid ' +
            'LEFT JOIN Short ' +
            'ON Short.entityid = Entity.entityid ' +
            'JOIN User ' +
            'ON (User.uuid = Short.uuid OR User.uuid = Capture.uuid)  ' +
            'WHERE Entity.entityid = ?', [entityid], function(err, rows){
            if(err){
                reject(err);
            }
            else{
                resolve(rows[0].uuid);
            }
        });
    })
}*/

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