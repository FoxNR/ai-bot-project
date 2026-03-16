import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let type = '';
    let payload = '';
    let contentStr = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      type = formData.get('type') as string;
      const file = formData.get('file') as File;
      
      if (file) {
        payload = file.name;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (file.name.toLowerCase().endsWith('.pdf')) {
          const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
          const pdfData = await pdfParse(buffer);
          contentStr = pdfData.text;
        } else {
          // Assume text based fallback for txt etc.
          contentStr = buffer.toString('utf-8');
        }
      }
    } else {
      const body = await req.json();
      type = body.type;
      payload = body.payload;
      
      if (type === 'text') {
        contentStr = payload;
      } else if (type === 'url') {
        const res = await fetch(payload);
        const html = await res.text();
        const $ = cheerio.load(html);
        
        // Remove unnecessary tags
        $('script, style, noscript, nav, footer, header').remove();
        contentStr = $('body').text().replace(/\s+/g, ' ').trim();
      }
    }

    if (!contentStr.trim()) {
      return NextResponse.json({ success: false, error: 'Could not extract content' });
    }

    // Save to Knowledge Base
    const kbPath = path.join(process.cwd(), 'data', 'kb.json');
    let kb = [];
    try {
      const fileData = await fs.readFile(kbPath, 'utf-8');
      kb = JSON.parse(fileData);
    } catch (err) {}

    const newItem = {
      id: Date.now().toString(),
      type,
      source: payload,
      // limit chunk size slightly to avoid huge payloads to Gemini, though Gemini 1.5 flash has 1M context.
      content: contentStr.substring(0, 30000), 
      addedAt: new Date().toISOString()
    };

    kb.push(newItem);
    await fs.writeFile(kbPath, JSON.stringify(kb, null, 2), 'utf-8');

    return NextResponse.json({ success: true, item: newItem });
  } catch (error: any) {
    console.error("KB API Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
