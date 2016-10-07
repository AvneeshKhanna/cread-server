var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var Promise = require('promise');
var ext = require('./Promise');

router.post('/',function(request,response){
    var Id = request.body.ID;
    var str = 'Ho gaya';
    var str1 = 'Ho gaya1';
    var str2 = 'Ho gaya2';
    var promise = ext(Id);
    
    promise.then(function(item){
        console.log(item);
        return item+1;
    }).then(function(item){
        console.log(item);
        return item+2;
    }).then(function(item){
        console.log(item);
        return item+3;
    }).then(function(item){
        console.log(item);
        return item+4;
    }).then(function(item){ 
        console.log(item);
    }).catch(function(err){
        console.log('Error Occured: ' + err);
    })
    
    response.end('You Are Fucked Bro !!');
});

module.exports = router;