import React, { useState, useEffect, useRef } from 'react';
import { FiPaperclip, FiMic, FiSend, FiX, FiFile, FiMenu, FiChevronLeft, FiEdit3, FiPlus } from 'react-icons/fi';
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
  const [pastChats, setPastChats] = useState([
    { id: 1, title: "Document Analysis Session", date: "Today" },
    { id: 2, title: "PDF Summary Request", date: "Yesterday" },
    { id: 3, title: "Audio Transcription Query", date: "Oct 3" }
  ]);
  
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

  const handleNewChat = () => {
    setMessages([]);
    setQuestionInput('');
  };

  const getFileIcon = (filename) => {
    if (filename.endsWith('.pdf')) return <FaFilePdf className="text-red-400" />;
    if (filename.endsWith('.docx') || filename.endsWith('.doc')) return <FaFileWord className="text-blue-400" />;
    if (filename.endsWith('.mp3') || filename.endsWith('.wav')) return <FaMusic className="text-purple-400" />;
    return <FiFile className="text-gray-400" />;
  };

  return (
    <div className="flex h-screen bg-[#212121] text-white overflow-hidden">
      {/* Sidebar */}
      <div 
        className={`${sidebarOpen ? 'w-64' : 'w-0'} 
                    transition-all duration-300 ease-in-out
                    bg-[#171717] flex flex-col overflow-hidden`}
      >
        {/* Sidebar Header - New Chat Button */}
        <div className="p-3 border-b border-zinc-800">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                       bg-transparent border border-zinc-700 hover:bg-zinc-800
                       transition-colors text-sm font-medium"
          >
            <FiEdit3 className="w-4 h-4" />
            <span>New chat</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Uploaded Files Section */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 mb-2 px-2">UPLOADED FILES</h3>
            <div className="space-y-1">
              {uploadedFiles.length === 0 ? (
                <p className="text-xs text-gray-600 px-2 py-2">No files uploaded</p>
              ) : (
                uploadedFiles.map((file, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between px-2 py-2 rounded-lg
                               hover:bg-zinc-800 transition-colors group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="text-base flex-shrink-0">{getFileIcon(file.name)}</div>
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    {!file.uploading && (
                      <button
                        onClick={() => handleRemoveFile(file.name)}
                        className="p-1 hover:bg-zinc-700 rounded opacity-0 group-hover:opacity-100 
                                   transition-all flex-shrink-0"
                      >
                        <FiX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Past Chats Section */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 mb-2 px-2">PAST CHATS</h3>
            <div className="space-y-1">
              {pastChats.map((chat) => (
                <button
                  key={chat.id}
                  className="w-full flex items-start gap-3 px-2 py-2 rounded-lg
                             hover:bg-zinc-800 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-gray-200 group-hover:text-white">
                      {chat.title}
                    </p>
                    <p className="text-xs text-gray-500">{chat.date}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-800 space-y-2">
          <button
            onClick={handleClearSession}
            className="w-full px-3 py-2 rounded-lg text-sm
                       hover:bg-zinc-800 transition-colors text-left"
          >
            Clear session
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-14 border-b border-zinc-800 flex items-center px-4 gap-3">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <FiMenu className="w-5 h-5" />
            </button>
          )}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">GitBash RAGit</span>
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          ref={chatMessagesRef}
          className="flex-1 overflow-y-auto"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full px-6">
              <div className="text-center max-w-2xl">
                <div className="mb-6 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-10 h-10" fill="black">
                      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-3xl font-normal mb-4 text-gray-100">What can I help with?</h2>
                <p className="text-gray-400">Upload documents and start asking questions</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
              {messages.map((msg, idx) => (
                <div 
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] ${
                      msg.sender === 'user' 
                        ? 'bg-[#2f2f2f] px-4 py-3 rounded-3xl' 
                        : ''
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{msg.content}</p>
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
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 pb-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 bg-[#2f2f2f] rounded-3xl px-4 py-2 shadow-lg">
              <button
                onClick={() => fileUploadInputRef.current?.click()}
                className="p-2 hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
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
                placeholder="Message GitBash RAGit"
                className="flex-1 bg-transparent border-none outline-none resize-none 
                           text-white placeholder-gray-500 py-3 px-2 max-h-32 text-[15px]"
                rows="1"
                style={{ minHeight: '24px' }}
              />

              <button
                onClick={handleVoiceButton}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'hover:bg-zinc-700'
                }`}
              >
                <FiMic className="w-5 h-5" />
              </button>

              <button
                onClick={askQuestion}
                disabled={!questionInput.trim()}
                className="p-2 bg-white text-black rounded-lg hover:bg-gray-200 
                           disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white
                           transition-colors flex-shrink-0"
              >
                <FiSend className="w-5 h-5" />
              </button>
            </div>
            <p className="text-center text-xs text-gray-500 mt-3">
              GitBash RAGit can make mistakes. Check important info.
            </p>
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

      {/* Modal */}
      {modalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2f2f2f] rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{modalTitle}</h3>
              <button
                onClick={() => setModalVisible(false)}
                className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
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
