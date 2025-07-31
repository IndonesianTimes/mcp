// Utility module for interacting with LLM backends
const { searchArticles } = require('./search');
const logger = require('./logger');

const BACKEND = process.env.LLM_BACKEND || 'local';

/**
 * Ask the AI a question with optional context from the knowledge base.
 * @param {string} question
 * @returns {Promise<{answer: string, sources: {id: string|number, title: string}[]}>}
 */
async function askAI(question) {
  if (typeof question !== 'string') {
    throw new TypeError('question must be a string');
  }

  // simple sanitisation and trim
  const cleanedQuestion = question.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleanedQuestion) {
    throw new Error('question cannot be empty');
  }

  if (process.env.APP_MODE === 'demo') {
    logger.info('LLM: demo mode active');
    return {
      answer: `Demo response for: ${cleanedQuestion}`,
      sources: [],
    };
  }

  let articles = [];
  try {
    articles = await searchArticles(cleanedQuestion).then(a => a.slice(0, 3));
  } catch (err) {
    // swallow errors but log
    logger.error(`searchArticles failed: ${err.message}`);
  }

  const context = articles
    .map(a => `Title: ${a.title}\nSnippet: ${a.snippet}`)
    .join('\n\n');

  const fullPrompt =
    `Answer the question using the context below.\n\nContext:\n${context}\n\nQuestion: ${cleanedQuestion}\n\nAnswer:`;

  let answerText = '';
  if (BACKEND === 'openai') {
    try {
      const openaiModule = require('openai');
      if (openaiModule.apiKey !== undefined) {
        openaiModule.apiKey = process.env.OPENAI_API_KEY;
      }
      const client = openaiModule.OpenAI
        ? new openaiModule.OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : openaiModule;
      const createFn = client.ChatCompletion?.create || client.chat?.completions?.create;
      if (typeof createFn !== 'function') {
        if (!client.chat) {
          logger.error('OpenAI client.chat missing; SDK structure may have changed');
        }
        if (process.env.APP_MODE === 'demo') {
          return {
            answer: `Demo response for: ${cleanedQuestion}`,
            sources: [],
          };
        }
        throw new Error('OpenAI SDK does not provide a chat completion function');
      }
      const response = await createFn.call(client, {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: fullPrompt },
        ],
      });
      if (!response || !response.choices || !response.choices[0]?.message?.content) {
        throw new Error('Empty response from OpenAI');
      }
      answerText = response.choices[0].message.content;
    } catch (err) {
      logger.error(`OpenAI request failed: ${err.message}`);
      throw new Error(`OpenAI request failed: ${err.message}`);
    }
  } else if (BACKEND === 'local') {
    try {
      const local = require('./local_llm');
      answerText = await local.generate(fullPrompt);
    } catch (err) {
      logger.error(`Local LLM error: ${err.message}`);
      throw new Error(`Local LLM error: ${err.message}`);
    }
  } else {
    throw new Error(`Unsupported LLM_BACKEND: ${BACKEND}`);
  }

  return {
    answer: String(answerText || '').trim(),
    sources: articles.map(a => ({ id: a.id, title: a.title })),
  };
}

module.exports = { askAI };
