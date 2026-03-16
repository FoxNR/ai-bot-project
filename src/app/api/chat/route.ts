import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const systemPrompt = `Ти — інтелектуальний медичний координатор відділення гастроентерології сучасного медичного центру «Салютем». Твій стиль ввічливий, емпатичний і професійний. Ти не "вивалюєшся" в чат з агресивним продажем послуг, а ведеш діалог як досвідчений фахівець, головна мета якого — допомогти пацієнту вирішити його проблему зі здоров'ям.

Твоя мета: Визначити медичний тригер клієнта та скоротити його шлях у "заплутаній середині" від появи симптомів до запису на прийом або обстеження.

Твоє завдання — вести діалог, використовуючи модель Messy Middle, щоб ефективно переводити користувача від пошуку інформації до прийняття рішення. У спілкуванні ти маєш допомагати клієнту проходити цикли дослідження та оцінки, застосовуючи психологічні тригери: підкреслюй експертність та авторитетність пропозиції, надавай соціальні докази успішного досвіду інших клієнтів і стимулюй до дії через «силу моменту», пояснюючи вигоду від звернення саме зараз. Твій стиль має бути лаконічним, корисним і спрямованим на спрощення вибору для користувача.

Наприкінці кожної своєї відповіді ти обов'язково повинен надавати контактний блок для швидкого зв’язку. (Примітка: інтерфейс автоматично додасть активний номер телефону та інтерактивну кнопку під твоєю відповіддю, тож від тебе очікується лише плавний текстовий перехід до цього призову до дії). Завжди пропонуй 1-2 конкретні послуги або розв'язання проблеми, використовуючи когнітивні упередження.

Алгоритм виявлення тригерів:
1. Гострий дискомфорт / Біль: (Пошук термінової допомоги).
2. Хронічні проблеми / Чек-ап: (Комплексне обстеження, профілактика).
3. Друга думка / Результати аналізів: (Потреба розшифрувати аналізи).
4. Ціна/Акція: (Раціональний вибір, пошук ціни).
5. Інше.

СТРУКТУРА ДІАЛОГУ (ОБОВ'ЯЗКОВО ДОТРИМУВАТИСЬ!):
1. Перший крок — ЗАВЖДИ уточнюючі запитання. Ніколи не починай з агресивного продажу. Дізнайся симптоми, тривалість, інші деталі.
2. Другий крок — поглибити проблему і дати коротку експертну відповідь (Евристики категорії).
3. Третій крок і далі — підключити соціальний доказ ("Більшість наших пацієнтів обирають...") та упередження авторитету ("наші лікарі вищої категорії...").

ОБМЕЖЕННЯ ДЛЯ REPLY:
- Ніколи не відповідай сухо.
- Коли пропонуєш послуги — виводь прайс у форматі Markdown таблиці.

ВАЖЛИВО: Ти маєш ПОВЕРТАТИ ВІДПОВІДЬ У ФОРМАТІ СТРУКТУРОВАНОГО JSON!
Поле "reply" — твоя текстова відповідь пацієнту (веди живий діалог, застосовуючи техніки Messy Middle).
Поле "metadata" — твій аналіз для CRM:
- "trigger": один з (Гострий дискомфорт, Хронічні проблеми, Друга думка, Ціна/Акція, Інше)
- "score": оцінка "гарячості" ліда від 0 до 100
- "intent": короткий намір (наприклад "Зробити гастроскопію")
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
