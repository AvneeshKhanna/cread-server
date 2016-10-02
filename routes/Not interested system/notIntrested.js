var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');

var config = require('../Config');
var _connection = config.createConnection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/',function(request,response){
    var uuid = request.body.uuid;
    var juuid = request.body.juuid;
    
    var sqlQuery = '';
    
//    _connection.query()
});

module.exports = router;