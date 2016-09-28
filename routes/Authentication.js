var express = require('express');
var app = express();
var router = express.Router();
var expressJwt = require('express-jwt');
var Jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var passport = require('passport');
var localStrategy = require('passport-local');

var config = require('./Config');

var getToken = function(userName){
    var tokenId = Jwt.sign(userName , config.secretKey);
	return tokenId;
}

module.exports.getToken = getToken;
