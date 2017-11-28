/**
 * Created by avnee on 28-11-2017.
 */
'use-strict';

var moment = require('moment');
var utils = require('../../utils/Utils');

//TODO: Add royalty data
function loadSellOrders(connection, uuid, limit, lastindexkey) {

    lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp

    return new Promise(function (resolve, reject) {
        connection.query('SELECT Product.type AS producttype, Entity.entityid, Entity.type, Orders.regdate, User.firstname, ' +
            'User.lastname, User.uuid, Short.shoid, Capture.capid ' +
            'FROM Orders ' +
            'JOIN Entity ' +
            'ON Orders.entityid = Entity.entityid ' +
            'JOIN Product ' +
            'USING Orders.productid = Product.productid ' +
            'LEFT JOIN Short ' +
            'ON Orders.entityid = Short.entityid ' +
            'LEFT JOIN Capture ' +
            'ON Orders.entityid = Capture.entityid ' +
            'JOIN User ' +
            'ON Orders.uuid = User.uuid ' +
            'WHERE (Capture.uuid = ? OR Short.uuid = ?) ' +
            'AND Orders.regdate < ? ' +
            'GROUP BY Orders.orderid ' +
            'ORDER BY Orders.regdate DESC', [uuid, uuid, lastindexkey], function (err, rows) {
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

                        element.name = element.firstname + ' ' +  element.lastname;

                        if(element.firstname) {
                            delete element.firstname;
                        }

                        if(element.lastname) {
                            delete element.lastname;
                        }

                        if(element.shoid) {
                            delete element.shoid;
                        }

                        if(element.capid) {
                            delete element.capid;
                        }

                        return element;
                    });

                    resolve({
                        items: rows,
                        lastindexkey: moment.utc(rows[rows.length - 1].regdate).format('YYYY-MM-DD HH:mm:ss'),
                        requestmore: rows.length >= limit
                    });
                }
                else{
                    resolve({
                        items: rows,
                        lastindexkey: null,
                        requestmore: rows.length >= limit
                    });
                }
            }
        });
    });
}

module.exports = {
    loadSellOrders: loadSellOrders
};