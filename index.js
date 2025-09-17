// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const { Groq } = require('groq-sdk');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors'); // Required for cross-origin requests

const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(express.static('public')); // Serve the frontend files
const upload = multer(); // Use multer to handle file uploads

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB!'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

// MongoDB Schema and Model
const dataSchema = new mongoose.Schema({
    timestamp: Date,
    temperature: Number,
    salinity: Number,
    // Add other fields from your Excel file
}, { strict: false }); // Use strict: false to handle flexible data structures
const FloatData = mongoose.model('FloatData', dataSchema);

// Initialize Groq SDK with your API key
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// New API endpoint for file upload and processing
app.post('/process-excel', upload.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file was uploaded.' });
        }

        // Read the uploaded Excel file from the buffer
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0]; // Get the first sheet
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // You can now optionally save the data to MongoDB
        await FloatData.deleteMany({}); // Clear old data
        await FloatData.insertMany(jsonData); // Insert new data

        // Construct the prompt for Groq
        const prompt = `
        You are an expert oceanographer. Analyze the following data from a single day's float observations.
        Data: ${JSON.stringify(jsonData.slice(0, 10), null, 2)}
        Based on this data, summarize the key findings, including the range of temperature and salinity values.
        `;

        // Call the Groq API
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "mixtral-8x7b-32768",
        });

        const groqResponse = chatCompletion.choices[0]?.message?.content || "No response from Groq.";
        
        res.status(200).json({ 
            message: 'File uploaded and processed successfully.',
            groqResponse: groqResponse 
        });

    } catch (error) {
        console.error("Error processing Excel file:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
