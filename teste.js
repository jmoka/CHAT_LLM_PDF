const Groq = require('groq-sdk');

const groq = new Groq();
async function main() {
  const chatCompletion = await groq.chat.completions.create({
    "messages": [],
    "model": "deepseek-r1-distill-llama-70b",
    "temperature": 0.6,
    "max_completion_tokens": 4096,
    "top_p": 0.95,
    "stream": true,
    "stop": null
  });

  for await (const chunk of chatCompletion) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
}

main();