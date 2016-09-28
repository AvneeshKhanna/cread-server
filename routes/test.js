var express = require('express');
var router = express.Router();

router.post('/', function(request, response){
    
    console.log('Request received');
    console.log(JSON.stringify(request.body));
    
    var responseObject = {};
    
    response.send(responseObject);
    response.end();
    
});

module.exports = router;