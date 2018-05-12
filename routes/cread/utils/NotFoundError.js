/**
 * Created by avnee on 12-05-2018.
 */
'use-strict';

/*
 * This error is created to be thrown when a requested endpoint has invalid query parameters
 * */

//Utils module loaded
var util = require('util');

/**
 * Error Class NotFoundError
 * */
function NotFoundError(message) {

    /*INHERITANCE*/
    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor); //super helper method to include stack trace in error object

    //Set the name for the ERROR
    this.name = this.constructor.name; //set our function’s name as error name.
    this.message = message;
    this.status = 404;
}

// inherit from Error
util.inherits(NotFoundError, Error);

//Export the constructor function as the export of this module file.
exports = module.exports = NotFoundError;