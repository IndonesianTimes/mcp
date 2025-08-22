const axios = require('axios');
const { execSync } = require('child_process');
const logger = require('./logger');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const KB_QUERY_URL = `http://localhost:${process.env.PORT || 3000}/kb/query`;
const SITE_URL = process.env.SITE_URL || "https://tautin.id/K891";

/**
 * Generate JWT token dinamis via genToken.js
 */
function generateToken() {
  try {
    const output = execSync('node genToken.js').toString().trim();
    // Ambil token tanpa 'Bearer' prefix jika ada
    return output.replace(/^Bearer\s+/i, '');
  } catch (e) {
    logger.error('[JWT] Failed to generate token:', e);
    return '';
  }
}

/**
 * Ambil data dari KB Meilisearch via /kb/query
 */
async function fetchKBData(question) {
  try {
    const token = generateToken();
    if (!token) throw new Error('No valid JWT token');
    const res = await axios.post(
      KB_QUERY_URL,
      { query: question },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.data && res.data.success && Array.isArray(res.data.data)) {
      logger.info(`[KB] Data fetched: ${res.data.data.length} items`);
      return res.data.data;
    }
    logger.warn('[KB] Invalid response from /kb/query');
    return [];
  } catch (err) {
    logger.error(`[KB] Fetch error: ${err.message}`);
    return [];
  }
}

/**
 * Fungsi utama AI untuk endpoint /ask
 */
async function askAI(question) {
  if (typeof question !== 'string') throw new TypeError('question must be string');
  const cleanedQuestion = question.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleanedQuestion) throw new Error('question cannot be empty');

  // 1. Query data ke KB, filter Kangtau89
  let articles = await fetchKBData(cleanedQuestion);


  // 2. Susun konteks prompt untuk GPT
  const context = articles.map((a, i) =>
    `${i + 1}. Nama: ${a.name || a.title}
 RTP: ${a.rtp || 'N/A'}%
 Jam Gacor: ${a.jam_gacor || 'N/A'}
 Pola Main: ${(a.pola_main || []).join(', ') || 'N/A'}`
  ).join('\n\n');

  // 3. System prompt & user prompt optimal (termasuk instruksi anchor link)
  const systemPrompt = `
Kamu adalah analis data slot profesional dari Primes AI, sebuah layanan AI RTP data analyst terpercaya.  
Primes AI secara resmi bekerja sama dengan situs bermain Kangtau89 untuk menyediakan analisis dan rekomendasi data slot yang akurat dan berbobot.  
Berikan jawaban yang informatif, objektif, dan menggunakan bahasa formal dan profesional.  
Hindari menyebut AI, GPT, atau OpenAI dalam jawaban karena sekarang kamu adalah Primes AI.
Selalu sebutkan angka RTP (%) setiap slot yang dibahas atau direkomendasikan, jika datanya tersedia pada context.  
Saat memberikan tautan, tampilkan link dengan format anchor markdown seperti:  
- web bermain [Kangtau89](${SITE_URL})  
- informasi slot [Primes AI](https://primesai.co)  
Jika dalam pertanyaan terdapat kata-kata seperti "link", "url", "site", "situs", "web", atau "website",  
sertakan dengan halus URL resmi kami: [Kangtau89](${SITE_URL})  
Sampaikan informasi dengan cara yang meyakinkan dan membantu, tanpa terkesan mempromosikan secara agresif.
  `;

  const userPrompt = `
Data slot terbaru dari Kangtau89:
${context}

Pertanyaan user:
${cleanedQuestion}

Berdasarkan data di atas, berikan analisis dan rekomendasi yang jelas, rinci, dan sisipkan strategi untuk user.  
Jika tersedia data angka RTP (%) di context, **selalu tuliskan angka RTP setiap slot yang dibahas** secara eksplisit (misal: "Sweet Bonanza — RTP: 97.2%").  
Jika pertanyaan mengandung permintaan terkait "link", "url", "site", "situs", "web", atau "website",  
sertakan juga URL resmi kami dengan format anchor markdown: [Kangtau89](${SITE_URL})  
dan informasi slot [Primes AI](https://primesai.co) dalam jawaban secara alami dan sopan.
  `;

  // 4. Kirim ke OpenAI GPT
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt.trim() },
        { role: 'user', content: userPrompt.trim() },
      ],
      temperature: 0.8,
      max_tokens: 900,
    });

    if (!response || !response.choices || !response.choices[0]?.message?.content) {
      throw new Error('Empty response from OpenAI');
    }

    return {
      answer: response.choices[0].message.content,
      sources: articles.map(a => ({
        id: a.id,
        title: a.title || a.name,
        rtp: a.rtp,
        jam_gacor: a.jam_gacor,
        pola_main: a.pola_main,
      })),
    };
  } catch (error) {
    logger.error(`[OpenAI] Request failed: ${error.message}`);
    throw new Error(`OpenAI request failed: ${error.message}`);
  }
}

module.exports = { askAI };

