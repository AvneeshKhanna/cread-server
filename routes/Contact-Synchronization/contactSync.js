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
    
    //arrays for storing all uuids and contacts on server 
    var allContacts = new Array();
    var allUUIDs = new Array();
    
    //arrays which stores clientname and clientcontacts send by client
    var CLIENTNAME = new Array();
    var CLIENTCONTACTS = new Array();
    
    var Query = 'SELECT phoneNO, UUID FROM users';
    
    //contacts and name send by user
    contacts.forEach(function(item){
        console.log('Each client contact->'+item.contactnumber);
        CLIENTCONTACTS.push(item.contactnumber);
    });
    contacts.forEach(function(item){
        console.log('Each client name->'+item.contactname); 
        CLIENTNAME.push(item.contactname);
    });
    
    _connection.query(Query,function(error,row){
        if(error) throw error;
        
        //pushing all contacts on server in an array
        
        for(var k in row){
//            console.log(row[k].UUID);
            allUUIDs.push(row[k].UUID);
        }
        for(var j in row){
//            console.log(row[j].phoneNO)
            allContacts.push(row[j].phoneNO);
        }
        
        //function to check user contacts with server contacts
        checkContacts(CLIENTCONTACTS , CLIENTNAME , allUUIDs , allContacts , response);
        allContacts = [];
        allUUIDs = [];
    });
});

function checkContacts(CLIENTCONTACTS , CLIENTNAME , serverUUIDs , serverContacts , response){
    for(var i=0;i<CLIENTCONTACTS.length;i++){
        if(serverContacts.indexOf(CLIENTCONTACTS[i]) !== -1){
            var localJson = {};
            var uuidIndex = serverContacts.indexOf(CLIENTCONTACTS[i]);
            localJson['contactnumber'] = CLIENTCONTACTS[i];
            localJson['contactname'] = CLIENTNAME[i];
            localJson['uuid'] = serverUUIDs[uuidIndex];
            onAppContacts.push(localJson);
        }
        else{
            invalidContacts.push(CLIENTCONTACTS[i]);
        }
    }
    
    response.send(JSON.stringify(onAppContacts));
    response.end();
    console.log('valid users : '+onAppContacts);
    console.log('invalid users : '+invalidContacts);
    onAppContacts = [];
    invalidContacts = [];
}

module.exports = router;