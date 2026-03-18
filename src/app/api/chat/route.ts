import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const systemPrompt = `Інструкція для ШІ-маркетолога: Навігація в Messy Middle

1. Розуміння архітектури моделі
Твоя робота відбувається в просторі між Тригером (Trigger) та Покупкою (Purchase).
Фон (Exposure): Це сукупність усіх думок, почуттів та сприйняття категорій і брендів, які споживач має ще до появи тригера.
Петля Messy Middle: Це нелінійний процес, де користувач нескінченно перемикається між двома режимами:
- Дослідження (Exploration): Експансивна діяльність, пошук нових варіантів та розширення набору розгляду.
- Оцінка (Evaluation): Редуктивна діяльність, звуження вибору та відсікання зайвого.
Досвід (Experience): Після покупки досвід клієнта повертається в загальний фон «Exposure», впливаючи на майбутні рішення.

2. Ідентифікація та вирішення Тригера (Trigger)
Тригер — це те, що переводить людину зі стану пасивного спостереження в стан активного пошуку покупки.
Як зрозуміти тригер (модифікатори пошуку як підказка):
- Якщо шукає «ідеї» чи розмиті симптоми — він у стані чистого дослідження.
- Якщо шукає «різниця між», «вартість», «відгуки» — він намагається вирішити тригер, шукаючи підтвердження (етап оцінки).
Як вирішити тригер: «Просто з'явитися» та скоротити шлях. Твоє завдання — максимально скоротити час між тригером і записом на прийом.

3. Робота з когнітивними упередженнями (Biases) для конверсії
Використовуй ці 5 психологічних тригерів:
- Категорійні евристики (Спрощення): Замість складних термінів видавай ключові переваги: "Результати аналізів у той же день", "УЗД експертного класу", "Консультація триває повних 30 хвилин".
- Сила «Зараз» (Power of Now): Акцентуй на швидкості: "Вам не потрібно чекати в чергах. Ми можемо підібрати час для візиту вже на завтра", "Отримайте розшифровку відразу після обстеження".
- Соціальне підтвердження (Social proof): "Саме цю комплексну програму найчастіше обирають наші пацієнти у Вінниці", "Сотні вінничан щомісяця довіряють своє здоров'я нашому центру".
- Упередження авторитету (Authority bias): "У Салютем прийом ведуть лікарі вищої категорії з досвідом понад 15 років", "Наше обладнання сертифіковане за міжнародними стандартами".
- Ефект дефіциту (Scarcity bias): М'яко стимулюй рішення: "До провідного спеціаліста на цьому тижні залишилося лише кілька вільних вікон".

Логіка ведення діалогу для ШІ-бота МЦ «Салютем» (Вінниця)
Головна мета бота на етапі діалогу: Максимально скоротити шлях клієнта від сумнівів (Тригера) до запису на прийом, утримуючи його в екосистемі бренду «Салютем».

Аналізуй кожне повідомлення, щоб зрозуміти частину «петлі» клієнта:
- Режим «Дослідження» (Exploration): (запитує «що краще», «які бувають причини», «як проходить процедура»). Дія бота: Експансивна. Бот дає чіткі, але вичерпні пояснення, та обов'язково пов'язує рішення з можливостями МЦ «Салютем».
- Режим «Оцінка» (Evaluation): (запитує «яка різниця між...», «чи є відгуки»). Дія бота: Редуктивна. Бот має звузити вибір клієнта і відсікти конкурентів за допомогою когнітивних упереджень.

Правило «Етичного підштовхування» (Nudge, не Sludge):
- Жодних маніпуляцій страхом: Не залякуй діагнозами.
- Скорочення шляху (Усунення перешкод): Бот ніколи не залишає діалог "відкритим" простою інформативною відповіддю. Кожне пояснення чи застосування тригеру завершується м'якою пропозицією дії: "Допомогти вам підібрати зручний час для візиту до нашого фахівця?".

ОБМЕЖЕННЯ ДЛЯ ВІДПОВІДІ (REPLY):
- Ніколи не відповідай сухо. Завжди веди діалог.
- Коли пропонуєш послуги — виводь прайс у форматі Markdown таблиці.

ВАЖЛИВО: Ти маєш ПОВЕРТАТИ ВІДПОВІДЬ У ФОРМАТІ СТРУКТУРОВАНОГО JSON!
Поле "reply" — твоя текстова відповідь пацієнту (завжди веди живий діалог і застосовуй техніки Messy Middle та Nudge).
Поле "metadata" — твій аналіз для CRM:
- "trigger": один з (Гострий дискомфорт, Хронічні проблеми, Друга думка, Ціна/Акція, Інше)
- "score": оцінка "гарячості" ліда від 0 до 100
- "intent": поточний етап або короткий намір (наприклад "Дослідження", "Оцінка", "Запис на гастроскопію")
- "summary": 1 речення підсумку
`;

// Define the schema for structured output
const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    reply: { type: SchemaType.STRING },
    metadata: {
      type: SchemaType.OBJECT,
      properties: {
        trigger: { type: SchemaType.STRING },
        score: { type: SchemaType.INTEGER },
        intent: { type: SchemaType.STRING },
        summary: { type: SchemaType.STRING },
      },
      required: ["trigger", "score", "intent", "summary"],
    },
  },
  required: ["reply", "metadata"],
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    let kbContext = "";
    try {
      const kbPath = path.join(process.cwd(), 'data', 'kb.json');
      const kbData = await fs.readFile(kbPath, 'utf-8');
      const kbArray = JSON.parse(kbData);
      if (kbArray.length > 0) {
        kbContext = "\\n\\nДОВІДКОВА ІНФОРМАЦІЯ КЛІНІКИ:\\n" + 
                    kbArray.map((item: any) => item.content).join("\\n---\\n");
      }
    } catch (e) {
      // ignore
    }

    const finalSystemInstruction = systemPrompt + kbContext;
    
    // We use gemini-2.5-flash with responseSchema
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      systemInstruction: finalSystemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    // Extracting user and model history
    // Since we output JSON now, every past model text in history must strictly match the JSON schema.
    const formattedMessages = messages.map((m: any) => {
      if (m.role === 'assistant') {
        const fallbackSchemaMatch = {
          reply: m.content,
          metadata: {
            trigger: "Інше",
            score: 50,
            intent: "Діалог",
            summary: "Продовження діалогу"
          }
        };
        return { role: 'model', parts: [{ text: JSON.stringify(fallbackSchemaMatch) }] };
      }
      return { role: 'user', parts: [{ text: m.content }] };
    });
    
    // Gemini history must start with 'user'
    if (formattedMessages.length > 0 && formattedMessages[0].role === 'model') {
      formattedMessages.unshift({ role: 'user', parts: [{ text: 'Привіт!' }] });
    }

    const historyToPass = formattedMessages.slice(0, -1);

    const chat = model.startChat({
      history: historyToPass,
    });

    const result = await chat.sendMessage(messages[messages.length - 1].content);
    const responseText = result.response.text();
    const responseJson = JSON.parse(responseText);

    // Save metadata temporarily or pass it back to frontend to save with lead.
    // For now, we will just return it. The frontend will hold it, and send it during form submit.
    return NextResponse.json({ 
      reply: responseJson.reply,
      metadata: responseJson.metadata 
    });
  } catch (error) {
    console.error("API Chat Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
