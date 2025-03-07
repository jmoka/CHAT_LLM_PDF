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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Function to read and process PDF file with better error handling
const loadPDF = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error('PDF file not found');
        }
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (error) {
        console.error('Error reading PDF:', error.message);
        throw error;
    }
};

// Process PDF with improved error messages
const processPDFFromPath = async () => {
    try {
        const pdfText = await loadPDF('./jota.pdf');
        return pdfText;
    } catch (error) {
        console.error('Error processing PDF:', error.message);
        return `Error processing PDF: ${error.message}`;
    }
};

app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        const pdfContent = await processPDFFromPath();

        if (pdfContent.startsWith('Error processing PDF')) {
            throw new Error(pdfContent);
        }

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                { 
                    role: "system", 
                    content: `Use this PDF content as context for answering questions: ${pdfContent}`
                },
                { 
                    role: "user", 
                    content: userMessage 
                }
            ],
            max_tokens: 150,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const botReply = response.data.choices[0].message.content;
        res.json({ response: botReply });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ 
            error: 'Erro ao processar a solicitação.',
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});