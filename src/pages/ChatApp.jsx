import React, { useState, useEffect, useRef } from 'react';

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
    fetchFiles();
  }, []);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/files');
      const data = await res.json();
      setUploadedFiles(data.files || []);
    } catch (e) {
      console.error("Could not fetch files", e);
    }
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;
    
    const formData = new FormData();
    const tempFiles = [];
    
    for (const file of files) {
      formData.append('files', file);
      tempFiles.push({ name: file.name, uploading: true });
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
        setUploadedFiles(prev => 
          prev.filter(file => !tempFiles.find(tf => tf.name === file.name))
        );
        alert(`Error uploading file: ${data.error}`);
      }
    } catch (error) {
      setUploadedFiles(prev => 
        prev.filter(file => !tempFiles.find(tf => tf.name === file.name))
      );
      alert(`Network error: ${error.message}`);
    }
    
    if (fileUploadInputRef.current) {
      fileUploadInputRef.current.value = '';
    }
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const askQuestion = async () => {
    const question = questionInput.trim();
    if (!question) return;
    
    setMessages(prev => [...prev, { sender: 'user', content: question }]);
    setQuestionInput('');
    
    const thinkingMessage = { sender: 'system', content: 'Thinking...', isStreaming: true };
    setMessages(prev => [...prev, thinkingMessage]);
    const messageIndex = messages.length + 1;
    
    try {
      const response = await fetch(`${BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      
      if (!response.body) {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[messageIndex] = { sender: 'system', content: 'Streaming not supported!' };
          return newMessages;
        });
        return;
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedContent = '';
      let sources = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const jsonMatch = buffer.match(/\{[\s\S]*\}$/);
        
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.type === "sources") {
              sources = parsed.content;
              buffer = buffer.replace(jsonMatch[0], "");
            }
          } catch (e) {
            // incomplete JSON
          }
        }
        
        const cleaned = buffer.replace(/```html/g, "").replace(/```/g, "").trim();
        if (cleaned) {
          streamedContent = cleaned;
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[messageIndex] = { 
              sender: 'system', 
              content: streamedContent,
              sources: sources,
              isStreaming: true 
            };
            return newMessages;
          });
        }
      }
      
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[messageIndex] = { 
          sender: 'system', 
          content: streamedContent,
          sources: sources,
          isStreaming: false 
        };
        return newMessages;
      });
      
    } catch (error) {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[messageIndex] = { sender: 'system', content: `Error: ${error.message}` };
        return newMessages;
      });
    }
  };

  const handleVoiceButton = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.addEventListener("dataavailable", e => {
          audioChunksRef.current.push(e.data);
        });
        
        mediaRecorder.addEventListener("stop", async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.wav');
          
          const res = await fetch(`${BASE}/transcribe`, { method: 'POST', body: formData });
          const data = await res.json();
          
          if (res.ok) {
            setQuestionInput(data.transcription);
          } else {
            alert(`Error: ${data.error}`);
          }
          
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
        });
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        alert(`Error accessing microphone: ${error.message}`);
      }
    }
  };

  const handleClearSession = async () => {
    await fetch('/clear-session', { method: 'POST' });
    window.location.reload();
  };

  const getFileIcon = (filename) => {
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith('.pdf')) {
      return { icon: 'picture_as_pdf', color: 'text-red-500' };
    } else if (lowerFilename.endsWith('.docx')) {
      return { icon: 'description', color: 'text-blue-500' };
    } else if (['.mp3', '.wav', '.m4a'].some(ext => lowerFilename.endsWith(ext))) {
      return { icon: 'audiotrack', color: 'text-orange-500' };
    }
    return { icon: 'article', color: 'text-gray-500' };
  };

  const handleSourceClick = (src) => {
    console.log(src)
    if (src.type === 'pdf') {
      window.open(`../model/temp/${src.source_filename}#page=${src.page_num}`, '_blank');
    } else if (src.type === 'docx' || src.type === 'text') {
      setModalTitle(`Source from: ${src.source_filename}`);
      if (src.source_content && typeof src.source_content === 'string') {
        setModalContent(src.source_content.replace(/\n/g, '<br>'));
      } else {
        setModalContent('<p class="text-gray-500"><em>No text content could be retrieved for this source.</em></p>');
      }
      setModalVisible(true);
    } else if (src.type === 'audio') {
      setAudioPlayerVisible(true);
      const currentSrc = audioPlayerRef.current?.currentSrc.split('/').pop();
      if (decodeURIComponent(currentSrc || '') !== src.source_filename) {
        setAudioSrc(`../model/temp/${src.source_filename}`);
      }
      setTimeout(() => {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.currentTime = src.start_time;
          audioPlayerRef.current.play();
        }
      }, 100);
    }
  };

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      
      <style>{`
        .material-icons {
          font-family: 'Material Icons';
          font-weight: normal;
          font-style: normal;
          font-size: 24px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
          -webkit-font-smoothing: antialiased;
        }
        
        .file-card {
          display: flex;
          align-items: center;
          padding: 0.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          gap: 0.5rem;
          transition: background 0.3s, transform 0.3s, opacity 0.3s;
        }
        
        .file-card:hover {
          background-color: rgba(0, 0, 0, 0.05);
          transform: translateY(-2px);
        }
        
        .file-uploading {
          position: relative;
          opacity: 0.7;
        }
        
        .file-uploading::after {
          content: '';
          position: absolute;
          right: 0.5rem;
          width: 1rem;
          height: 1rem;
          border: 2px solid #4f46e5;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <aside className="w-72 bg-surface-light dark:bg-surface-dark flex flex-col p-4 border-r border-border-light dark:border-border-dark">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Chat</h1>
        </div>
      
        <nav className="flex-grow">
          <div id="uploaded-files-display" className="mb-4">
            <h2 className="text-xs text-subtext-light dark:text-subtext-dark uppercase font-bold mb-2">
              Uploaded Files
            </h2>
            <ul id="uploaded-files-list">
              {uploadedFiles.map((file, index) => {
                const { icon, color } = getFileIcon(typeof file === 'string' ? file : file.name);
                const filename = typeof file === 'string' ? file : file.name;
                const uploading = typeof file === 'object' && file.uploading;
                
                return (
                  <li
                    key={index}
                    data-filename={filename}
                    className={`file-card ${uploading ? 'file-uploading' : ''}`}
                  >
                    <span className={`material-icons ${color}`}>{icon}</span>
                    <span className="font-medium flex-1 truncate" title={filename}>
                      {filename}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
        <header className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
          <h2 className="text-lg font-semibold">Multimodal RAG</h2>
        </header>

        <div id="chat-messages" ref={chatMessagesRef} className="flex-1 overflow-y-auto p-6">
          {messages.map((message, index) => (
            <div key={index}>
              {message.sender === 'user' ? (
                <div className="mb-4 flex flex-col items-end">
                  <div className="bg-black text-white p-3 rounded-lg max-w-[80%]">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div className="max-w-[80%] self-start bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark px-4 py-2 rounded-2xl shadow-sm prose dark:prose-invert prose-sm mb-4 flex flex-col">
                  {message.sources && message.sources.some(src => src.type === 'image') && (
                    <div>
                      {message.sources.filter(src => src.type === 'image').map((src, idx) => (
                        <div key={idx}>
                          <hr />
                          <img
                            src={`../model/temp/${src.image_path}`}
                            alt={src.image_path}
                            className="my-2 max-w-full h-auto rounded-lg border border-border-light dark:border-border-dark object-contain"
                            style={{ maxHeight: '300px' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="message-text" dangerouslySetInnerHTML={{ __html: message.content }} />
                  {message.sources && message.sources.length > 0 && (
                    <div className="flex justify-end gap-2 mt-2 flex-wrap">
                      {message.sources.map((src, idx) => {
                        if (src.type === 'pdf') {
                          return (
                            <a
                              key={idx}
                              href={`..model/temp/${src.source_filename}#page=${src.page_num}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-gray-200 rounded-md text-gray-600 text-xs no-underline hover:bg-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-icons text-sm">picture_as_pdf</span>
                              PDF p.{src.page_num}
                            </a>
                          );
                        } else if (src.type === 'docx' || src.type === 'text') {
                          return (
                            <a
                              key={idx}
                              href="javascript:void(0)"
                              onClick={() => handleSourceClick(src)}
                              className="px-2 py-1 bg-gray-200 rounded-md text-gray-600 text-xs no-underline hover:bg-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-icons text-sm">description</span>
                              DOCX #{src.page_num}
                            </a>
                          );
                        } else if (src.type === 'audio') {
                          return (
                            <a
                              key={idx}
                              href="javascript:void(0)"
                              onClick={() => handleSourceClick(src)}
                              title={src.source_filename}
                              className="px-2 py-1 bg-gray-200 rounded-md text-gray-600 text-xs no-underline hover:bg-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-icons text-sm">audiotrack</span>
                              {formatTime(src.start_time)} - {formatTime(src.end_time)}
                            </a>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {audioPlayerVisible && (
          <div id="audio-player-container" className="p-6 pt-0 relative">
            <audio
              id="audio-player"
              ref={audioPlayerRef}
              controls
              className="w-full"
              src={audioSrc}
            />
            <button
              id="audio-close-button"
              onClick={() => {
                setAudioPlayerVisible(false);
                if (audioPlayerRef.current) {
                  audioPlayerRef.current.pause();
                }
              }}
              className="absolute top-0 right-4 bg-gray-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-lg hover:bg-gray-800 transition-colors"
            >
              &times;
            </button>
          </div>
        )}

        <div className="p-6 pt-2">
          <div className="max-w-4xl mx-auto">
            <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-lg border border-border-light dark:border-border-dark">
              <input
                className="w-full bg-transparent border-0 focus:ring-0 text-text-light dark:text-text-dark placeholder-subtext-light dark:placeholder-subtext-dark mb-3 outline-none"
                placeholder="Ask me anything..."
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    askQuestion();
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <div></div>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    id="file-upload"
                    ref={fileUploadInputRef}
                    accept=".pdf,.docx,.mp3,.wav,.m4a"
                    className="hidden"
                    multiple
                    onChange={handleFileUpload}
                  />
                  <button
                    id="attach-button"
                    onClick={() => fileUploadInputRef.current?.click()}
                    className="flex items-center py-2 px-3 rounded-lg border border-border-light dark:border-border-dark"
                  >
                    <span className="material-icons text-sm mr-1">attach_file</span> Attach
                  </button>
                  <button
                    id="voice-button"
                    onClick={handleVoiceButton}
                    className={`flex items-center py-2 px-3 rounded-lg border border-border-light dark:border-border-dark ${
                      isRecording ? 'bg-red-500 text-white' : ''
                    }`}
                  >
                    <span className="material-icons text-sm mr-1">
                      {isRecording ? 'stop' : 'mic'}
                    </span>
                    {isRecording ? 'Stop' : 'Voice'}
                  </button>
                  <button
                    id="send-button"
                    onClick={askQuestion}
                    className="bg-gray-800 dark:bg-gray-900 text-white py-2 px-3 rounded-lg flex items-center"
                  >
                    <span className="material-icons text-sm mr-1">send</span> Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {modalVisible && (
        <div
          id="docx-modal"
          className="fixed inset-0 bg-white bg-opacity-60 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target.id === 'docx-modal') {
              setModalVisible(false);
            }
          }}
        >
          <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-border-light dark:border-border-dark">
              <h2 id="modal-title" className="text-lg font-bold text-text-light dark:text-text-dark">
                {modalTitle}
              </h2>
              <button
                id="modal-close-button"
                onClick={() => setModalVisible(false)}
                className="text-subtext-light dark:text-subtext-dark hover:text-text-light dark:hover:text-text-dark text-3xl leading-none"
              >
                &times;
              </button>
            </div>
            <div
              id="modal-content"
              className="prose dark:prose-invert p-4 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: modalContent }}
            />
          </div>
        </div>
      )}
    </div>
  );
}