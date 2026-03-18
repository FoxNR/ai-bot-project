import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // the data contains: name, phone, chatLog (array), and metadata (trigger, score, intent, summary)
    const newLead = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      name: data.name,
      phone: data.phone,
      trigger: data.trigger || 'Не визначено',
      score: data.score || 0,
      intent: data.intent || '',
      summary: data.summary || '',
      chatLog: data.chatLog || [],
      status: 'Новий',
      source: 'Chat Bot'
    };

    const filePath = path.join(process.cwd(), 'data', 'leads.json');
    
    let leads = [];
    try {
      const fileData = await fs.readFile(filePath, 'utf-8');
      leads = JSON.parse(fileData);
    } catch (err) {
      // File doesn't exist or is empty, start with empty array
    }
    
    leads.push(newLead);
    
    // Sort by Date (newest first optionally, but appending is fine)
    await fs.writeFile(filePath, JSON.stringify(leads, null, 2), 'utf-8');

    // Netlify Forms: save chat-history
    try {
      if (data.chatLog && Array.isArray(data.chatLog)) {
        const full_transcript = data.chatLog
          .map((m: any) => `${m.role === 'user' ? 'Клієнт' : 'Бот'}: ${m.content}`)
          .join('\n\n');

        const formBody = new URLSearchParams();
        formBody.append("form-name", "chat-history");
        formBody.append("session_id", newLead.id);
        formBody.append("user_phone", data.phone || "");
        formBody.append("full_transcript", full_transcript);

        const baseUrl = new URL(req.url).origin;
        await fetch(`${baseUrl}/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody.toString(),
        });
      }
    } catch (formErr) {
      console.error("Netlify Form chat-history submission error:", formErr);
    }

    return NextResponse.json({ success: true, leadId: newLead.id });
  } catch (error) {
    console.error("Lead API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
