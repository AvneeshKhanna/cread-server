/**
 * Created by avnee on 28-11-2017.
 */
'use-strict';

var moment = require('moment');
var utils = require('../utils/Utils');

var consts = require('../utils/Constants');

function loadTotalRoyalty(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT SUM(Orders.price * Orders.qty * (Orders.royalty_percentage * 0.01)) AS total_royalty,  ' +
            'SUM(CASE WHEN((Orders.shortuuid = ? AND Orders.sroyaltytransacid IS NULL) OR (Orders.captureuuid = ? AND Orders.croyaltytransacid IS NULL)) THEN (Orders.price * Orders.qty * (Orders.royalty_percentage * 0.01)) ELSE 0 END) AS redeem_amount ' +
            //'SUM(CASE WHEN(C.capid IS NOT NULL AND C.uuid = ? AND Orders.croyaltytransacid IS NULL) THEN (Orders.price * Orders.qty * (Orders.royalty_percentage * 0.01)) ELSE 0 END) AS c_redeem_amount ' +
            'FROM Orders ' +
            'WHERE Orders.shortuuid = ? OR Orders.captureuuid = ?', [uuid, uuid, uuid, uuid], function(err, royalty){
            if(err){
                reject(err);
            }
            else{

                royalty[0].total_royalty = royalty[0].total_royalty.toFixed(2);
                royalty[0].redeem_amount = royalty[0].redeem_amount.toFixed(2);

                resolve(royalty[0]);
            }
        });
    })
}

function loadSellOrders(connection, uuid, limit, toloadtotal, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        //Here, type signifies the relation of user with the entity, and not the type of entity itself
        connection.query('SELECT Product.type AS producttype, Entity.entityid, Entity.type AS etype, Orders.regdate, Orders.price, ' +
            'Orders.qty, Orders.royalty_percentage, User.firstname AS name, User.uuid, Short.uuid AS suuid, Short.shoid, Capture.uuid AS cuuid, Capture.capid, ' +
            'CASE WHEN((Orders.shortuuid = ? AND Orders.sroyaltytransacid IS NULL) OR (Orders.captureuuid = ? AND Orders.croyaltytransacid IS NULL)) THEN 0 ELSE 1 END AS redeemstatus, ' +
            'CASE WHEN(Orders.shortuuid = ?) THEN "SHORT" ELSE "CAPTURE" END AS type ' +
            'FROM Orders ' +
            'JOIN Entity ' +
            'ON Orders.entityid = Entity.entityid ' +
            'JOIN Product ' +
            'ON Orders.productid = Product.productid ' +
            'LEFT JOIN Short ' +
            'ON Orders.entityid = Short.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Orders.entityid = Capture.entityid ' +
            'JOIN User ' +
            'ON Orders.uuid = User.uuid ' +
            'WHERE (Orders.shortuuid = ? OR Orders.captureuuid = ?) ' +
            'AND Orders.regdate < ? ' +
            'GROUP BY Orders.orderid ' +
            'ORDER BY Orders.regdate DESC ' +
            'LIMIT ?', [uuid, uuid, uuid, uuid, uuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if(rows.length > 0){

                    rows.map(function (element) {
                        if(element.etype === 'SHORT'){
                            element.entityurl = utils.createSmallShortUrl(element.suuid, element.shoid);
                            //element.redeemstatus = !!element.sroyaltytransacid;
                        }
                        else{
                            element.entityurl = utils.createSmallCaptureUrl(element.cuuid, element.capid);
                            //element.redeemstatus = !!element.croyaltytransacid;
                        }

                        element.redeemstatus = (element.redeemstatus === 1);

                        //'userentityrelation' signifies how the user is associated with the particular entity. 'SHORT' the user
                        /*if(element.userentityrelation === 'SHORT'){
                            element.redeemstatus = !!element.sredeemstatus;
                        }
                        else{
                            element.redeemstatus = !!element.credeemstatus;
                        }*/

                        element.royalty_amount = ((element.royalty_percentage/100) * (element.price * element.qty)).toFixed(2);

                        /*if(element.hasOwnProperty('shoid')) {
                            delete element.shoid;
                        }

                        if(element.hasOwnProperty('capid')) {
                            delete element.capid;
                        }*/

                        if(element.hasOwnProperty('etype')) {
                            delete element.etype;
                        }

                        if(element.hasOwnProperty('price')) {
                            delete element.price;
                        }

                        if(element.hasOwnProperty('royalty_percentage')) {
                            delete element.royalty_percentage;
                        }

                        return element;
                    });


                    if(toloadtotal){    //This flag is true only for the first time
                        console.log("loadTotalRoyalty() called");
                        loadTotalRoyalty(connection, uuid)
                            .then(function (result) {
                                resolve({
                                    items: rows,
                                    total_royalty: result.total_royalty,
                                    redeem_amount: result.redeem_amount,
                                    minimum_wallet_balance: consts.min_cash_in_amt,
                                    lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                                    requestmore: rows.length >= limit
                                });
                            })
                            .catch(function (err) {
                                reject(err);
                            });
                    }
                    else{
                        resolve({
                            items: rows,
                            total_royalty: -1,
                            redeem_amount: -1,
                            minimum_wallet_balance: consts.min_cash_in_amt,
                            lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                            requestmore: rows.length >= limit
                        });
                    }
                }
                else{   //Case of no orders
                    resolve({
                        items: rows,
                        total_royalty: -1,
                        redeem_amount: -1,
                        minimum_wallet_balance: consts.min_cash_in_amt,
                        lastindexkey: null,
                        requestmore: rows.length >= limit
                    });
                }
            }
        });
    });
}

module.exports = {
    loadSellOrders: loadSellOrders,
    loadTotalRoyalty: loadTotalRoyalty
};