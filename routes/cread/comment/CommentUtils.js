/**
 * Created by avnee on 25-09-2017.
 */
'use-strict';

var utils = require('../utils/Utils');
var updatesutils = require('../updates/UpdatesUtils');

var uuidGen = require('uuid');
var moment = require('moment');

function loadCommentsLegacy(connection, entityid, limit, page, loadAll) {
    var query = 'SELECT User.firstname, User.lastname, User.uuid, Comment.edited, Comment.commid, Comment.txt AS comment ' +
        'FROM User ' +
        'JOIN Comment ' +
        'ON User.uuid = Comment.uuid ' +
        'WHERE Comment.entityid = ? ' +
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
            'WHERE entityid = ?', [entityid], function (err, data) {

            if (err) {
                reject(err);
            }
            else {
                var totalcount = data[0].totalcount; 

                connection.query(query, [entityid, limit, offset], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        rows.map(function (element) {
                            element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                            element.edited = (element.edited === 1);
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

function loadComments(connection, entityid, limit, lastindexkey, loadAll) {

    if (!loadAll) {   //Case where only top comments are loaded
        lastindexkey = moment().format('YYYY-MM-DD HH:mm:ss');
        limit = 3;
    }
    else {   //Case where all comments are loaded
        lastindexkey = (lastindexkey) ? lastindexkey : moment().format('YYYY-MM-DD HH:mm:ss');  //true ? value : current_timestamp
    }

    return new Promise(function (resolve, reject) {
        connection.query('SELECT User.firstname, User.lastname, User.uuid, Comment.edited, Comment.commid, ' +
            'Comment.txt AS comment, Comment.regdate ' +
            'FROM User ' +
            'JOIN Comment ' +
            'ON User.uuid = Comment.uuid ' +
            'WHERE Comment.entityid = ? ' +
            'AND Comment.regdate < ? ' +
            'ORDER BY Comment.regdate DESC ' +
            'LIMIT ? '/* +
            'OFFSET ?'*/, [entityid, lastindexkey, limit/*, offset*/], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {

                rows.map(function (element) {
                    element.profilepicurl = utils.createProfilePicUrl(element.uuid);
                    element.edited = (element.edited === 1);
                    return element;
                });

                //Sort comments in chronological order
                rows.sort(function (a, b) {
                    if(a.regdate < b.regdate){
                        return -1;
                    }
                    else{
                        return 1;
                    }
                });

                var result = {};
                result.comments = rows;

                if (loadAll) {
                    if(rows.length > 0){
                        result.requestmore = rows.length >= limit;
                        result.lastindexkey = moment.utc(rows[0/*rows.length - 1*/].regdate).format('YYYY-MM-DD HH:mm:ss');
                    }
                    else{
                        result.requestmore = rows.length >= limit;
                        result.lastindexkey = null
                    }
                }

                resolve(result);
            }
        });
    });
}

function addComment(connection, entityid, comment, uuid) {
    return new Promise(function (resolve, reject) {
        var params = {
            commid: uuidGen.v4(),
            entityid: entityid,
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
    });
}

function updateComment(connection, commid, uuid, comment) {
    return new Promise(function (resolve, reject) {
        connection.query('UPDATE Comment SET txt = ?, edited = ? ' +
            'WHERE commid = ? ' +
            'AND uuid = ?', [comment, true, commid, uuid], function (err, rows) {
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

function updateCommentDataForUpdates(connection, uuid, actor_uuid, entityid, category, other_collaborator){
    return new Promise(function (resolve, reject) {
        if(true){   //Case: Comment added TODO: Change condition during deletion from Updates table
            var updateparams = {
                uuid: uuid,
                actor_uuid: actor_uuid,
                entityid: entityid,
                other_collaborator: other_collaborator,
                category: category
            };
            updatesutils.addToUpdatesTable(connection, updateparams)
                .then(resolve, reject);
        }
        else{   //Case: Comment deleted TODO: Find a mechanism to locate a particular comment's row in Updates table
            /*var where_col_names = [
                "actor_uuid",
                "entityid",
                "other_collaborator",
                "category"
            ];
            var where_col_values = [
                actor_uuid,
                entityid,
                other_collaborator,
                "comment"
            ];
            return updatesutils.deleteFromUpdatesTable(connection, where_col_names, where_col_values);*/
            resolve();
        }
    });
}

module.exports = {
    loadCommentsLegacy: loadCommentsLegacy,
    loadComments: loadComments,
    addComment: addComment,
    updateComment: updateComment,
    deleteComment: deleteComment,
    updateCommentDataForUpdates: updateCommentDataForUpdates
};