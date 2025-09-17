// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const { Groq } = require('groq-sdk');

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB!'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

// MongoDB Schema and Model
const dataSchema = new mongoose.Schema({
    timestamp: Date,
    temperature: Number,
    salinity: Number,
    // Add other fields as needed
});
const FloatData = mongoose.model('FloatData', dataSchema);

// Initialize Groq SDK with your API key
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Middleware to parse JSON bodies
app.use(express.json());

// Main API endpoint to process the query
app.post('/api/query', async (req, res) => {
    try {
        const { question } = req.body;

        // Fetch the one day of data from MongoDB
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const data = await FloatData.find({
          timestamp: { $gte: oneDayAgo }
        }).lean();

        // Construct the prompt for Groq
        const prompt = `
        User question: ${question}
        Data for one day: ${JSON.stringify(data)}
        
        Analyze this data and respond to the user.
        `;

        // Call the Groq API for a quick response
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
            model: "mixtral-8x7b-32768",
        });

        const answer = chatCompletion.choices[0]?.message?.content || "No response from Groq.";
        res.json({ answer });

    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
