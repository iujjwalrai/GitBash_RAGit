import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  const handleLogin = () => {
    // Add your login navigation logic here
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col px-6">
      {/* Top Navigation Bar */}
      <nav className="w-full py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="black">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">GitBash RAGit</span>
        </div>

        <button
          onClick={handleLogin}
          className="px-6 py-2.5 bg-white text-black font-semibold rounded-lg
                     hover:bg-gray-200 transition-all duration-200"
        >
          Login
        </button>
      </nav>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Logo/Brand */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="black">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">GitBash RAGit</h1>
        </div>

        {/* Main Heading */}
        <div className="text-center max-w-4xl mb-12">
          <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Welcome to GitBash RAGit
          </h2>
          <p className="text-xl text-gray-400 leading-relaxed">
            Your intelligent AI-powered companion for document analysis and interactive querying. 
            Upload PDFs, docs, and audio files—ask questions and get precise, sourced answers in real-time.
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => navigate('/chat')}
          className="group relative px-8 py-4 bg-white text-black font-semibold text-lg rounded-xl 
                     hover:bg-gray-200 transition-all duration-300 ease-in-out
                     shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <span className="relative z-10">Launch App</span>
        </button>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
          <FeatureCard 
            title="Multi-Format Support"
            description="Upload PDFs, Word documents, and audio files seamlessly"
          />
          <FeatureCard 
            title="Real-Time Answers"
            description="Get instant responses with source citations from your documents"
          />
          <FeatureCard 
            title="Voice Recording"
            description="Ask questions using voice input with automatic transcription"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}
