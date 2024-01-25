// Code for the main application

// Load the modules we need
var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var neo4j = require('neo4j-driver');


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
 
// Connect to Neo4j
var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', '123jn1lk2j3n'));
var session = driver.session();

// Page Routes
app.get('/', function(req, res) {
    res.render('index');
    });

app.post('/actor/depth', function(req, res) {
    var actorName = req.body.actor;
    var depth = req.body.depth;

    session
    .run('MATCH (p:Person {name:"' + actorName + '"})-[:ACTED_IN]->(m:Movie) MATCH (p)-[*1..'+ depth +']-(related) RETURN m, related')
        .then(function(result) {
            var MovieArr = [];
            console.log(result.records);
            result.records.forEach(function(record) {
                //add records to array
                MovieArr.push({
                    id: record._fields[0].identity.low,
                    title: record._fields[0].properties.title,
                    year: record._fields[0].properties.year
                });
            });
            res.render('display', {
                movies: MovieArr
            });
        })
        .catch(function(error) {
            console.log(error);
        });
});

// Server Setup
app.listen(3000);
console.log('Server started on port 3000');

module.exports = app;

