//This module creates the authentication token when user register or when user changes its password.

var express = require('express');
var app = express();
var router = express.Router();

var expressJwt = require('express-jwt');
var Jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var passport = require('passport');
var localStrategy = require('passport-local');

var config = require('./Config');

var getToken = function (Key) {
    return Jwt.sign(Key, config.secretKey);
};

module.exports.getToken = getToken;
