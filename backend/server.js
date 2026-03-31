// THIS IS A ENTRY POINT OF OUR BACKEND

// "require" is used to import libraries in Nodejs ... like in python we use "import"
const express = require('express');

// "dotenv" is used to load secret keys from .env file into the program
require('dotenv').config();

// importing our explainer function
const { explainCode } = require('./explainer')

// creating our "app" ... this is the server object which we will configure
const app = express();

// telling the server to understand JSON data in requests ... means when the frontend send us code it will be in JSON format
app.use(express.json());

// This tells Express to serve files from the "frontend" folder
// So when browser visits http://localhost:3000 it gets index.html
app.use(express.static('frontend'));

// ROUTE: GET/
// A "route" is like a URL path the server listens to.
// When someone visits http://localhost:3000/, this runs.
// Our original route
app.get('/', (req,res) =>{
    // req = the request (what came IN / user input)
    // res = the response (what we send OUT / our response to that input)
    res.send('AI Codebase Explainer is running!🚀');
});

// UPDATED ROUTE: POST /explain
// "POST" means the request carries data (our code snippet).
// GET is for fetching, POST is for sending data.
app.post('/explain', async(req,res)=>{
    // Now reads code from the request body instead of using hardcoded code
    const { code } = req.body;
    // req.body is the JSON data which the user sent us
    // We "destructure" it to pull out the "code" field
    // This is the same as: const code = req.body.code

    // --- VALIDATION ---
    // Always check your inputs before using them!
    // What if someone sends an empty request? We handle that gracefully instead of crashing
    if (!code || code.trim === ' '){
        return res.status(400).json({
            error:'Please send some code to explain!'
        });
    }

    // Optional: length guard
    // Very long code = very long AI response = slow & expensive
    // Let's set a reasonable limit for now

    if (code.length > 5000){
        return res.status(400).json({
            error: 'Code is too long! Please keep it under 5000 characters.'
        });
    }

  // --- CALLING AI ---
  // "try/catch" means: try this, and if it crashes, catch the error
  // Without this, one error would crash the whole server!
  try {
    // Call our AI function and wait for the explanation
    const explanation = await explainCode(code);

    // Send back the explanation AND echo the code so the frontend can display both side by side later
    // JSON is just a structured text format ... easy for computers to read
    res.json({ 
        code, // the original code they sent
        explanation // the AI's explanation
    });

  } catch (error) {
      // If something went wrong, tell the user (and log it for us)
      console.error('Error talking to AI:', error.message);
      res.status(500).json({
        error: 'Something went wrong with the AI. Try again!'
    });
  }
});

// Start the server on port 3000
// "Port" is like a door number on your computer.
// 3000 is a common choice for development.
const PORT = process.env.PORT || 3000;
// I’ll use the port you give me … but if you stay silent, I’ll pick 3000.

app.listen(PORT, ()=>{
    // This message appears in our terminal when the server starts
    console.log(`Server is running at http://localhost:${PORT}`);
});