/**
 * Created by avnee on 09-11-2017.
 */
'use-strict';

/**
 * Function to load details of orders placed for a particular user's art
 * */
function loadOrderTrackDetails(connection, uuid, limit, page) {
    var offset = limit * page;
    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
        'FROM Orders ' +
        'LEFT JOIN Capture ' +
        'ON Capture.entityid = Orders.entityid ' +
        'LEFT JOIN Short ' +
        'ON Short.entityid = Orders.entityid ' +
        'WHERE Capture.uuid = ? ' +
        'OR Short.uuid = ? ' +
        'GROUP BY Orders.orderid ' +
        'ORDER BY Orders.regdate DESC', [uuid, uuid], function(err, data){
            if(err){
                reject(err);
            }
            else{
                var totalcount = data[0].totalcount;

                if(totalcount > 0){
                    connection.query('SELECT * ' +
                        'FROM Orders ' +
                        'LEFT JOIN Capture ' +
                        'ON Capture.entityid = Orders.entityid ' +
                        'LEFT JOIN Short ' +
                        'ON Short.entityid = Orders.entityid ' +
                        'WHERE Capture.uuid = ? ' +
                        'OR Short.uuid = ? ' +
                        'JOIN User ' +
                        'ON Orders.uuid = User.uuid ' +
                        'JOIN Product ' +
                        'ON Orders.productid = Product.productid ' +
                        'GROUP BY Orders.orderid ' +
                        'ORDER BY Orders.regdate DESC ' +
                        'LIMIT ? ' +
                        'OFFSET ?', [uuid, uuid, limit, offset], function (err, rows) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve({
                                requestmore: totalcount > (limit + offset),
                                items: rows
                            });
                        }
                    });
                }
                else{
                    resolve({
                        requestmore: totalcount > (limit + offset),
                        items: []
                    });
                }
            }
        });
    });
}

module.exports = {
    loadOrderTrackDetails: loadOrderTrackDetails
};