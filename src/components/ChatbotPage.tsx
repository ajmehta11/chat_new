import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useTranscriber } from '../hooks/useTranscriber';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const ChatbotPage: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'system', content: 'You are a helpful assistant.' },
    ]);
    
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiKey, setApiKey] = useState<string>('');

    const { isRecording, startRecording, stopRecording, audioData } = useAudioRecorder();
    const transcriber = useTranscriber();

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to the bottom when messages update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load API key from localStorage if available
    useEffect(() => {
        const savedApiKey = localStorage.getItem('openai_api_key');
        if (savedApiKey) {
            setApiKey(savedApiKey);
        }
    }, []);

    // Handle transcription when audioData is available
    useEffect(() => {
        if (audioData) {
            handleTranscription(audioData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioData]);

    const handleTranscription = async (audioBuffer: AudioBuffer) => {
        setIsLoading(true);
        try {
            // Use the start method from useTranscriber
            const result = await transcriber.start(audioBuffer);
            const transcribedText = result.text;
            setInputText(transcribedText);
            handleSend(transcribedText);
        } catch (error) {
            console.error('Transcription error:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Error: Unable to transcribe audio.',
            };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (messageText?: string) => {
        const text = messageText || inputText;
        if (!text.trim()) return;

        if (!apiKey) {
            alert('Please enter your OpenAI API key first.');
            return;
        }

        const newMessage: Message = { role: 'user', content: text };
        const updatedMessages = [...messages, newMessage];
        setMessages(updatedMessages);
        setInputText('');
        setIsLoading(true);
        
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: "gpt-4o-mini",
                    messages: updatedMessages,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                }
            );
            const assistantResponse = response.data.choices[0].message.content;
            const assistantMessage: Message = {
                role: 'assistant',
                content: assistantResponse,
            };
            setMessages((prevMessages) => [...prevMessages, assistantMessage]);
        } catch (error) {
            console.error('Error communicating with OpenAI:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Error: Unable to get a response from OpenAI API.',
            };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRecordButtonClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newApiKey = e.target.value;
        setApiKey(newApiKey);
        localStorage.setItem('openai_api_key', newApiKey);
    };

    return (
        <div className='flex flex-col h-screen'>
            {/* API Key Input */}
            <div className='p-4 bg-gray-100'>
                <input
                    type='password'
                    className='w-full border border-gray-300 rounded px-3 py-2'
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    placeholder='Enter your OpenAI API key'
                />
            </div>
            
            {/* Chat Messages */}
            <div className='flex-1 overflow-auto p-4'>
                {messages.slice(1).map((msg, index) => (
                <div
                    key={index}
                    className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                    } mb-2`}
                >
                    <div
                    className={`rounded-lg p-2 max-w-xs ${
                        msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-black'
                    }`}
                    >
                    {msg.content}
                    </div>
                </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className='p-4 bg-white flex items-center'>
                <input
                    type='text'
                    className='flex-1 border border-gray-300 rounded px-3 py-2 mr-2'
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isLoading || isRecording || transcriber.isBusy}
                    placeholder={
                        transcriber.isModelLoading
                        ? 'Loading model...'
                        : transcriber.isBusy
                        ? 'Transcribing...'
                        : 'Type your message'
                    }
                />

                {/* Record Button */}
                <button
                    onClick={handleRecordButtonClick}
                    disabled={isLoading || transcriber.isModelLoading || transcriber.isBusy}
                    className={`mr-2 p-2 rounded-full text-white ${
                        isRecording ? 'bg-red-500' : 'bg-green-500'
                    }`}
                >
                    {isRecording ? 'End' : 'Record'}
                </button>

                <button
                    onClick={() => handleSend()}
                    disabled={
                        isLoading || !inputText.trim() || isRecording || transcriber.isBusy
                    }
                    className='px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50'
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default ChatbotPage;