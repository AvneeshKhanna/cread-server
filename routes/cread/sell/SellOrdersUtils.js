/**
 * Created by avnee on 28-11-2017.
 */
'use-strict';

var moment = require('moment');
var utils = require('../utils/Utils');

function loadTotalRoyalty(connection, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT SUM(Orders.price * Orders.qty * (Orders.royalty_percentage * 0.01)) AS total_royalty ' +
            'FROM Orders ' +
            'JOIN Entity ' +
            'ON Orders.entityid = Entity.entityid ' +
            'LEFT JOIN Short ' +
            'ON Orders.entityid = Short.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Orders.entityid = Capture.entityid ' +
            'WHERE Capture.uuid = ? ' +
            'OR Short.uuid = ?', [uuid, uuid], function(err, royalty){
            if(err){
                reject(err);
            }
            else{
                resolve(royalty[0].total_royalty.toFixed(2));
            }
        });
    })
}

//TODO: Add royalty data
function loadSellOrders(connection, uuid, limit, toloadtotal, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT Product.type AS producttype, Entity.entityid, Entity.type, Orders.regdate, Orders.price, ' +
            'Orders.qty, Orders.royalty_percentage, User.firstname AS name, User.uuid, Short.shoid, Capture.capid ' +
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
            'WHERE (Capture.uuid = ? OR Short.uuid = ?) ' +
            'AND Orders.regdate < ? ' +
            'GROUP BY Orders.orderid ' +
            'ORDER BY Orders.regdate DESC ' +
            'LIMIT ?', [uuid, uuid, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                if(rows.length > 0){

                    rows.map(function (element) {
                        if(element.type === 'SHORT'){
                            element.entityurl = utils.createSmallShortUrl(element.uuid, element.shoid);
                        }
                        else{
                            element.entityurl = utils.createSmallCaptureUrl(element.uuid, element.capid);
                        }

                        element.royalty_amount = ((element.royalty_percentage/100) * (element.price * element.qty)).toFixed(2);

                        element.redeemstatus = rows.indexOf(element) % 2 === 0; //TODO: Calculate

                        if(element.hasOwnProperty('shoid')) {
                            delete element.shoid;
                        }

                        if(element.hasOwnProperty('capid')) {
                            delete element.capid;
                        }

                        if(element.hasOwnProperty('price')) {
                            delete element.price;
                        }

                        if(element.hasOwnProperty('royalty_percentage')) {
                            delete element.royalty_percentage;
                        }

                        return element;
                    });


                    if(toloadtotal){
                        console.log("loadTotalRoyalty() called");
                        loadTotalRoyalty(connection, uuid)
                            .then(function (total_royalty) {
                                resolve({
                                    items: rows,
                                    total_royalty: total_royalty,
                                    redeem_amount: 0,  //TODO: Calculate
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
                            redeem_amount: -1,  //TODO: Calculate
                            lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                            requestmore: rows.length >= limit
                        });
                    }
                }
                else{   //Case of no orders
                    resolve({
                        items: rows,
                        total_royalty: -1,
                        redeem_amount: -1,  //TODO: Calculate
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