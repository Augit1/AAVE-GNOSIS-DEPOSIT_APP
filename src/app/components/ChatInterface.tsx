import React, { useState, useRef, useEffect, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { useAccount } from 'wagmi';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  error?: boolean;
}

interface ChatInterfaceProps {
  // Remove theme prop since it's not used
}

interface ComponentProps {
  children: ReactNode;
}

interface LinkProps extends ComponentProps {
  href?: string;
}

const components: Components = {
  p: ({ children }: ComponentProps) => <p className="my-1">{children}</p>,
  strong: ({ children }: ComponentProps) => <strong className="font-bold">{children}</strong>,
  em: ({ children }: ComponentProps) => <em className="italic">{children}</em>,
  code: ({ children }: ComponentProps) => <code className="bg-black/20 rounded px-1">{children}</code>,
  pre: ({ children }: ComponentProps) => <pre className="bg-black/20 rounded p-2 my-2 overflow-x-auto">{children}</pre>,
  ul: ({ children }: ComponentProps) => <ul className="list-disc list-inside my-2">{children}</ul>,
  ol: ({ children }: ComponentProps) => <ol className="list-decimal list-inside my-2">{children}</ol>,
  li: ({ children }: ComponentProps) => <li className="ml-4">{children}</li>,
  blockquote: ({ children }: ComponentProps) => <blockquote className="border-l-4 border-white/30 pl-4 my-2">{children}</blockquote>,
  a: ({ href, children }: LinkProps) => <a href={href} className="text-blue-300 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
};

const GNOSIS_BLOCKSCOUT_API = 'https://gnosis.blockscout.com/api';

const ChatInterface: React.FC<ChatInterfaceProps> = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [holdings, setHoldings] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();

  // Fetch Gnosis Chain token balances
  useEffect(() => {
    const fetchHoldings = async () => {
      if (!address) {
        setHoldings('No wallet connected.');
        return;
      }
      try {
        const res = await fetch(
          `${GNOSIS_BLOCKSCOUT_API}?module=account&action=tokenlist&address=${address}`
        );
        const data = await res.json();
        if (data?.result && Array.isArray(data.result)) {
          const tokens = data.result
            .filter((t: any) => Number(t.balance) > 0)
            .map((t: any) => `${Number(t.balance) / 10 ** Number(t.decimals)} ${t.symbol}`)
            .join(', ');
          setHoldings(tokens.length > 0 ? tokens : 'No tokens found.');
        } else {
          setHoldings('No tokens found.');
        }
      } catch (e) {
        setHoldings('Error fetching holdings.');
      }
    };
    fetchHoldings();
  }, [address]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getSystemPrompt = () => `
You are a DeFi investment adviser AI for the Gnosis Chain. Your job is to help users optimize their DeFi portfolio by recommending yield strategies from a curated, secure, and up-to-date list of Gnosis Chain opportunities (lending, liquidity pools, staking, vaults, etc).

Strictly follow these rules:
- Only recommend strategies, pools, or tokens that are on the Gnosis Chain and present in the curated list.
- Never suggest or mention opportunities outside the Gnosis Chain or outside the curated list.
- If a user asks about a strategy, token, or protocol not in the curated list, politely inform them you can only discuss strategies from the approved list.
- Never request or suggest users share private keys, seed phrases, or sensitive information.

Wallet Connection Awareness:
- You can access the user's wallet content when connected: ${isConnected ? 'Wallet is connected' : 'No wallet connected'}.
- If no wallet is connected, first ask the user to connect their wallet to the website before proceeding with any analysis or recommendations.
- Once the wallet is connected, you can analyze their holdings and provide personalized advice.

Personalize your advice:
- Always analyze the user's current Gnosis Chain wallet holdings: ${holdings}.
- Ask for the user's risk tolerance (low, medium, high) if not specified, and tailor your advice accordingly.
- If the user has not set a risk profile, prompt them to do so before making recommendations.

For each recommendation, provide:
- The protocol/strategy name (from the curated list)
- The expected yield/APY (if available)
- The risk level and a brief explanation of the risks
- Any requirements (e.g., minimum deposit, lockup period)
- A short rationale for why this fits the user's holdings and risk profile

If the user's wallet is empty or not suitable for any strategy, explain this and suggest what they could do to get started.

Keep answers concise, clear, and actionable. If the user asks about general DeFi concepts, explain them in the context of Gnosis Chain and the curated strategies only. If the user asks about something outside your scope, politely decline and remind them of your focus.

Never give financial, legal, or tax advice. Always include a disclaimer that users should do their own research and consult professionals if needed. Never encourage risky or reckless behavior.

Remember: You are a helpful, precise, and secure DeFi adviser for Gnosis Chain only.
`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Always prepend the system message for context
      const systemMessage: Message = { role: 'system', content: getSystemPrompt() };
      const chatMessages = [systemMessage, ...messages, userMessage];
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      if (!data.message) {
        throw new Error('Invalid response format');
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.',
        error: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div
      className="flex flex-col min-h-[40px] max-h-[600px] transition-all duration-300 ease-in-out"
      ref={containerRef}
    >
      <div
        className={`flex-1 overflow-y-auto transition-all duration-300 ${
          hasMessages ? 'mb-4 space-y-4 p-4' : 'h-0 p-0 m-0'
        }`}
        style={{
          minHeight: hasMessages ? '80px' : '0',
          maxHeight: hasMessages ? '100%' : '0',
        }}
      >
        {hasMessages &&
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg py-1.5 px-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500/90 text-white'
                    : message.error
                    ? 'bg-red-500/90 text-white'
                    : 'glass-card text-primary bg-opacity-50'
                }`}
              >
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={components}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        {isLoading && hasMessages && (
          <div className="flex justify-start">
            <div className="glass-card text-primary rounded-2xl p-4 bg-opacity-50">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 mt-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="input-focus flex-1 px-4 py-3 rounded-xl bg-opacity-50"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="submit-button px-6 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface; 