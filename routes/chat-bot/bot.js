var express = require('express');
var router  = express.Router();

let Wit = null;
let log = null;
/*try {
  // if running from repo
  Wit = require('../').Wit;
  log = require('../').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}*/

Wit = require('node-wit').Wit;
log = require('node-wit').log;

var sendResponse;
// Wit.ai parameters
const WIT_TOKEN = 'YGJOEVNMFVZSAGBGN4N3R734QYAJ5T2U';

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

// Our bot actions
const actions = {
      send(request, response) {
    const {sessionId, context, entities} = request;
    const {text, quickreplies} = response;
    return new Promise(function(resolve, reject) {
      console.log('sending...', JSON.stringify(response));
        console.log(response.text);
        sendResponse(response.text);
      return resolve();
    });
  },

  // You should implement your custom actions here
  
     getDescription({context, entities}) {         
    return new Promise(function(resolve, reject) {
      // Here should go the api call, e.g.:
      // context.forecast = apiCall(context.loc)
        console.log("getDescription called")
      context.description = 'Interim sales, marketing and research force for every company';
      return resolve(context);
    });
  },
};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});


router.post('/',function(req,res,next){
var text1 = req.body.message;
    console.log(req.body.message);
    
      sendResponse = function(witresp)
                {res.send(witresp);
                res.end;
                }

     // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(req.body.senderid);
    
    // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
              sessionId, // the user's current session
              text1, // the user's message
              sessions[sessionId].context // the user's current session state
            ).then((context) => {
                let text = context.description ;
                console.log("then called");
                
                  // Our bot did everything it has to do.
              // Now it's waiting for further messages to proceed.
              console.log('Waiting for next user messages');

              // Based on the session state, you might want to reset the session.
              // This depends heavily on the business logic of your bot.
              // Example:
              // if (context['done']) {
              //   delete sessions[sessionId];
              // }

              // Updating the user's current session state
              sessions[sessionId].context = context;
                
              
            })              
              .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
    
});

module.exports = router;
            