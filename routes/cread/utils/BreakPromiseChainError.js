/**
 * Created by avnee on 25-07-2017.
 */

/*
 * This error is created to that it can be thrown when a promise chain needs to be broken in between
 * */

//Utils module loaded
var util = require('util');

/**
 * Error Class BreakPromiseChainError
 * */
function BreakPromiseChainError() {

    /*INHERITANCE*/
    Error.call(this); //super constructor
    Error.captureStackTrace(this, this.constructor); //super helper method to include stack trace in error object

    //Set the name for the ERROR
    this.name = this.constructor.name; //set our function’s name as error name.
}

// inherit from Error
util.inherits(BreakPromiseChainError, Error);

//Export the constructor function as the export of this module file.
exports = module.exports = BreakPromiseChainError;