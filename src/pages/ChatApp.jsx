import React, { useState, useEffect, useRef } from 'react';
import { FiPaperclip, FiMic, FiSend, FiX, FiFile } from 'react-icons/fi';
import { FaFilePdf, FaFileWord, FaMusic } from "react-icons/fa";

export default function ChatApp() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioPlayerVisible, setAudioPlayerVisible] = useState(false);
  const [audioSrc, setAudioSrc] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');

  const fileUploadInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);

  const BASE = "http://localhost:5000";


  useEffect(() => {
    // Auto-scroll to the latest message
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    const formData = new FormData();
    const tempFiles = Array.from(files).map(file => ({ name: file.name, uploading: true }));

    for (const file of files) {
      formData.append('files', file);
    }

    setUploadedFiles(prev => [...prev, ...tempFiles]);

    try {
      const response = await fetch(`${BASE}/upload`, { method: 'POST', body: formData });
      const data = await response.json();

      if (response.ok) {
        setUploadedFiles(prev =>
          prev.map(file =>
            data.filenames.includes(file.name)
              ? { ...file, uploading: false }
              : file
          )
        );
      } else {
        throw new Error(data.error || 'File upload failed');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
      setUploadedFiles(prev => prev.filter(f => !tempFiles.some(tf => tf.name === f.name)));
    } finally {
      if (fileUploadInputRef.current) {
        fileUploadInputRef.current.value = '';
      }
    }
  };
  
  const handleRemoveFile = async (filename) => {
    try {
      const response = await fetch(`${BASE}/delete/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (response.ok) {
        setUploadedFiles(prev => prev.filter(f => f.name !== filename));
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const formatTime = (totalSeconds = 0) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const askQuestion = async () => {
    const question = questionInput.trim();
    if (!question) return;

    setMessages(prev => [...prev, { sender: 'user', content: question }]);
    setQuestionInput('');

    const thinkingMessageIndex = messages.length + 1;
    setMessages(prev => [...prev, { sender: 'system', content: 'Thinking...', isStreaming: true }]);

    try {
      const response = await fetch(`${BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!response.body) throw new Error('Streaming response not available.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedContent = '';
      let sources = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Check for a complete JSON object for sources at the end of the buffer
        const jsonMatch = buffer.match(/(\{.*\})\s*$/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.type === "sources") {
                    sources = parsed.content;
                    // Remove the parsed JSON from the buffer
                    buffer = buffer.substring(0, jsonMatch.index);
                }
            } catch (e) { /* Incomplete JSON, continue buffering */ }
        }

        streamedContent = buffer.replace(/```html|```/g, "").trim();
        
        setMessages(prev => {
            const newMessages = [...prev];
            newMessages[thinkingMessageIndex] = {
                sender: 'system',
                content: streamedContent,
                sources: sources,
                isStreaming: true,
            };
            return newMessages;
        });
      }
      
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[thinkingMessageIndex] = {
            sender: 'system',
            content: streamedContent || "<p>I couldn't find an answer in the documents.</p>",
            sources: sources,
            isStreaming: false,
        };
        return newMessages;
    });

    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[thinkingMessageIndex] = { sender: 'system', content: `<p class="text-red-400">Error: ${error.message}</p>` };
        return newMessages;
      });
    }
  };

  const handleVoiceButton = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
        
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.wav');

          try {
            const res = await fetch(`${BASE}/transcribe`, { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
              setQuestionInput(prev => prev + data.transcription);
            } else {
              throw new Error(data.error || 'Transcription failed');
            }
          } catch (err) {
            alert(`Error: ${err.message}`);
          }
          stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
      } catch (error) {
        alert(`Microphone access error: ${error.message}`);
      }
    }
  };

  const handleClearSession = async () => {
    await fetch(`${BASE}/clear-session`, { method: 'POST' });
    window.location.reload();
  };

  const getFileIcon = (filename) => {
    if (filename.endsWith('.pdf')) return <FaFilePdf className="text-blue-300" />;
    if (filename.endsWith('.docx')) return <FaFileWord className="text-blue-300" />;
    if (['.mp3', '.wav', '.m4a'].some(ext => filename.endsWith(ext))) return <FaMusic className="text-blue-300" />;
    return <FiFile className="text-blue-300" />;
  };

  const handleSourceClick = (src) => {
    if (src.type === 'pdf') {
      window.open(`${BASE}/temp/${src.source_filename}#page=${src.page_num}`, '_blank');
    } else if (src.type === 'audio') {
      setAudioSrc(`${BASE}/temp/${src.source_filename}`);
      setAudioPlayerVisible(true);
      setTimeout(() => {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.currentTime = src.start_time;
          audioPlayerRef.current.play();
        }
      }, 100);
    } else {
      setModalTitle(`Source: ${src.source_filename} (Chunk ${src.page_num})`);
      setModalContent(src.source_content?.replace(/\n/g, '<br>') || '<p>No text content available for this source.</p>');
      setModalVisible(true);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#00111c] to-[#002137] text-gray-100 font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-80 flex flex-col p-6 bg-[#001523]/80 backdrop-blur-md border-r border-[#002e4e]/50 shadow-lg">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">GitBash RAGit</h1>
        </div>
        <div className="flex-grow flex flex-col min-h-0">
          <h2 className="text-base font-semibold text-cyan-200 mb-4 tracking-wide">Uploaded Documents</h2>
          <div className="flex-grow overflow-y-auto pr-3 -mr-3 space-y-3">
            {uploadedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-cyan-400/60">
                <FiFile size={48} className="mb-3 opacity-50" />
                <p className="text-sm font-medium">No files uploaded yet.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {uploadedFiles.map((file, index) => (
                  <li key={index} className="flex items-center gap-4 p-3 rounded-xl bg-[#002137]/50 backdrop-blur-sm hover:bg-[#002e4e]/50 transition-all duration-300 shadow-md">
                    <span className="text-xl">{getFileIcon(file.name)}</span>
                    <span className="font-medium text-sm truncate text-cyan-100" title={file.name}>
                      {file.name}
                    </span>
                    {file.uploading ? (
                      <span className="ml-auto text-xs text-cyan-300 animate-pulse">Uploading...</span>
                    ) : (
                      <button onClick={() => handleRemoveFile(file.name)} className="ml-auto text-cyan-300/70 hover:text-red-400 transition-colors duration-300">
                        <FiX size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="pt-6 mt-6 border-t border-[#002e4e]/50">
          <button onClick={handleClearSession} className="w-full py-3 px-5 rounded-xl bg-red-600/20 text-red-300 hover:bg-red-600/30 transition-all duration-300 text-sm font-semibold shadow-inner">
            Clear Session
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div ref={chatMessagesRef} className="flex-1 overflow-y-auto p-8 space-y-6 bg-gradient-to-b from-transparent to-[#001523]/20">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} group`}>
              <div className={`max-w-3xl p-5 rounded-2xl shadow-md transition-all duration-300 ${
                message.sender === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-br-none'
                  : 'bg-[#002137]/80 backdrop-blur-md text-cyan-100 rounded-bl-none'
              } ${message.isStreaming ? 'animate-pulse opacity-80' : ''}`}>
                <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: message.content }} />
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.sources.map((src, srcIndex) => (
                      <button key={srcIndex} onClick={() => handleSourceClick(src)} className="px-3 py-1 text-xs bg-cyan-900/30 rounded-full hover:bg-cyan-900/50 transition-colors text-cyan-200">
                        {src.source_filename} {src.type === 'pdf' ? `(Page ${src.page_num})` : src.type === 'audio' ? `(${formatTime(src.start_time)})` : `(Chunk ${src.page_num})`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {audioPlayerVisible && (
          <div className="p-8 pt-0 relative">
            <audio ref={audioPlayerRef} controls className="w-full rounded-lg shadow-lg" src={audioSrc} />
            <button onClick={() => { setAudioPlayerVisible(false); audioPlayerRef.current?.pause(); }} className="absolute -top-3 right-6 bg-red-500/80 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-all duration-300 shadow-md">
              <FiX size={18} />
            </button>
          </div>
        )}

        <div className="p-8 pt-4 pb-12 bg-[#001523]/50 backdrop-blur-md">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <textarea
                className="w-full bg-[#002137]/80 border border-[#002e4e] rounded-2xl text-cyan-100 placeholder-cyan-400/50 pl-28 pr-32 py-4 resize-none outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all duration-300 shadow-inner"
                placeholder="Ask anything or describe what to find..."
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
                rows={1}
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                <input type="file" ref={fileUploadInputRef} accept=".pdf,.docx,.mp3,.wav,.m4a" className="hidden" multiple onChange={handleFileUpload} />
                <button onClick={() => fileUploadInputRef.current?.click()} className="p-2 text-cyan-300/70 hover:text-cyan-300 transition-colors duration-300">
                  <FiPaperclip size={22} />
                </button>
                <button onClick={handleVoiceButton} className={`p-2 transition-colors duration-300 ${isRecording ? 'text-red-400 animate-pulse' : 'text-cyan-300/70 hover:text-cyan-300'}`}>
                  <FiMic size={22} />
                </button>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <button onClick={askQuestion} className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white py-2.5 px-6 rounded-lg flex items-center gap-2 hover:from-blue-600 hover:to-cyan-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md" disabled={!questionInput.trim()}>
                  <span className="font-medium">Send</span>
                  <FiSend size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {modalVisible && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-6 z-50" onClick={() => setModalVisible(false)}>
          <div className="bg-[#001a2c]/90 border border-[#002e4e]/50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-[#002e4e]/50 bg-[#002137]/50">
              <h2 className="text-xl font-bold text-cyan-100">{modalTitle}</h2>
              <button onClick={() => setModalVisible(false)} className="text-cyan-300/70 hover:text-cyan-300 transition-colors duration-300">
                <FiX size={26} />
              </button>
            </div>
            <div className="prose prose-invert p-6 overflow-y-auto text-cyan-100" dangerouslySetInnerHTML={{ __html: modalContent }} />
          </div>
        </div>
      )}

      {imageModalVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50"
          onClick={() => setImageModalVisible(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setImageModalVisible(false)}
              className="absolute top-2 right-2 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl hover:bg-gray-200 transition-colors z-10"
            >
              &times;
            </button>
            <img
              src={imageModalSrc}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}