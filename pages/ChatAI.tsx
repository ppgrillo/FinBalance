import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../components/Icons';
import { geminiService } from '../services/geminiService';
import { ChatMessage } from '../types';

// --- Improved Markdown Renderer Component ---
const FormattedMessage: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];
  
  const processTable = () => {
    if (tableHeader.length > 0) {
        elements.push(
            <div key={`table-${elements.length}`} className="my-4 overflow-x-auto rounded-2xl border border-gray-100 shadow-md bg-white">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs tracking-wider">
                        <tr>
                            {tableHeader.map((th, i) => <th key={i} className="px-6 py-4">{th}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {tableRows.map((row, rI) => (
                            <tr key={rI} className="bg-white hover:bg-gray-50 transition-colors">
                                {row.map((cell, cI) => (
                                    <td key={cI} className="px-6 py-3 text-gray-600 font-medium">
                                        <span dangerouslySetInnerHTML={{__html: parseBold(cell)}} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
    inTable = false;
    tableRows = [];
    tableHeader = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Table detection logic
    if (trimmed.startsWith('|')) {
        const cells = trimmed.split('|').filter(c => c.trim() !== '').map(c => c.trim());
        // Check if it's a separator line (e.g., |---|---|)
        if (cells.some(c => c.includes('---'))) {
            return; // Skip separator
        }
        
        if (!inTable) {
            inTable = true;
            tableHeader = cells;
        } else {
            tableRows.push(cells);
        }
        return;
    } else if (inTable) {
        processTable();
    }

    // List detection
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = line.replace(/^[-*]\s+/, '');
        elements.push(
            <div key={index} className="flex items-start gap-2 mb-2 ml-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"></div>
                <span className="text-gray-700" dangerouslySetInnerHTML={{__html: parseBold(content)}} />
            </div>
        );
        return;
    }
    
    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
        const content = line.replace(/^\d+\.\s+/, '');
        const number = line.match(/^\d+\./)?.[0];
        elements.push(
            <div key={index} className="flex gap-3 mb-2 ml-1">
                <span className="font-bold text-primary text-sm mt-0.5">{number}</span>
                <span className="text-gray-700" dangerouslySetInnerHTML={{__html: parseBold(content)}} />
            </div>
        );
        return;
    }

    // Normal paragraph
    if (trimmed) {
        elements.push(
            <p key={index} className="mb-2 text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{__html: parseBold(line)}} />
        );
    } else if (line === '') {
        // Preserve some spacing but not too much
        elements.push(<div key={index} className="h-2"></div>);
    }
  });

  if (inTable) processTable();

  return <div>{elements}</div>;
};

// Helper to replace **bold** with <b>bold</b>
const parseBold = (text: string) => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<b class="text-gray-900 font-bold">$1</b>')
        .replace(/\$(.*?)/g, '<span class="font-mono text-green-600 font-bold">$$$1</span>'); // Highlight money loosely
};


export const ChatAI: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'Hola, soy FinBot. \n\nPuedo consultar tus gastos en tiempo real. Pregúntame:\n- **"Compara mis gastos de 2023 vs 2024"**\n- **"¿Cuánto gasté en Comida el mes pasado?"**', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    // Optimistically update UI
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsTyping(true);

    // Call Gemini with FULL HISTORY to enable memory context
    const responseText = await geminiService.chat(newHistory);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <div className="bg-white p-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-10 h-10 bg-secondary/30 rounded-full flex items-center justify-center text-primary">
          <Icons.Chat size={20} />
        </div>
        <div>
          <h1 className="font-bold text-lg">Asistente FinBalance</h1>
          <p className="text-xs text-textSecondary flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full block animate-pulse"></span> Conectado a DB en vivo
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-gray-50/50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[90%] md:max-w-[85%] p-5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-white rounded-br-none' 
                  : 'bg-white text-textPrimary rounded-bl-none border border-gray-100'
              }`}
            >
              {msg.role === 'user' ? (
                  <p className="font-medium text-base">{msg.text}</p>
              ) : (
                  <FormattedMessage text={msg.text} />
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-gray-100">
              <div className="flex gap-1.5 items-center">
                <span className="text-xs text-gray-400 font-medium mr-2">Consultando DB...</span>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all border border-gray-100 shadow-inner">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pregunta sobre años pasados, comparaciones..."
            className="flex-1 bg-transparent outline-none text-sm py-2 text-gray-700 font-medium"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="bg-primary text-white p-2 rounded-full hover:bg-purple-600 transition-colors disabled:opacity-50 shadow-md transform active:scale-95"
          >
            <Icons.ArrowUpRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};