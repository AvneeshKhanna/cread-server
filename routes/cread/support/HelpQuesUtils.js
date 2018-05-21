/**
 * Created by avnee on 21-05-2018.
 */
'use-strict';

function loadHelpQuestions(connection) {
    return new Promise(function (resolve, reject) {
        connection.query('SELECT * FROM HelpQues', [], function (err, rows) {
            if (err) {
                reject(err);
            }
            else {
                resolve({
                    items: rows
                });
            }
        });
    });
}

function updateUserAnswer(connection, uuid, qid) {
    return new Promise(function (resolve, reject) {

        var params = [
            uuid,
            qid
        ];

        connection.query('INSERT INTO HelpQuesAns (uuid, qid) VALUES (?) ' +
            'ON DUPLICATE KEY UPDATE count = (count + 1), last_update_time = NOW()', [params], function (err, rows) {
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
    loadHelpQuestions: loadHelpQuestions,
    updateUserAnswer: updateUserAnswer
};