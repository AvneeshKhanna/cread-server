var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var Promise = require('promise');

module.exports = function (element){
    return new Promise(function(resolve,reject){
            resolve(element);
    });
}





