/**
 * Created by avnee on 25-09-2017.
 */
'use-strict';

var utils = require('../utils/Utils');
var uuidGen = require('uuid');

function loadComments(connection, cmid, limit, page, loadAll) {
    var query = 'SELECT users.firstname, users.lastname, users.uuid, Comment.commid, Comment.txt AS comment ' +
        'FROM users ' +
        'JOIN Comment ' +
        'ON users.uuid = Comment.uuid ' +
        'JOIN Entity ' +
        'ON Entity.entityid = Comment.entityid ' +
        'JOIN Campaign ' +
        'ON Entity.entityid = Campaign.entityid ' +
        'WHERE Campaign.cmid = ? ' +
        'ORDER BY Comment.regdate DESC ' +
        'LIMIT ? ' +
        'OFFSET ?';

    var offset;

    if (!loadAll) {   //Case where only top comments are loaded
        offset = 0;
        limit = 3;
    }
    else {   //Case where all comments are loaded
        offset = page * limit;
    }

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Comment ' +
            'JOIN Entity ' +
            'ON Comment.entityid = Entity.entityid ' +
            'JOIN Campaign ' +
            'ON Campaign.entityid = Entity.entityid ' +
            'WHERE Campaign.cmid = ?', [cmid], function (err, data) {

            if (err) {
                reject(err);
            }
            else {
                var totalcount = data[0].totalcount;

                connection.query(query, [cmid, limit, offset], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        rows.map(function (element) {
                            element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                            return element;
                        });

                        var result = {};
                        result.comments = rows;

                        if (loadAll) {
                            result.requestmore = totalcount > (offset + limit);
                        }

                        resolve(result);
                    }
                });
            }
        });
    });
}

function addComment(connection, cmid, comment, uuid) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT Entity.entityid ' +
            'FROM Entity ' +
            'JOIN Campaign ' +
            'ON Entity.entityid = Campaign.entityid ' +
            'WHERE Campaign.cmid = ?', [cmid], function (err, ent) {
            if (err) {
                reject(err);
            }
            else {

                var params = {
                    commid: uuidGen.v4(),
                    entityid: ent[0].entityid,
                    txt: comment,
                    uuid: uuid
                };

                connection.query('INSERT INTO Comment SET ?', [params], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(params.commid);
                    }
                });
            }
        });
    });
}

function updateComment(connection, commid, uuid, comment) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Comment SET txt = ? WHERE commid = ? AND uuid = ?', [comment, commid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

function deleteComment(connection, commid, uuid) {
    return new Promise(function (resolve, reject) {
        //For precaution, both 'commid' and 'uuid' are used here so that any potential error on the app where a user
        //sends another user's 'commid' for a delete request, the comment shouldn't get deleted
        connection.query('DELETE FROM Comment WHERE commid = ? AND uuid = ?', [commid, uuid], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

module.exports = {
    loadComments: loadComments,
    addComment: addComment,
    updateComment: updateComment,
    deleteComment: deleteComment
};