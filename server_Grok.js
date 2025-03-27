require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const Groq = require('groq-sdk');  // Importando o Groq SDK

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const API_GROK_TESTE = process.env.API_GROK_TESTE;  // Substituímos a chave OpenAI pela chave do Groq

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

// Instanciando o Groq SDK
const groq = new Groq({ apiKey: API_GROK_TESTE });

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

        // Preparando a requisição para o modelo Groq
        const chatCompletion = await groq.chat.completions.create({
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
            model: "llama-3.3-70b-versatile",  // Substituindo pelo modelo Groq
            temperature: 1,
            max_completion_tokens: 1024,
            top_p: 1,
            stream: true,
            stop: null
        });

        // Respondendo com os dados processados do chat
        let botReply = '';
        for await (const chunk of chatCompletion) {
            botReply += chunk.choices[0]?.delta?.content || '';
        }

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
