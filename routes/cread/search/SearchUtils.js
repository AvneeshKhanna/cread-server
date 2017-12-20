/**
 * Created by avnee on 14-12-2017.
 */
'use-strict';

var utils = require('../utils/Utils');
var hashutils = require("../hashtag/HashTagUtils");

//TODO: Upgrade MySQL version to support Error: ER_INNODB_NO_FT_TEMP_TABLE: Cannot create FULLTEXT index on temporary InnoDB table
/*function getUsernamesSearchResult(connection, keyword, limit, lastindexkey) {

    lastindexkey = lastindexkey ? Number(lastindexkey) : 0;

    keyword = keyword.split(" ").join("* ") + "*";

    return new Promise(function (resolve, reject) {
        connection.query('CREATE TEMPORARY TABLE UserSearchTemp ' +
            '(_id BIGINT NOT NULL AUTO_INCREMENT, PRIMARY KEY(_id)) AS ' +
            'SELECT uuid, firstname, lastname FROM User;' +
            'ALTER TABLE UserSearchTemp ADD FULLTEXT INDEX(`firstname`, `lastname`);' +
            'SELECT _id, uuid, firstname, lastname ' +
            'FROM UserSearchTemp ' +
            'WHERE MATCH(firstname, lastname) ' +
            'AGAINST(? IN BOOLEAN MODE) ' +
            'AND _id > ? ' +
            'LIMIT ?', [keyword, lastindexkey, limit], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                if(rows.length > 0){
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

                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: String(rows[rows.length - 1]._id),
                        feed: rows
                    });
                }
                else{
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: null,
                        feed: rows
                    });
                }
            }
        });
    });
}*/

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