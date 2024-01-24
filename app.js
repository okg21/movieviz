// Code for the main application

// Load the modules we need
var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');


// Initialize the app
var app = express(); // Create the Express app

// View Engine Setup
app.set('views', path.join(__dirname, 'views')); // Set the directory where the views are stored
app.set('view engine', 'ejs'); // Set the view engine


// Middleware Setup
app.use(logger('dev')); // Log requests to the console
app.use(bodyParser.json()); // Parse JSON data sent by client
app.use(bodyParser.urlencoded({ extended: false })); // Parse URL encoded data sent by client
app.use(express.static(path.join(__dirname, 'public'))); // Set the directory where static files are stored
 
// Page Routes
app.get('/', function(req, res) {
    res.send('Hello World!');
    });

// Server Setup
app.listen(3000);
console.log('Server started on port 3000');

module.exports = app;

