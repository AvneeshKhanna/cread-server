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
        'ON Entity.entid = Comment.entid ' +
        'JOIN Campaign ' +
        'ON Campaign.entid = Campaign.entid ' +
        'WHERE Campaign.cmid = ? ' +
        'ORDER BY Comment.regdate DESC ' +
        'LIMIT ? ' +
        'OFFSET ?';

    var offset;

    if(!loadAll){   //Case where only top comments are loaded
        offset = 0;
        limit = 3;
    }
    else{   //Case where all comments are loaded
        offset = page * limit;
    }

    return new Promise(function (resolve, reject) {
        connection.query('SELECT COUNT(*) AS totalcount ' +
            'FROM Comment ' +
            'JOIN Entity ' +
            'ON Comment.entid = Entity.entid ' +
            'JOIN Campaign ' +
            'ON Campaign.entid = Entity.entid ' +
            'WHERE Campaign.cmid = ?', [cmid], function (err, data) {

            if(err){
                reject(err);
            }
            else{
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

                        if(loadAll){
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
        connection.query('SELECT Entity.entid ' +
            'FROM Entity ' +
            'JOIN Campaign ' +
            'ON Entity.entid = Campaign.entid ' +
            'WHERE Campaign.cmid = ?', [cmid], function (err, ent) {
            if(err){
                reject(err);
            }
            else{

                var params = {
                    commid: uuidGen.v4(),
                    entid: ent[0].entid,
                    txt: comment,
                    uuid: uuid
                };

                connection.query('INSERT INTO Comment SET ?', [params], function (err, rows) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            }
        });
    });
}

function deleteComment(connection, commid) {
    return new Promise(function (resolve, reject) {
        connection.query('DELETE FROM Comment WHERE commid = ?', [commid], function (err, rows) {
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
    deleteComment: deleteComment
};