var express = require('express');
var app = express();
var router = express.Router();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var AWS = require('aws-sdk');

var config = require('../Config');
//testing on dummy db
var _connection = config.createConnection;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

router.get('/',function(request,response){
    var sqlQuery = 'SELECT * FROM analyticsData ORDER BY countid DESC LIMIT 1';
    var globalJson = {};
    var localJson = {};
    var localArray = [];
    
    var applicationsData = [];
    var selectionsData = [];
    var referralSuccessData = [];
    var shortlistedData = [];
    
    var applicationsLabel = ['Through referrals' , 'Without referrals'];
    var shortlistedLabel = ['Through referrals' , 'Without referrals'];
    var selectionsLabel = ['Through referrals' , 'Without referrals'];
    var referralsSuccessLabel = ['Successful referrals' , 'Failed referrals'];
    
    _connection.query(sqlQuery,function(error,row){
        if(error) throw error;
        
        var users = row[0].totalUsers;
        var referrals = row[0].totalReferrals;
        var activeJobs = row[0].totalActiveJobs;
        var nonReferralApps = row[0].totalWoReferralApps;
        var referralApps = row[0].totalReferralApps;
        var nonReferralSelections = row[0].totalWoReferralSelections;
        var referralSelections = row[0].totalRefSelections;
        var referralShortlisted = row[0].referralShortlisted;
        var nonreferralShortlisted = row[0].nonreferralShortlisted;
        var reg_date  = new Date(row[0].reg_date+' UTC');
        
        var totalApplications = referralApps+nonReferralApps;
        var totalSelections = referralSelections+nonReferralSelections;
        var totalShortlisted = referralShortlisted+nonreferralShortlisted;
        var failedReferrals = referrals-referralApps;
        
        console.log(row);
        console.log('registration date ->'+reg_date);
        console.log('total applications ->'+totalApplications);
        console.log('total selections ->'+totalSelections);
        
        applicationsData.push(referralApps , nonReferralApps);
        selectionsData.push(referralSelections , nonReferralSelections);
        referralSuccessData.push(referralApps , failedReferrals);
        shortlistedData.push(referralShortlisted , nonreferralShortlisted);
        
        //for piecharts
        var labels= [referralsSuccessLabel , applicationsLabel , shortlistedLabel , selectionsLabel];
        var data = [referralSuccessData ,applicationsData , shortlistedData , selectionsData];
        var name = ['Referrals' , 'Applications' , 'Shortlistings' , 'Selections'];
        
        for(var i=0 ; i<labels.length ; i++){
            localJson.Label = labels[i];
            localJson.Data = data[i];
            localJson.Name = name[i];
            localArray.push(localJson);
            localJson = {};
        }
        
        globalJson.piechart = localArray;
        localArray = [];
        
        //for counts
        var countLabel = ['Users' , 'Active Jobs' , 'Referrals' , 'Applications' , 'Shortlisted' , 'Selections'];
        var countData = [users , activeJobs , referrals , totalApplications , totalShortlisted , totalSelections];
        var columnName = ['totalUsers' , 'totalActiveJobs' , 'totalReferrals' , 'totalApplications' , 'totalShortlisted' , 'totalSelections']; 
        
        var description = ['This option graphically shows the total number of users’ growth with time. One user indicates a unique profile registered on the app.' , 'This option graphically shows the time variation of active job postings on the platform.' , 'This option graphically shows the time variation of total number of referrals made on the platform. The numbers include successful as well as un-successful referrals.' , 'This option graphically shows the time variation of total number of job applications. The numbers include referral as well as non-referral applications.' , 'This option graphically shows the time variation of total number of users who have been shortlisted using the platform. The numbers include both referral as well as non-referral users.' , 'This option graphically shows the time variation of total number of candidate selections, where one selection indicates one finalised candidate.']
        
        for(var j=0 ; j<countLabel.length ; j++){
            localJson.Label = countLabel[j];
            localJson.Data = countData[j];
            localJson.description = description[j];
            localJson.columnName = columnName[j];
            localArray.push(localJson);
            localJson = {};
        }
        
        globalJson.dataCount = localArray;
        
        //for graph
        
        graphData(function(graphArray,graphDate){
//            for(var x=0 ; x<graphArray.length ; x++){
//                console.log('The'+x+' element is-> ')
//                console.log(graphArray[x]);
//            }
            localJson.Data = graphArray;
            localJson.Title = 'Users';
            localJson.Dates = graphDate;
            globalJson.Graph = localJson;
            localJson = {};
            
            response.send(JSON.stringify(globalJson));
            response.end(); 
        });
    });
});

function graphData(callback){
    var sqlQuery = 'SELECT totalUsers,reg_date FROM analyticsData ORDER BY countid DESC LIMIT 9';
    var graphArray = [];
    var graphDate = [];
    
    _connection.query(sqlQuery,function(error,result){
        if(error) throw error;
        
        console.log('The date is ->>>');
        console.log(result.reg_date);
        
        var resultLength = result.length;
        
        for(var k=resultLength-1 ; k>-1 ; k--){
            var date = new Date(result[k].reg_date+' UTC');
            var istDate = date.getDate() + '/'+ date.getMonth()+1;
            graphDate.push(istDate);
              
            graphArray.push(result[k].totalUsers);
            console.log('The'+k+'th element is:- ');
            console.log(result[k].totalUsers);
        }
        callback(graphArray,graphDate);
    });
}

module.exports = router;