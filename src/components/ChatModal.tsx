"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatModal.module.css';
import { Send, Phone } from 'lucide-react';

const ContactWidget = ({ onSubmit }: { onSubmit: (data: any) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+380');
  const [submitted, setSubmitted] = useState(false);

  // Phone mask logic (Ukrainian format: +380XXXXXXXXX)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('+380')) val = '+380';
    // Only allow digits after +380
    val = '+380' + val.slice(4).replace(/[^\d]/g, '').slice(0, 9);
    setPhone(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOpen) {
      if (phone.length === 13) {
        onSubmit({ name, phone });
        setSubmitted(true);
      }
    }
  };

  if (submitted) {
    return (
      <div className={styles.ctaContainer}>
         <div className={styles.ctaText}>Дякую! Вашу заявку надіслано.</div>
      </div>
    );
  }

  return (
    <div className={styles.ctaContainer}>
      <div className={styles.ctaActions}>
        <a href="tel:+380800338008" className={styles.phoneLink}>
          <Phone size={16} /> +380 800 338 008
        </a>
        <form onSubmit={handleSubmit} className={styles.interactiveForm}>
          <div className={`${styles.expandableFields} ${isOpen ? styles.open : ''}`}>
             <input 
               type="text" 
               placeholder="Ваше ім'я" 
               value={name} 
               onChange={e => setName(e.target.value)} 
               required={isOpen} 
               className={styles.inputField} 
               onFocus={(e) => e.target.placeholder = ''} 
               onBlur={(e) => e.target.placeholder = "Ваше ім'я"} 
             />
             <input 
               type="tel" 
               value={phone} 
               onChange={handlePhoneChange} 
               required={isOpen} 
               pattern="^\+380[0-9]{9}$" 
               className={styles.inputField} 
             />
          </div>
          <button 
             type={isOpen ? "submit" : "button"} 
             className={styles.leadButton} 
             onClick={(e) => { 
                if (!isOpen) { 
                  e.preventDefault(); 
                  setIsOpen(true); 
                } 
             }}
          >
            Залишити заявку
          </button>
        </form>
      </div>
    </div>
  );
};

export default function ChatModal() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: 'Вас турбує гострий дискомфорт зараз, чи ви плануєте плановий огляд і консультацію гастроентеролога?' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '+380' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lastMessageRef = useRef<HTMLDivElement>(null);

  const scrollToLastMessage = (forceBottom = false) => {
    if (forceBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      scrollToLastMessage(true);
    } else {
      scrollToLastMessage(false);
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      
      if (data.metadata) {
        setFormData(prev => ({ ...prev, ...data.metadata }));
      }
    } catch (error) {
      console.error("Error communicating with AI:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Вибачте, сталася помилка з\'єднання. Спробуйте ще раз.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleWidgetSubmit = async (data: any) => {
    // 1. Internal API Lead
    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, ...data, chatLog: messages })
      });
    } catch(err) {
      console.error("Internal API error:", err);
    }

    // 2. Netlify Forms submission
    try {
      const body = new URLSearchParams();
      body.append("form-name", "chat-leads");
      body.append("name", data.name || "");
      body.append("phone", data.phone || "");

      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch (err) {
      console.error("Netlify Form error:", err);
    }
  };

  // Improved parser for invisible table (price list)
  const renderMessageContent = (content: string) => {
    const safeContent = content || "";
    const lines = safeContent.split('\n');
    let inTable = false;
    
    const rendered = lines.map((line, idx) => {
      if (line.includes('|')) {
        const parts = line.split('|').filter(p => p.trim() !== '');
        if (parts.length >= 2 && !line.includes('---')) {
           return (
             <div key={idx} className={styles.priceRow}>
               <div className={styles.serviceName}>{parts[0].trim()}</div>
               <div className={styles.servicePrice}>{parts[1].trim()}</div>
             </div>
           );
        }
        return null; // skip headers/separators
      }
      return <p key={idx}>{line}</p>;
    });

    return <div className={styles.textContent}>{rendered}</div>;
  };

  return (
    <div className={styles.modalContainer}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.onlineIndicator}></div>
          <div>
            <h3>Координатор Салютем</h3>
            <p>Медичний центр</p>
          </div>
        </div>
      </div>
      
      <div className={styles.messagesContainer} ref={containerRef}>
        {messages.map((msg, idx) => (
           <React.Fragment key={idx}>
            <div 
              className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.userWrapper : styles.assistantWrapper}`}
              ref={idx === messages.length - 1 ? lastMessageRef : null}
            >
              <div className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}>
                {renderMessageContent(msg.content)}
              </div>
            </div>
            {msg.role === 'assistant' && idx > 0 && (
              <div className={`${styles.messageWrapper} ${styles.assistantWrapper} ${styles.ctaWrapper}`}>
                <ContactWidget onSubmit={handleWidgetSubmit} />
              </div>
            )}
          </React.Fragment>
        ))}

        {isThinking && (
          <div className={`${styles.messageWrapper} ${styles.assistantWrapper}`}>
            <div className={`${styles.messageBubble} ${styles.assistantMessage} ${styles.thinkingBubble}`}>
              <div className={styles.dotPulse}></div>
              <div className={styles.dotPulse}></div>
              <div className={styles.dotPulse}></div>
            </div>
          </div>
        )}



        <div ref={messagesEndRef} />
      </div>

      {/* Hidden form for Netlify detection */}
      <form name="chat-leads" data-netlify="true" hidden>
        <input type="text" name="name" required />
        <input type="tel" name="phone" required />
      </form>

      <div className={styles.inputArea}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Напишіть відповідь..."
          className={styles.textInput}
        />
        <button onClick={handleSend} className={styles.sendButton} disabled={!input.trim()}>
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
