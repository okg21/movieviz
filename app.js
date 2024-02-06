
// Load the modules we need
var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var neo4j = require('neo4j-driver');
var cytoscape = require('cytoscape');
var fcose = require('cytoscape-fcose');
const axios = require('axios');
require('dotenv').config();

// Get the OpenAI token from the environment
const openaiToken = process.env.OPENAI_TOKEN;

const options = {
    headers: { Authorization: `Bearer ${process.env.OPENAI_TOKEN}`, 'Content-Type': 'application/json' },
};

// Register the layout
cytoscape.use(fcose);


const gpt_role_prompt = `You are an expert on Neo4j javascript queries. Return javascript queries for the given natural text. Just return the query as string no additional code or text.
Query should be able to return a graph, so it should include MATCH and RETURN clauses. And don't return table, return graph. Always return edges.
Any variables you want to use after the WITH must be explicitly passed along such as: WITH p, r, m, count(m) as moviesCount . So always after WITH, pass the variables you want to use in the next clause.
Even though you know a relationship type, you should use the generic relationship type in the query. For example, instead of :ACTED_IN, use r:ACTED_IN. Then return r.
People want to see the relations between the nodes, not just the nodes. So always return edges.

I will now describe a dataset represented in a graph database schema suitable for a Neo4j database. This dataset is structured around two main node labels: Movie and Person.
Node Labels:
Movie: Represents the entity for films or movies in the database.
Person: Represents individuals, typically involved in the film industry, such as actors, directors, and producers.

Relationship Types:
ACTED_IN: A relationship from a Person node to a Movie node indicating that the person has acted in that particular movie.
DIRECTED: A relationship from a Person node to a Movie node indicating that the person has directed the movie.
PRODUCED: A relationship from a Person node to a Movie node indicating that the person has produced the movie.
WROTE: A relationship from a Person node to a Movie node indicating that the person wrote the movie.
REVIEWED: A relationship that could be from a Person node to a Movie node indicating that the person reviewed the movie.
FOLLOWS: A relationship that could be between two Person nodes indicating that one follows the other, perhaps on social media or within a professional context.

Property Keys:
For Person nodes:
born: The birthdate or birth year of the person.
name: The full name of the person.
For Movie nodes:
title: The title of the movie.
released: The release date or release year of the movie.
rating: The rating of the movie, which could be an IMDb rating, Rotten Tomatoes score, or similar.
tagline: A memorable phrase or sentence that encapsulates the essence of the movie.
summary: A brief description or synopsis of the movie.
For edges:
roles: Likely a property associated with the ACTED_IN relationship, detailing the character(s) played by the person in the movie.
Feedback from earlier runs will be given if the query is not correct. If the query is correct, the feedback will be empty.`;


async function callOpenAIChatGPT(prompt, feedback = "") {
    console.log('ChatGPT Prompt:', prompt);
    var promptData = {
        model: 'gpt-4',
        messages: [
            { role: 'system', content: gpt_role_prompt},
            { role: 'user', content: "Feedback: " + " Prompt: " + prompt },
        ],
        n: 1
    };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', promptData, options);
    responseText = response.data.choices[0].message.content
  } catch (error) {
    console.error('Error calling OpenAI ChatGPT:', error);
  }
  //if there are quotations at the first and last characters remove them
    if (responseText.charAt(0) === '"' && responseText.charAt(responseText.length - 1) === '"') {
        responseText = responseText.slice(1, -1);
    }

  return responseText
}



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

app.post('/llm', async function (req, res) {
    prompt = req.body.prompt
    query = await callOpenAIChatGPT(prompt);
    console.log('ChatGPT Response:', query);    
    
    //empty all arrays
    movieArr = [];
    actorArr = [];
    dataArr = [];

    // Create a session for this specific request
    var session = driver.session();

    try {
        // Run the query using await
        var result = await session.run(query);
        console.log('Result:', result);

        // Process the result
        result.records.forEach(function (record) {

            //go through all fields and add to data array
            record._fields.forEach(function (field) {
               
                //if labels is defined which means it is not a relationship
                if (field.labels != undefined) {
                    var label = field.labels[0];
                    if (label === 'Movie') {
                        movieArr.push(field.properties.title);
    
                        //add nodes to data array in the cytoscape format
                        dataArr.push({
                            data: {
                                id: field.identity.low,
                                type: field.labels[0],
                                properties: field.properties,
                            }
                        });
                    }
                    else if (label === 'Person') {
                        actorArr.push(field.properties.name);
    
                        //add nodes to data array in the cytoscape format
                        dataArr.push({
                            data: {
                                id: field.identity.low,
                                type: field.labels[0],
                                properties: field.properties,
                            }
                        });
                    }
                }
                else if (field.start != undefined) {
                    //add edges to data array in the cytoscape format
                    edge = field;
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
                }
            });
        });
        // Send the response
        res.json(dataArr);

    } catch (error) {
        // Handle any errors that occurred
        console.log(error);
        responseWithFeedback = await callOpenAIChatGPT(prompt, error);
        console.log('Feedback:', responseWithFeedback);
        // go to the query execution again
        
        //res.status(500).send('Error occurred');
    } finally {
        // Ensure the session is closed
        await session.close();
    }


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

