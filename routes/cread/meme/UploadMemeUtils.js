/**
 * Created by avnee on 06-08-2018.
 */
'use-strict';

const envconfig = require('config');
const fs = require('fs');

let s3bucket = envconfig.get('s3.bucket');

async function addMemeToDb(connection, entityparams, memeparams) {
    connection.query('INSERT INTO Entity SET ?', [entityparams], function(err, rows){
        if(err){
            throw err;
        }

        connection.query('INSERT INTO Meme SET ?', [memeparams], function(err, rows){
            if(err){
                throw err;
            }
        });
    });
}

async function updateMemeToDb(connection, params, memeid) {
    connection.query('UPDATE Meme SET ? WHERE memeid = ?', [params, memeid], function(err, rows){
        if(err){
            throw err;
        }
    });
}

module.exports = {
    addMemeToDb: addMemeToDb,
    updateMemeToDb: updateMemeToDb
};