/**
 * Created by avnee on 14-12-2017.
 */
'use-strict';

var utils = require('../utils/Utils');
var hashutils = require("../hashtag/HashTagUtils");

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

                    if (element.hasOwnProperty('firstname')) {
                        delete element.firstname;
                    }

                    if (element.hasOwnProperty('lastname')) {
                        delete element.lastname;
                    }
                });

                resolve(rows);
            }
        });
    });
}

function getHashtagSearchResult(connection, query) {

    //Removing hash symbols
    while (query.indexOf('#') !== -1) {
        query = query.replace('#', '');
    }

    //Removing spaces
    while (query.indexOf(' ') !== -1) {
        query = query.replace(' ', '');
    }

    //Appending hash symbol in front again
    query = "#" + query;

    return new Promise(function (resolve, reject) {
        connection.query('SELECT caption ' +
            'FROM Entity ' +
            'WHERE MATCH(caption) ' +
            'AGAINST(? IN BOOLEAN MODE) ', [connection.escape(query + "*")], function (err, searchrows) {
            if (err) {
                reject(err);
            }
            else {

                var alltags = [];

                searchrows.map(function (element) {
                    if (element.caption) {
                        alltags = alltags.concat(hashutils.extractMatchingUniqueHashtags(element.caption, query.replace('#', '')));
                    }
                });

                console.log('alltags are ' + JSON.stringify(alltags, null, 3));

                var alluniquetags = [];

                new Set(alltags).forEach(function (tag) {
                    alluniquetags.push(tag);
                });

                if (alluniquetags.length > 0) {
                    hashutils.getHashtagCounts(connection, alluniquetags)
                        .then(function (rows) {
                            resolve(rows);
                        })
                        .catch(function (err) {
                            reject(err);
                        });
                }
                else {
                    resolve([]);
                }
            }
        });
    });
}

module.exports = {
    getUsernamesSearchResult: getUsernamesSearchResult,
    getHashtagSearchResult: getHashtagSearchResult
};