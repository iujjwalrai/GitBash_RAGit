import React, { useState, useEffect, useRef } from 'react';
import { FiPaperclip, FiMic, FiSend, FiX, FiFile, FiMenu, FiChevronLeft } from 'react-icons/fi';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const fileUploadInputRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);

  const BASE = "http://localhost:5000";

  useEffect(() => {
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
      const response = await fetch(`${BASE}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (response.ok) {
        setUploadedFiles(prev => 
          prev.map(file => 
            data.filenames.includes(file.name) ? { ...file, uploading: false } : file
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
      const response = await fetch(`${BASE}/delete/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setUploadedFiles(prev => prev.filter(f => f.name !== filename));
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
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

        const jsonMatch = buffer.match(/(\{.*\})\s*$/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.type === "sources") {
              sources = parsed.content;
              buffer = buffer.substring(0, jsonMatch.index);
            }
          } catch (e) {
            /* Incomplete JSON */
          }
        }

        streamedContent = buffer.replace(/``````/g, "").trim();

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
          content: streamedContent || "I couldn't find an answer in the documents.",
          sources: sources,
          isStreaming: false,
        };
        return newMessages;
      });
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[thinkingMessageIndex] = {
          sender: 'system',
          content: `Error: ${error.message}`
        };
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
            const res = await fetch(`${BASE}/transcribe`, {
              method: 'POST',
              body: formData
            });
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
    if (filename.endsWith('.pdf')) return <FaFilePdf className="text-red-400" />;
    if (filename.endsWith('.docx') || filename.endsWith('.doc')) return <FaFileWord className="text-blue-400" />;
    if (filename.endsWith('.mp3') || filename.endsWith('.wav')) return <FaMusic className="text-purple-400" />;
    return <FiFile className="text-gray-400" />;
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Sidebar */}
      <div 
        className={`${sidebarOpen ? 'w-64' : 'w-0'} 
                    transition-all duration-300 ease-in-out
                    bg-zinc-950 border-r border-zinc-800 flex flex-col overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold whitespace-nowrap">Uploaded Files</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Files List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {uploadedFiles.length === 0 ? (
            <p className="text-sm text-gray-500 text-center mt-8">No files uploaded yet</p>
          ) : (
            uploadedFiles.map((file, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg 
                           border border-zinc-800 hover:border-zinc-700 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-xl flex-shrink-0">{getFileIcon(file.name)}</div>
                  <span className="text-sm truncate">{file.name}</span>
                </div>
                {!file.uploading && (
                  <button
                    onClick={() => handleRemoveFile(file.name)}
                    className="p-1 hover:bg-zinc-800 rounded opacity-0 group-hover:opacity-100 
                               transition-all flex-shrink-0"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-800 space-y-2">
          <button
            onClick={() => fileUploadInputRef.current?.click()}
            className="w-full px-4 py-2 bg-white text-black rounded-lg font-medium
                       hover:bg-gray-200 transition-colors"
          >
            Upload Files
          </button>
          <button
            onClick={handleClearSession}
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg
                       hover:bg-zinc-800 transition-colors text-sm"
          >
            Clear Session
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-16 border-b border-zinc-800 flex items-center px-6 gap-4">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-zinc-900 rounded-lg transition-colors"
            >
              <FiMenu className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="black">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold">GitBash RAGit</h1>
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          ref={chatMessagesRef}
          className="flex-1 overflow-y-auto px-6 py-8 space-y-6"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <h2 className="text-2xl font-bold mb-4">What do you want to know?</h2>
                <p className="text-gray-400">Upload documents and start asking questions</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div 
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-3xl px-6 py-4 rounded-2xl ${
                    msg.sender === 'user' 
                      ? 'bg-white text-black ml-12' 
                      : 'bg-zinc-900 border border-zinc-800 mr-12'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <p className="text-xs text-gray-500 mb-2">Sources:</p>
                      <div className="space-y-1">
                        {msg.sources.map((source, i) => (
                          <p key={i} className="text-xs text-gray-400">{source}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-800 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-2">
              <button
                onClick={() => fileUploadInputRef.current?.click()}
                className="p-3 hover:bg-zinc-800 rounded-xl transition-colors flex-shrink-0"
              >
                <FiPaperclip className="w-5 h-5" />
              </button>

              <textarea
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    askQuestion();
                  }
                }}
                placeholder="Ask anything..."
                className="flex-1 bg-transparent border-none outline-none resize-none 
                           text-white placeholder-gray-500 py-3 px-2 max-h-32"
                rows="1"
              />

              <button
                onClick={handleVoiceButton}
                className={`p-3 rounded-xl transition-colors flex-shrink-0 ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'hover:bg-zinc-800'
                }`}
              >
                <FiMic className="w-5 h-5" />
              </button>

              <button
                onClick={askQuestion}
                disabled={!questionInput.trim()}
                className="p-3 bg-white text-black rounded-xl hover:bg-gray-200 
                           disabled:opacity-50 disabled:cursor-not-allowed 
                           transition-colors flex-shrink-0"
              >
                <FiSend className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileUploadInputRef}
        onChange={handleFileUpload}
        multiple
        accept=".pdf,.doc,.docx,.mp3,.wav"
        className="hidden"
      />

      {/* Modal (keeping your existing modal code) */}
      {modalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{modalTitle}</h3>
              <button
                onClick={() => setModalVisible(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
              <p className="whitespace-pre-wrap">{modalContent}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
