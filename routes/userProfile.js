var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var aws = require('aws-sdk');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.post('/',function(request,response){
    var UUID = request.body.uuid;
    var username = request.body.name;
    var designation = request.body.designation;
    var phone = request.body.phone;
    var email = request.body.email;
    var city = request.body.city;
    var education = request.body.education;
    var workexp = request.body.workexp;
    
    console.log(UUID+"\n"+username+"\n"+designation+"\n"+phone+"\n"+email+"\n"+city);
    
    education.forEach(function(item,index){
        console.log(item);
    });
    
    workexp.forEach(function(item){
        console.log(item);
    });
    
    response.end("Its done");
});

module.exports = router;