var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');

var config = require('../Config');
var _connection = config.createConnection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var onAppContacts = new Array();
var invalidContacts = new Array();

router.post('/',function(request,response){
    var uuid = request.body.uuid;
    var contacts = request.body.contacts;
    
//    var allContacts = new Array();
    var Query = 'SELECT phoneNO FROM users'
    
    _connection.query(Query,function(error,row){
        if(error) throw error;
        
        checkContacts(contacts,row);
        console.log(row)
    });
    
    contacts.forEach(function(item){
        console.log(item);    
    });
    
    console.log('in end');
    response.end('got your contacts bro');
});

function checkContacts(clientContacts,serverContacts){
    // yet to code 
    console.log('valid users : '+onAppContacts);
    console.log('invalid users : '+invalidContacts);
}

module.exports = router;