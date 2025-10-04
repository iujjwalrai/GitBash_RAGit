import React from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import { FiArrowRight } from 'react-icons/fi';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00111c] to-[#002137] text-gray-100 font-sans antialiased">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-10 flex justify-between items-center p-6 bg-[#001523]/50 backdrop-blur-md border-b border-[#002e4e]/50">
        <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
          GitBash RAGit
        </div>
        <div className="flex items-center space-x-4">
          <button className="bg-transparent border border-[#0087e8] text-[#a2d8ff] py-2 px-6 rounded-lg hover:bg-[#0087e8]/20 transition-all duration-300 shadow-md">
            Login
          </button>
          <button className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white py-2 px-6 rounded-lg hover:from-blue-600 hover:to-cyan-500 transition-all duration-300 shadow-md">
            Signup
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center min-h-screen px-8 pt-24 text-center">
        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-6 tracking-tight">
          Welcome to GitBash RAGit
        </h1>
        <p className="text-xl text-cyan-100/80 max-w-3xl leading-relaxed mb-12">
          Your intelligent AI-powered companion for document analysis and interactive querying. Upload PDFs, docs, and audio files—ask questions and get precise, sourced answers in real-time.
        </p>
        
        {/* Navigation Button to Chat App */}
        <Link
          to="/chat"
          className="group flex items-center gap-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white py-4 px-8 rounded-lg text-lg font-semibold hover:from-blue-600 hover:to-cyan-500 transition-all duration-300 shadow-lg hover:shadow-cyan-500/30 transform hover:-translate-y-1"
        >
          Launch App
          <FiArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </main>
    </div>
  );
}