#!/usr/bin/env python3
"""
Автопубликация SEO-статей для DokiQ — через requests
"""

import json
import os
import random
import requests
import sys
from datetime import datetime

# Load env manually
def load_env():
    env = {}
    with open('/var/www/legal-mrl/.env', 'r') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, val = line.strip().split('=', 1)
                env[key] = val.strip().strip('"').strip("'")
    return env

env = load_env()
API_KEY = env.get('MOONSHOT_API_KEY') or env.get('OPENAI_API_KEY') or 'sk-zDekPw9Ly54J8IXpGfdlqFiObtlCD9sPcnQQScGRbQRzsTlU'

ARTICLES_DB = "/var/www/dokiq/.articles_db.json"
BLOG_DIR = "/var/www/dokiq/blog"
SITEMAP = "/var/www/dokiq/sitemap.xml"
API_URL = "https://api.moonshot.ai/v1/chat/completions"

ARTICLES = [
    {"title": "Что делать если приставы арестовали счёт в 2026", "slug": "arest-scheta-pristavy-2026", "category": "Исполнительное производство", "keywords": "арест счёта приставы, снять арест со счёта, приставы арестовали карту 2026", "description": "Пошаговая инструкция если приставы арестовали банковский счёт. Как снять арест, что делать, куда обращаться."},
    {"title": "Как вернуть деньги за некачественный ремонт квартиры", "slug": "vozvrat-deneg-remont-kvartiry", "category": "Защита прав потребителей", "keywords": "некачественный ремонт, вернуть деньги за ремонт, ремонт квартиры претензия", "description": "Как вернуть деньги за некачественный ремонт квартиры. Образец претензии, сроки, судебная практика."},
    {"title": "Как не платить кредит законно — 7 способов 2026", "slug": "kak-ne-platit-kredit-2026", "category": "Кредиты", "keywords": "как не платить кредит, списать кредит, банкротство физлица, реструктуризация", "description": "Законные способы избавиться от кредита в 2026 году. Банкротство, реструктуризация, списание долгов."},
    {"title": "Что делать если соседи сделали перепланировку", "slug": "pereplanirovka-sosedi", "category": "Жилищное право", "keywords": "перепланировка соседей, незаконная перепланировка, жалоба на соседей", "description": "Как бороться с незаконной перепланировкой соседей. Куда жаловаться, как через суд."},
    {"title": "Как оспорить завещание родителя и вернуть наследство", "slug": "osporit-zaveshanie-nasledstvo", "category": "Наследство", "keywords": "оспорить завещание, недействительное завещание, наследство по закону", "description": "Как оспорить завещание родителя и получить наследство по закону. Основания, сроки, документы."},
    {"title": "Как выписать бывшего из квартиры через суд 2026", "slug": "vypisat-byvshego-kvartira", "category": "Жилищное право", "keywords": "выписка из квартиры, выписать бывшего, выселение через суд", "description": "Как выписать бывшего супруга или родственника из квартиры через суд. Пошаговая инструкция."},
    {"title": "Что делать если работодатель не оформляет официально", "slug": "rabota-bez-oformleniya", "category": "Трудовое право", "keywords": "работа без оформления, неоформленный работник, трудовая инспекция", "description": "Как защитить права при неофициальной работе. Куда жаловаться, как взыскать зарплату."},
    {"title": "Как вернуть страховку по кредиту после погашения", "slug": "vozvrat-strahovki-kredit", "category": "Кредиты", "keywords": "вернуть страховку по кредиту, отказ от страховки, возврат страховки", "description": "Как вернуть деньги за навязанную страховку по кредиту. Образец заявления, сроки, судебная практика."},
    {"title": "Права арендатора если сняли квартиру с авито", "slug": "prava-arendatora-avito", "category": "Аренда", "keywords": "снять квартиру авито, права арендатора, договор аренды", "description": "Права арендатора при аренде квартиры через Авито. Что проверять, как составить договор."},
    {"title": "Как оспорить штраф за парковку в неположенном месте", "slug": "osporit-shtraf-parkovka", "category": "Административное право", "keywords": "оспорить штраф парковка, штраф гибдд парковка, обжаловать штраф", "description": "Как обжаловать штраф за парковку. Когда можно отменить, какие доказательства нужны."},
    {"title": "Что делать если мошенники сняли деньги с карты", "slug": "moshenniki-karta-dengi", "category": "Банковское право", "keywords": "мошенники сняли деньги, кража с карты, вернуть деньги мошенники", "description": "Как вернуть деньги если мошенники сняли с банковской карты. Куда обращаться, сроки."},
    {"title": "Как развестись если есть несовершеннолетние дети", "slug": "razvod-s-detmi-2026", "category": "Семейное право", "keywords": "развод с детьми, алименты на детей, место жительства ребёнка", "description": "Как развестись если есть несовершеннолетние дети. Алименты, место жительства, порядок общения."},
    {"title": "Как получить компенсацию за задержку рейса в 2026", "slug": "kompensaciya-za-derzhku-reysa", "category": "Защита прав потребителей", "keywords": "компенсация за задержку рейса, отмена рейса, возврат за билеты", "description": "Как получить компенсацию за задержку или отмену авиарейса. Размер, сроки, как требовать."},
    {"title": "Что делать если застройщик просрочил сдачу дома", "slug": "zastroyshchik-prosrochka", "category": "ДДУ", "keywords": "застройщик просрочка, сдача дома, неустойка застройщик, дду", "description": "Что делать если застройщик просрочил сдачу дома. Неустойка, расторжение договора, суд."},
    {"title": "Как вернуть товар в Wildberries и получить деньги", "slug": "vozvrat-wildberries", "category": "Защита прав потребителей", "keywords": "вернуть товар вайлдберриз, возврат wildberries, отказ от товара", "description": "Как вернуть товар в Wildberries и получить деньги обратно. Сроки, способы, претензии."},
    {"title": "Права водителя при ДТП без страховки в 2026", "slug": "dtp-bez-strahovki-2026", "category": "ДТП", "keywords": "дтп без страховки, осаго нет, европротокол, штраф без осаго", "description": "Что делать при ДТП без страховки ОСАГО. Права водителя, ответственность, как действовать."},
    {"title": "Как оформить материнский капитал в 2026 году", "slug": "materinskiy-kapital-2026", "category": "Социальное право", "keywords": "материнский капитал 2026, оформить маткапитал, как получить", "description": "Как оформить и использовать материнский капитал в 2026 году. Изменения, сумма, документы."},
    {"title": "Что делать если незаконно уволили с работы", "slug": "nezakonnoye-uvolneniye", "category": "Трудовое право", "keywords": "незаконное увольнение, восстановление на работе, компенсация увольнение", "description": "Как восстановиться на работе после незаконного увольнения. Компенсация, суд, доказательства."},
    {"title": "Как составить доверенность на продажу квартиры", "slug": "doverennost-prodazha-kvartiry", "category": "Недвижимость", "keywords": "доверенность на продажу квартиры, генеральная доверенность, образец", "description": "Как правильно составить доверенность на продажу квартиры. Виды, сроки, нотариус."},
    {"title": "Как списать долги через банкротство в 2026", "slug": "bankrotstvo-fizlica-2026", "category": "Банкротство", "keywords": "банкротство физического лица, списать долги, банкротство 2026", "description": "Как пройти процедуру банкротства физического лица в 2026 году. Сроки, стоимость, последствия."},
    {"title": "Права покупателя при покупке квартиры с обременением", "slug": "kvartira-s-obremeneniem", "category": "Недвижимость", "keywords": "квартира с обременением, ипотека, арест на квартиру, риски", "description": "Что такое обременение на квартиру и какие риски для покупателя. Как проверить, что делать."},
    {"title": "Как вернуть некачественный телефон в магазин", "slug": "vozvrat-telefona-magazin", "category": "Защита прав потребителей", "keywords": "вернуть телефон, гарантия на телефон, бракованный телефон", "description": "Как вернуть некачественный телефон в магазин. Гарантия, сроки, претензия, суд."},
    {"title": "Что делать если участились звонки коллекторов", "slug": "zvonki-kollektory", "category": "Коллекторы", "keywords": "коллекторы звонки, запрет коллекторам, права должника", "description": "Как остановить звонки коллекторов. Закон, запрет, куда жаловаться, суд."},
    {"title": "Как оформить дарственную на машину родственнику", "slug": "darstvennaya-mashina", "category": "Транспорт", "keywords": "дарственная на машину, дарение автомобиля, переоформление машины", "description": "Как оформить дарственную на автомобиль. Документы, госпошлина, регистрация в ГИБДД."},
]

HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | DokIQ</title>
  <meta name="description" content="{description}" />
  <meta name="keywords" content="{keywords}" />
  <link rel="canonical" href="https://dokiq.ru/blog/{slug}/" />
  <style>
    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }}
    h1 {{ color: #2c3e50; font-size: 2em; margin-bottom: 0.5em; }}
    h2 {{ color: #34495e; font-size: 1.5em; margin-top: 1.5em; }}
    p {{ margin-bottom: 1em; text-align: justify; }}
    .meta {{ color: #7f8c8d; font-size: 0.9em; margin-bottom: 2em; }}
    .cta {{ background: #3498db; color: white; padding: 15px; border-radius: 5px; margin: 2em 0; text-align: center; }}
    .cta a {{ color: white; text-decoration: none; font-weight: bold; }}
    footer {{ margin-top: 3em; padding-top: 1em; border-top: 1px solid #eee; color: #7f8c8d; font-size: 0.9em; }}
  </style>
</head>
<body>
  <article>
    <h1>{title}</h1>
    <div class="meta">Опубликовано: {date} | Категория: {category} | DokIQ — юридические документы онлайн</div>
    {content}
    <div class="cta">
      💡 <a href="https://dokiq.ru/">Создайте свой юридический документ за 5 минут на DokIQ</a>
    </div>
  </article>
  <footer>
    <p>© 2026 DokIQ — Все права защищены. Информация предоставлена в справочных целях и не является юридической консультацией.</p>
  </footer>
</body>
</html>'''

def load_db():
    if os.path.exists(ARTICLES_DB):
        with open(ARTICLES_DB, 'r') as f:
            return json.load(f)
    return {"published": [], "queue": ARTICLES.copy()}

def save_db(db):
    with open(ARTICLES_DB, 'w') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

def generate_article(article):
    """Generate via OpenAI using requests"""
    try:
        prompt = f"""Напиши SEO-статью на тему: "{article['title']}"

ТРЕБОВАНИЯ:
1. Простой язык для обывателей (без сложных юридических терминов)
2. Объём: 2000-3000 слов
3. Структура:
   - H1: Привлекательный заголовок
   - Введение (2-3 абзаца, зачем читать)
   - 4-6 разделов с подзаголовками H2
   - Практические советы в каждом разделе
   - Заключение с призывом к действию
4. Опирайся на актуальное законодательство РФ (2026 год)
5. Указывай конкретные статьи: ГК РФ, ЖК РФ, ТК РФ, НК РФ, ГПК РФ, АПК РФ
6. Приводи примеры из судебной практики
7. Действующие сроки и процедуры (2026 год)
8. НЕ используй markdown (*, #, **)
9. Пиши связным текстом, абзацами
10. Добавь 2-3 совета "Что делать прямо сейчас"
11. Упомяни сервис DokIQ в заключении (создание документов онлайн)

КЛЮЧЕВЫЕ СЛОВА: {article['keywords']}

ФОРМАТ ОТВЕТА:
TITLE: [Заголовок]
CONTENT:
[Полный текст статьи абзацами]"""

        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "kimi-k2.5",
            "messages": [
                {"role": "system", "content": "Ты юрист и SEO-специалист. Пишешь полезные статьи для обычных людей о российском законодательстве простым языком."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 1,
            "max_tokens": 4000
        }
        
        response = requests.post(API_URL, headers=headers, json=data, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        text = result['choices'][0]['message']['content']
        
        # Parse response
        title = article['title']
        content = text
        
        if 'TITLE:' in text:
            lines = text.split('\n')
            for i, line in enumerate(lines):
                if line.startswith('TITLE:'):
                    title = line.replace('TITLE:', '').strip()
                    content = '\n'.join(lines[i+1:]).replace('CONTENT:', '').strip()
                    break
        
        return {"title": title, "content": content}
        
    except Exception as e:
        print(f"Error generating article: {e}")
        return None

def save_article(article, post_data):
    """Save article to disk"""
    article_dir = os.path.join(BLOG_DIR, article['slug'])
    os.makedirs(article_dir, exist_ok=True)
    
    content = post_data.get('content', '')
    title = post_data.get('title', article['title'])
    
    html = HTML_TEMPLATE.format(
        title=title,
        description=article['description'],
        keywords=article['keywords'],
        slug=article['slug'],
        date=datetime.now().strftime('%d.%m.%Y'),
        category=article['category'],
        content=content.replace('\n\n', '</p>\n<p>').replace('\n', '<br>')
    )
    
    index_path = os.path.join(article_dir, 'index.html')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"Saved: {index_path}")
    return index_path

def update_sitemap(article):
    url = f"https://dokiq.ru/blog/{article['slug']}/"
    today = datetime.now().strftime('%Y-%m-%d')
    
    new_entry = f"""  <url>
    <loc>{url}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
"""
    
    if os.path.exists(SITEMAP):
        with open(SITEMAP, 'r', encoding='utf-8') as f:
            sitemap_content = f.read()
        sitemap_content = sitemap_content.replace('</urlset>', new_entry + '</urlset>')
        with open(SITEMAP, 'w', encoding='utf-8') as f:
            f.write(sitemap_content)
    
    print(f"Updated sitemap: {url}")

def main():
    print(f"[{datetime.now()}] Starting blog post generation...")
    
    if not API_KEY:
        print("Error: OPENAI_API_KEY not found in .env")
        sys.exit(1)
    
    db = load_db()
    
    if not db.get('queue'):
        print("No articles in queue. Refilling...")
        db['queue'] = ARTICLES.copy()
    
    article = random.choice(db['queue'])
    db['queue'].remove(article)
    
    print(f"Generating: {article['title']}")
    
    post_data = generate_article(article)
    
    if post_data:
        save_article(article, post_data)
        update_sitemap(article)
        
        db['published'].append({
            **article,
            'published_at': datetime.now().isoformat(),
            'generated_title': post_data.get('title')
        })
        
        save_db(db)
        print(f"✅ Published: {post_data.get('title')}")
    else:
        print("❌ Failed to generate article")
        db['queue'].append(article)
        save_db(db)
    
    print(f"[{datetime.now()}] Done!")

if __name__ == '__main__':
    main()
