# MovieViz

MovieViz is a web application that allows users to visualize movie data. It uses Node.js and Express for the backend, and EJS for the frontend.

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/okg21/movieviz.git
    ```

2. Install the dependencies:

    ```bash
    cd movieviz
    npm install dependencies
    ```
3. Start Neo4j Database
     ```bash
     Initialize your Neo4j database with
     username: 'neo4j', password: '123jn1lk2j3n'
     (Or change authentication details inside app.js)
     Run load-movies.cypher
     ```
4. Create a .env file and store your OpenAI token such as:
    ```
    OPENAI_TOKEN = <YOUR OPENAI TOKEN>
    ```
## Usage

1. Start the application:

    ```bash
    node app.js
    ```

2. Open your web browser and navigate to `http://localhost:3000`.

## Files

- `app.js`: This file contains the main server logic and routes.
- `/views/index.ejs`: This file contains the application's main view.
