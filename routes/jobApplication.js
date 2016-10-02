//The first router is to insert data in apply table, when user apply for a job only when user had not applied for a job already
//Second route is to display all jobs to which user have applied to 

var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var Promise = require('promise');

var config = require('./Config');
var _connection = config.createConnection;
var applicationSchema = require('./Schema');
var jobApplication = applicationSchema.jobApplication;
var authtokenvalidation = require('./authtokenValidation');
var tokenvalidation = authtokenvalidation.checkToken;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function getData(elements){
    return new Promise(function(resolve,reject){
        resolve(elements);
    });
}

router.post('/',function(request,response,next){
    var UUID = request.body.uuid;
    var JUUID = request.body.juuid;
    var refCode = request.body.refcode;
    var auth_key = request.body.authtoken;
    
    var application = new jobApplication({userid : UUID , jobid : JUUID , Refcode : refCode , Status : 'Applied' , Application_status : 'Pending'});
    
    var promise = getData(UUID);
    var sqlQuery = 'SELECT aid FROM apply WHERE userid = ? AND jobid = ?';
    
    authtokenvalidation.checkToken(UUID, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            response.end('invalid');
        }
        else{
            _connection.query(sqlQuery,[UUID , JUUID], function(error, row){
                if(error) throw error;
         
                promise.then(function(item){
                    console.log(item);
                    return row.length;
                }).
                then(function(item){
                    if(item == 0){
                        _connection.query('INSERT INTO apply SET ?', application,function(error,result){
                            if(error) throw error;
                    
                            console.log(result);
                    
                            response.send('true');
                            response.end();
                        });
                    }
                    else{
                        response.send(null);
                        response.end();
                    }
                }).
                catch(function(err){
                    console.log(err);
                })
            });
        }
    });
});

router.post('/applications',function(request,response,next){
    var uuid = request.body.uuid;
    var auth_key = request.body.authtoken;
    var ApplicationForms = new Array();
    
    var sqlQuery = 'SELECT jobs.title,jobs.companyname,apply.Application_status FROM apply INNER JOIN jobs ON jobs.JUUID = apply.jobid WHERE apply.userid = ? AND apply.Status = ?';
    
    authtokenvalidation.checkToken(uuid, auth_key, function(err, data){
        if(err) throw err;
        
        else if(data == 0){
            response.end('invalid');
        }
        else{
            _connection.query(sqlQuery,[uuid,'Applied'],function(error,row){
                if (error) throw error;
            
                for(var j=0 ; j<row.length ; j++){
                    var localJson = {};
                    localJson['title'] = row[j].title;
                    localJson['companyname'] = row[j].companyname;
                    localJson['status'] = row[j].Application_status;
            
                    ApplicationForms.push(localJson);
                }
        
                response.send(JSON.stringify(ApplicationForms));
                response.end();
        
                ApplicationForms=[];
            });   
        }
    });
});

module.exports = router;
