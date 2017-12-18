/**
 * Created by avnee on 14-12-2017.
 */
'use-strict';

var utils = require('../utils/Utils');

function getUsernamesSearchResult(connection, keyword) {

    keyword = keyword.split(" ").join("* ") + "*";

    return new Promise(function (resolve, reject) {
        connection.query('SELECT uuid, firstname, lastname ' +
            'FROM User ' +
            'WHERE MATCH(firstname, lastname) ' +
            'AGAINST(? IN BOOLEAN MODE)', [keyword], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {
                    element.name = element.firstname + " " + element.lastname;
                    element.profilepicurl = utils.createSmallProfilePicUrl(element.uuid);

                    if(element.hasOwnProperty('firstname')){
                        delete element.firstname;
                    }

                    if(element.hasOwnProperty('lastname')){
                        delete element.lastname;
                    }
                });

                resolve(rows);
            }
        });
    });
}

function getHashtagSearchResult(connection, query) {

    while(query.indexOf('#') !== -1){
        query = query.replace('#', '');
    }

    while(query.indexOf(' ') !== -1){
        query = query.replace(' ', '');
    }

    query = query + "*";

    return new Promise(function (resolve, reject) {
        connection.query('SELECT caption ' +
            'FROM Caption ' +
            'WHERE MATCH(caption) ' +
            'AGAINST(? IN BOOLEAN MODE) ', [query], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {
                    if(!scaption){
                        element.hashtag = scaption
                    }
                    else if(!ccaption){}
                });

                resolve(rows);
            }
        });
    });
}

module.exports = {
    getUsernamesSearchResult: getUsernamesSearchResult,
    getHashtagSearchResult: getHashtagSearchResult
};