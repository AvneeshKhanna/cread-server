/**
 * Created by avnee on 14-12-2017.
 */
'use-strict';

var utils = require('../utils/Utils');
var hashutils = require("../hashtag/HashTagUtils");

function getUsernamesSearchResult(connection, keyword, limit, lastindexkey) {

    lastindexkey = lastindexkey ? Number(lastindexkey) : 0;

    keyword = keyword.split(" ").join("* ") + "*";

    //DROP TABLE clause is added because a TEMPRORAY TABLE created is not dropped until the SQL session is killed. And when using
    //a connection pool, a session is only killed when it is being re-picked for use from the pool, not when it ends.
    return new Promise(function (resolve, reject) {
        connection.query('CREATE TEMPORARY TABLE UserSearchTemp (_id BIGINT NOT NULL AUTO_INCREMENT, PRIMARY KEY(_id)) AS ' +
            'SELECT uuid, firstname, lastname ' +
            'FROM User ' +
            'WHERE MATCH(firstname, lastname) ' +
            'AGAINST(? IN BOOLEAN MODE);' +
            'SELECT _id, uuid, firstname, lastname ' +
            'FROM UserSearchTemp ' +
            'WHERE _id > ? ' +
            'ORDER BY _id ASC ' +
            'LIMIT ?;' +
            'DROP TABLE IF EXISTS UserSearchTemp;', [keyword, lastindexkey, limit], function (err, rows) {
            if (err) {
                //If an error in the above query occurs, TEMPORARY TABLE still remains in existence since the DROP TABLE query might not
                //have been executed. Hence, for safety, the below query is executed.
                connection.query('DROP TABLE IF EXISTS UserSearchTemp', null, function (e, data) {
                    if(e){
                        console.error(e);
                    }
                    reject(err);
                });
            }
            else {

                //When running multi-statement queries, the root array returned contains three sub-object each corresponding to the
                //query being executed and in that order. Hence, here, since the 2nd query SELECTs results, we extract the 2nd index
                //of the root array for actual data
                rows = rows[1];

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
                        items: rows
                    });
                }
                else{
                    resolve({
                        requestmore: rows.length >= limit,
                        lastindexkey: "",
                        items: rows
                    });
                }
            }
        });
    });
}

/*function getUsernamesSearchResult(connection, keyword) {

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
}*/

function getHashtagSearchResult(connection, query, limit, lastindexkey) {

    lastindexkey = lastindexkey ? Number(lastindexkey) : 0;

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

                var startpgntnindex = lastindexkey;
                var lastpgntnindex = (alluniquetags.length) > (limit + lastindexkey) ? (limit + lastindexkey) : (alluniquetags.length);

                console.log("startindex " + JSON.stringify(startpgntnindex, null, 3));
                console.log("lastindex " + JSON.stringify(lastpgntnindex, null, 3));

                var pageuniquetags = alluniquetags.slice(startpgntnindex, lastpgntnindex);

                if (pageuniquetags.length > 0) {
                    hashutils.getHashtagCounts(connection, pageuniquetags)
                        .then(function (rows) {
                            resolve({
                                requestmore: (alluniquetags.length) >= (limit + lastindexkey),
                                lastindexkey: lastpgntnindex,
                                items: rows
                            });
                        })
                        .catch(function (err) {
                            reject(err);
                        });
                }
                else {
                    resolve({
                        requestmore: false,
                        lastindexkey: "",
                        items: []
                    });
                }
            }
        });
    });
}

module.exports = {
    getUsernamesSearchResult: getUsernamesSearchResult,
    getHashtagSearchResult: getHashtagSearchResult
};