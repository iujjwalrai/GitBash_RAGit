import React from 'react';
import { useNavigate } from 'react-router-dom';
import UnityLogo from './UnityLogo';

export default function HomePage() {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/login');
  };

  const promptExamples = [
    "Summarize this document in 3 key points",
    "Extract all dates and names from my files",
    "What are the main themes in this content?",
    "Create a timeline from the uploaded documents",
    "Compare the information across multiple files",
    "Generate a report from my audio transcription"
  ];

  return (
    <div className="min-h-screen bg-[#212121] text-white flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="w-full px-8 py-4 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <UnityLogo size={32} className="text-white" />
          <span className="text-xl font-semibold">VaultAI</span>
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#about" className="hover:text-gray-300 transition-colors">About</a>
            <a href="#features" className="hover:text-gray-300 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-300 transition-colors">Pricing</a>
            <a href="#download" className="hover:text-gray-300 transition-colors">Download</a>
          </nav>
          
          <button
            onClick={handleLogin}
            className="px-5 py-2 bg-white text-black font-medium rounded-full text-sm
                       hover:bg-gray-200 transition-all duration-200"
          >
            Try VaultAI
          </button>
        </div>
      </nav>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Small Label */}
        <div className="mb-6">
          <span className="text-sm text-gray-400">VaultAI</span>
        </div>

        {/* Main Heading */}
        <div className="text-center max-w-5xl mb-8">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-normal mb-6 leading-tight tracking-tight">
            Get answers. Find inspiration. Be more productive.
          </h1>
          <p className="text-lg md:text-xl text-gray-400 leading-relaxed max-w-3xl mx-auto">
            Now with advanced AI, the smartest, fastest, and most useful document analysis tool, 
            with intelligent querying built in. Available for everyone.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-4 mb-16">
          <button
            onClick={() => navigate('/chat')}
            className="px-6 py-3 bg-white text-black font-medium rounded-full text-base
                       hover:bg-gray-200 transition-all duration-200 flex items-center gap-2"
          >
            Start now
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          <button
            className="px-6 py-3 text-white font-medium rounded-full text-base
                       hover:text-gray-300 transition-colors flex items-center gap-2"
          >
            Learn more
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>

        {/* Prompt Examples Grid */}
        <div className="w-full max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {promptExamples.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => navigate('/chat')}
                className="bg-[#2f2f2f] hover:bg-[#3a3a3a] text-left p-4 rounded-2xl 
                           transition-all duration-200 border border-transparent hover:border-zinc-700
                           group"
              >
                <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  {prompt}
                </p>
                <svg 
                  className="w-4 h-4 mt-2 text-gray-500 group-hover:text-gray-300 transition-colors" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full px-8 py-6 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <p>© 2025 VaultAI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-gray-300 transition-colors">Privacy</a>
            <a href="#terms" className="hover:text-gray-300 transition-colors">Terms</a>
            <a href="#contact" className="hover:text-gray-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
