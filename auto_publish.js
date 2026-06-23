#!/usr/bin/env node
// Автопубликация через локальный AI сервис

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ARTICLES = [
  { title: "Что делать если приставы арестовали счёт в 2026", slug: "arest-scheta-pristavy-2026", category: "Исполнительное производство", keywords: "арест счёта приставы, снять арест со счёта", description: "Пошаговая инструкция если приставы арестовали банковский счёт." },
  { title: "Как вернуть деньги за некачественный ремонт квартиры", slug: "vozvrat-deneg-remont-kvartiry", category: "Защита прав потребителей", keywords: "некачественный ремонт, вернуть деньги", description: "Как вернуть деньги за некачественный ремонт квартиры." },
  { title: "Как не платить кредит законно — 7 способов 2026", slug: "kak-ne-platit-kredit-2026", category: "Кредиты", keywords: "как не платить кредит, списать кредит", description: "Законные способы избавиться от кредита." },
  { title: "Что делать если соседи сделали перепланировку", slug: "pereplanirovka-sosedi", category: "Жилищное право", keywords: "перепланировка соседей, жалоба", description: "Как бороться с незаконной перепланировкой соседей." },
  { title: "Как оспорить завещание родителя", slug: "osporit-zaveshanie", category: "Наследство", keywords: "оспорить завещание, наследство", description: "Как оспорить завещание и получить наследство." },
];

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | DokIQ</title>
  <meta name="description" content="{description}" />
  <meta name="keywords" content="{keywords}" />
  <link rel="canonical" href="https://dokiq.ru/blog/{slug}/" />
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    h1 { color: #2c3e50; font-size: 2em; margin-bottom: 0.5em; }
    h2 { color: #34495e; font-size: 1.5em; margin-top: 1.5em; }
    p { margin-bottom: 1em; text-align: justify; }
    .meta { color: #7f8c8d; font-size: 0.9em; margin-bottom: 2em; }
    .cta { background: #3498db; color: white; padding: 15px; border-radius: 5px; margin: 2em 0; text-align: center; }
    .cta a { color: white; text-decoration: none; font-weight: bold; }
    footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #eee; color: #7f8c8d; font-size: 0.9em; }
  </style>
</head>
<body>
  <article>
    <h1>{title}</h1>
    <div class="meta">Опубликовано: {date} | Категория: {category} | DokIQ</div>
    {content}
    <div class="cta">
      💡 <a href="https://dokiq.ru/">Создайте свой юридический документ за 5 минут на DokIQ</a>
    </div>
  </article>
  <footer>
    <p>© 2026 DokIQ — Все права защищены.</p>
  </footer>
</body>
</html>`;

function loadEnv() {
  const env = {};
  const envFile = fs.readFileSync('/var/www/legal-mrl/.env', 'utf8');
  for (const line of envFile.split('\n')) {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, ...valParts] = line.split('=');
      env[key.trim()] = valParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const API_KEY = env.OPENAI_API_KEY || env.MOONSHOT_API_KEY;

async function generateWithOpenAI(topic) {
  const prompt = `Напиши SEO-статью на тему: "${topic}"

ТРЕБОВАНИЯ:
1. Простой язык для обывателей
2. Объём: 1500-2000 слов
3. Структура: H1, введение, 4-5 разделов H2, заключение
4. Опирайся на законодательство РФ (2026)
5. Конкретные статьи ГК РФ, ЖК РФ, ТК РФ
6. Примеры из судебной практики
7. Без markdown, связным текстом
8. Упомяни DokIQ в заключении

Формат:
TITLE: [Заголовок]
CONTENT:
[Текст]`;

  const data = JSON.stringify({
    model: 'kimi-k2.5',
    messages: [
      { role: 'system', content: 'Ты юрист и SEO-специалист. Пишешь полезные статьи простым языком.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 4000
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.moonshot.cn',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    }, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          const text = result.choices?.[0]?.message?.content || '';
          
          const titleMatch = text.match(/TITLE:\s*(.+)/);
          const contentMatch = text.match(/CONTENT:\s*([\s\S]+)/);
          
          resolve({
            title: titleMatch ? titleMatch[1].trim() : topic,
            content: contentMatch ? contentMatch[1].trim() : text
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting blog post generation...`);
  
  const dbPath = '/var/www/dokiq/.articles_db.json';
  let db = { published: [], queue: [...ARTICLES] };
  
  if (fs.existsSync(dbPath)) {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  }
  
  if (!db.queue || db.queue.length === 0) {
    db.queue = [...ARTICLES];
  }
  
  const article = db.queue[Math.floor(Math.random() * db.queue.length)];
  db.queue = db.queue.filter(a => a.slug !== article.slug);
  
  console.log(`Generating: ${article.title}`);
  
  try {
    const post = await generateWithOpenAI(article.title);
    
    // Save article
    const articleDir = path.join('/var/www/dokiq/blog', article.slug);
    fs.mkdirSync(articleDir, { recursive: true });
    
    const html = HTML_TEMPLATE
      .replace('{title}', post.title)
      .replace('{description}', article.description)
      .replace('{keywords}', article.keywords)
      .replace('{slug}', article.slug)
      .replace('{date}', new Date().toLocaleDateString('ru-RU'))
      .replace('{category}', article.category)
      .replace('{content}', post.content.replace(/\n\n/g, '</p>\n<p>').replace(/\n/g, '<br>'));
    
    fs.writeFileSync(path.join(articleDir, 'index.html'), html, 'utf8');
    console.log(`Saved: ${articleDir}/index.html`);
    
    // Update sitemap
    const sitemapPath = '/var/www/dokiq/sitemap.xml';
    if (fs.existsSync(sitemapPath)) {
      let sitemap = fs.readFileSync(sitemapPath, 'utf8');
      const newEntry = `  <url>\n    <loc>https://dokiq.ru/blog/${article.slug}/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      sitemap = sitemap.replace('</urlset>', newEntry + '</urlset>');
      fs.writeFileSync(sitemapPath, sitemap, 'utf8');
    }
    
    db.published.push({...article, publishedAt: new Date().toISOString()});
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    
    console.log(`✅ Published: ${post.title}`);
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    db.queue.push(article);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  }
  
  console.log(`[${new Date().toISOString()}] Done!`);
}

main().catch(console.error);
