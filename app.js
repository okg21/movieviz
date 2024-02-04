// Code for the main application

// Load the modules we need
var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var neo4j = require('neo4j-driver');
var cytoscape = require('cytoscape');
var fcose = require('cytoscape-fcose');


cytoscape.use(fcose);


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
app.use(express.json()); // Parse JSON data sent by client

// Connect to Neo4j
var driver = neo4j.driver('bolt://localhost', neo4j.auth.basic('neo4j', '123jn1lk2j3n'));

// Global Variables
var movieArr = [];
var actorArr = [];
var dataArr = [];


// Page Routes
app.get('/', function (req, res) {
    res.render('index');
});


app.post('/addActorMovies', async function (req, res) {
    var actorId = parseInt(req.body.actorId);

    // Create a session for this specific request
    var session = driver.session();
    //empty data array
    var newDataArr = [];

    try {
        // Parameterize your query to prevent injection attacks
        var query = 'MATCH (actor:Person)-[edge:ACTED_IN]->(movie:Movie) WHERE ID(actor) = ' + actorId + ' RETURN movie, edge';
        var result = await session.run(query);

        result.records.forEach(function (record) {
            edge = record._fields[1];
            //if not inside the movieArr add it to movieArr and data
            if (!movieArr.includes(record._fields[0].properties.title)) {
                movieArr.push(record._fields[0].properties.title);

                //add nodes to data array 
                newDataArr.push({
                    data: {
                        id: record._fields[0].identity.low,
                        type: record._fields[0].labels[0],
                        properties: record._fields[0].properties,
                    }
                });

                //add edges to data array 
                var edgeId = edge.start.low + '-' + edge.type + '-' + edge.end.low + '_' + edge.identity;
                if (newDataArr.some(e => e.data.id === edgeId)) {
                    return;
                }
                newDataArr.push({
                    data: {
                        id: edge.start.low + '-' + edge.type + '-' + edge.end.low + '_' + edge.identity,
                        source: edge.start.low,
                        target: edge.end.low,
                        type: edge.type,
                        label: edge.type,
                        properties: edge.properties,
                    }
                });

            }
        });
        // Send the response
        res.json(newDataArr);
    } catch (error) {
        // Handle any errors that occurred
        console.log(error);
        res.status(500).send('Error occurred');
    } finally {
        // Ensure the session is closed
        await session.close();
    }
});

app.post('/addMovieActors', async function (req, res) {
    var movieId = parseInt(req.body.movieId);

    // Create a session for this specific request
    var session = driver.session();
    //empty data array
    var newDataArr = [];

    try {
        var query = 'MATCH (actor:Person)-[edge:ACTED_IN]->(movie:Movie) WHERE ID(movie) = ' + movieId + ' RETURN actor, edge';
        var result = await session.run(query);

        result.records.forEach(function (record) {
            edge = record._fields[1];
            //if not inside the movieArr add it to movieArr and data
            if (!actorArr.includes(record._fields[0].properties.name)) {
                actorArr.push(record._fields[0].properties.name);

                //add nodes to data array 
                newDataArr.push({
                    data: {
                        id: record._fields[0].identity.low,
                        type: record._fields[0].labels[0],
                        properties: record._fields[0].properties,
                    }
                });

                //add edges to data array 
                var edgeId = edge.start.low + '-' + edge.type + '-' + edge.end.low + '_' + edge.identity;
                if (newDataArr.some(e => e.data.id === edgeId)) {
                    return;
                }
                newDataArr.push({
                    data: {
                        id: edge.start.low + '-' + edge.type + '-' + edge.end.low + '_' + edge.identity,
                        source: edge.start.low,
                        target: edge.end.low,
                        type: edge.type,
                        label: edge.type,
                        properties: edge.properties,
                    }
                });
            }
        });
        // Send the response
        res.json(newDataArr);
    } catch (error) {
        // Handle any errors that occurred
        console.log(error);
        res.status(500).send('Error occurred');
    } finally {
        // Ensure the session is closed
        await session.close();
    }
});

app.post('/actor/depth', async function (req, res) {
    //get actor name and depth from the request
    var actorName = req.body.actor;
    var depth = parseInt(req.body.depth) * 2;

    //empty all arrays
    movieArr = [];
    actorArr = [];
    dataArr = [];

    // Create a session for this specific request
    var session = driver.session();

    try {
        // Run the query using await
        var result = await session.run(
            'MATCH p = (actor:Person {name:"' + actorName + '"})-[:ACTED_IN*0..' + depth + ']-(entity) WITH *, relationships(p) AS edge RETURN entity, edge');

        // Process the result
        result.records.forEach(function (record) {
            //add title and actor names to arrays
            if (record._fields[0].labels[0] === 'Movie') {
                movieArr.push(record._fields[0].properties.title);
            } else {
                actorArr.push(record._fields[0].properties.name);
            }

            //add nodes to data array in the cytoscape format
            dataArr.push({
                data: {
                    id: record._fields[0].identity.low,
                    type: record._fields[0].labels[0],
                    properties: record._fields[0].properties,
                }
            });

            //add edges to data array in the cytoscape format
            if (record._fields[1].size != 0) {
                record._fields[1].forEach(function (edge) {
                    //if it is already pushed continue
                    var edgeId = edge.start.low + '-' + edge.type + '-' + edge.end.low + '_' + edge.identity;
                    if (dataArr.some(e => e.data.id === edgeId)) {
                        return;
                    }
                    dataArr.push({
                        data: {
                            id: edge.start.low + '-' + edge.type + '-' + edge.end.low + '_' + edge.identity,
                            source: edge.start.low,
                            target: edge.end.low,
                            type: edge.type,
                            label: edge.type,
                            properties: edge.properties,
                        },
                    });
                });
            }
        });
        // Send the response
        res.json(dataArr);
    } catch (error) {
        // Handle any errors that occurred
        console.log(error);
        res.status(500).send('Error occurred');
    } finally {
        // Ensure the session is closed
        await session.close();
    }
});

// Server Setup
app.listen(3000);
console.log('Server started on port 3000');

module.exports = app;

