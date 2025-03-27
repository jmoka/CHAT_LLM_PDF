require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Diretório onde os PDFs estão armazenados
const directoryPath = path.join(__dirname, 'pdfs');

// Função para ler e processar um único arquivo PDF
const loadPDF = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Arquivo não encontrado: ${filePath}`);
        }
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (error) {
        console.error('Erro ao ler PDF:', error.message);
        throw error;
    }
};

// Função para processar todos os PDFs da pasta
const processPDFFromPath = async () => {
    try {
        // Lê todos os arquivos da pasta
        const pdfFiles = fs.readdirSync(directoryPath).filter(file => file.endsWith('.pdf'));

        if (pdfFiles.length === 0) {
            throw new Error('Nenhum arquivo PDF encontrado na pasta.');
        }

        // Processa todos os arquivos PDFs
        const pdfContents = await Promise.all(
            pdfFiles.map(async (file) => {
                const filePath = path.join(directoryPath, file);
                const content = await loadPDF(filePath);
                return {
                    fileName: file,
                    content: content
                };
            })
        );

        return pdfContents;
    } catch (error) {
        console.error('Erro ao processar PDFs:', error.message);
        return `Erro ao processar PDFs: ${error.message}`;
    }
};

// Endpoint para processar mensagens do usuário
app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        const pdfContent = await processPDFFromPath();

        if (typeof pdfContent === 'string' && pdfContent.startsWith('Erro')) {
            throw new Error(pdfContent);
        }

        // Junta todos os textos dos PDFs para fornecer contexto
        const pdfText = pdfContent.map(pdf => `${pdf.fileName}:\n${pdf.content}`).join("\n\n");

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",
            messages: [
                { 
                    role: "system", 
                    content: `Use este conteúdo extraído dos PDFs para responder às perguntas:\n${pdfText}`
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
        console.error('Erro:', error.message);
        res.status(500).json({ 
            error: 'Erro ao processar a solicitação.',
            details: error.message 
        });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
