require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const pdf = require('pdf-parse');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
let pdfContent = '';

// Initialize PDF content
const initializePDF = async () => {
    try {
        const dataBuffer = fs.readFileSync('./jota.pdf');
        const data = await pdf(dataBuffer);
        pdfContent = data.text;
        console.log('PDF loaded successfully');
    } catch (error) {
        console.error('Error loading PDF:', error.message);
        pdfContent = 'Failed to load PDF';
    }
};

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    try {
        // Use Ollama API instead of OpenAI
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: "qwen2.5:latest",
            prompt: `Context from PDF: ${pdfContent}\n\nUser Question: ${userMessage}\n\nAnswer:`,
            stream: false
        });

        const botReply = response.data.response;
        res.json({ response: botReply });
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro ao processar a solicitação',
            details: error.response?.data || error.message 
        });
    }
});

// Initialize PDF content when server starts
initializePDF().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Using Ollama local LLM');
    });
});