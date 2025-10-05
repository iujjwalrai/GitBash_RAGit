import React, { useState, useEffect, useRef } from "react";

export default function ChatApp() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [questionInput, setQuestionInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioPlayerVisible, setAudioPlayerVisible] = useState(false);
  const [audioSrc, setAudioSrc] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState("");
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [imageModalSrc, setImageModalSrc] = useState("");

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
      const res = await fetch("/files");
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
      formData.append("files", file);
      tempFiles.push({ name: file.name, uploading: true });
    }

    setUploadedFiles((prev) => [...prev, ...tempFiles]);

    try {
      const response = await fetch(`${BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (response.ok) {
        setUploadedFiles((prev) =>
          prev.map((file) =>
            data.filenames.includes(file.name)
              ? { ...file, uploading: false }
              : file
          )
        );
      } else {
        setUploadedFiles((prev) =>
          prev.filter((file) => !tempFiles.find((tf) => tf.name === file.name))
        );
        alert(`Error uploading file: ${data.error}`);
      }
    } catch (error) {
      setUploadedFiles((prev) =>
        prev.filter((file) => !tempFiles.find((tf) => tf.name === file.name))
      );
      alert(`Network error: ${error.message}`);
    }

    if (fileUploadInputRef.current) {
      fileUploadInputRef.current.value = "";
    }
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  };

  const askQuestion = async () => {
    const question = questionInput.trim();
    if (!question) return;

    setMessages((prev) => [...prev, { sender: "user", content: question }]);
    setQuestionInput("");

    const thinkingMessage = {
      sender: "system",
      content: "Thinking...",
      isStreaming: true,
    };
    setMessages((prev) => [...prev, thinkingMessage]);
    const messageIndex = messages.length + 1;

    try {
      const response = await fetch(`${BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.body) {
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[messageIndex] = {
            sender: "system",
            content: "Streaming not supported!",
          };
          return newMessages;
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedContent = "";
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

        const cleaned = buffer
          .replace(/```html/g, "")
          .replace(/```/g, "")
          .trim();
        if (cleaned) {
          streamedContent = cleaned;
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[messageIndex] = {
              sender: "system",
              content: streamedContent,
              sources: sources,
              isStreaming: true,
            };
            return newMessages;
          });
        }
      }

      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[messageIndex] = {
          sender: "system",
          content: streamedContent,
          sources: sources,
          isStreaming: false,
        };
        return newMessages;
      });
    } catch (error) {
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[messageIndex] = {
          sender: "system",
          content: `Error: ${error.message}`,
        };
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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.addEventListener("dataavailable", (e) => {
          audioChunksRef.current.push(e.data);
        });

        mediaRecorder.addEventListener("stop", async () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/wav",
          });
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.wav");

          const res = await fetch(`${BASE}/transcribe`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();

          if (res.ok) {
            setQuestionInput(data.transcription);
          } else {
            alert(`Error: ${data.error}`);
          }

          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
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
    await fetch("/clear-session", { method: "POST" });
    window.location.reload();
  };

  const getFileIcon = (filename) => {
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith(".pdf")) {
      return { icon: "picture_as_pdf", color: "text-red-400" };
    } else if (lowerFilename.endsWith(".docx")) {
      return { icon: "description", color: "text-blue-400" };
    } else if (
      [".mp3", ".wav", ".m4a"].some((ext) => lowerFilename.endsWith(ext))
    ) {
      return { icon: "audiotrack", color: "text-orange-400" };
    } else if (
      [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].some((ext) =>
        lowerFilename.endsWith(ext)
      )
    ) {
      return { icon: "image", color: "text-green-400" };
    }
    return { icon: "article", color: "text-gray-400" };
  };

  const handleSourceClick = (src) => {
    console.log(src);
    if (src.type === "pdf") {
      window.open(
        `../model/temp/${src.source_filename}#page=${src.page_num}`,
        "_blank"
      );
    } else if (src.type === "docx" || src.type === "text") {
      setModalTitle(`Source from: ${src.source_filename}`);
      if (src.source_content && typeof src.source_content === "string") {
        setModalContent(src.source_content.replace(/\n/g, "<br>"));
      } else {
        setModalContent(
          '<p class="text-gray-500"><em>No text content could be retrieved for this source.</em></p>'
        );
      }
      setModalVisible(true);
    } else if (src.type === "audio") {
      setAudioPlayerVisible(true);
      const currentSrc = audioPlayerRef.current?.currentSrc.split("/").pop();
      if (decodeURIComponent(currentSrc || "") !== src.source_filename) {
        setAudioSrc(`../model/temp/${src.source_filename}`);
      }
      setTimeout(() => {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.currentTime = src.start_time;
          audioPlayerRef.current.play();
        }
      }, 100);
    } else if (src.type === "standalone_image" || src.type === "image") {
      setImageModalSrc(`../model/temp/${src.image_path}`);
      setImageModalVisible(true);
    }
  };

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-gray-100 font-sans">
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />

      <style>{`
        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .material-icons {
          font-family: 'Material Icons';
          font-weight: normal;
          font-style: normal;
          font-size: 20px;
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
          padding: 0.625rem 0.75rem;
          border-radius: 0.375rem;
          cursor: pointer;
          gap: 0.625rem;
          transition: background 0.2s;
          background: rgba(255, 255, 255, 0.03);
        }
        
        .file-card:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        
        .file-uploading {
          position: relative;
          opacity: 0.6;
        }
        
        .file-uploading::after {
          content: '';
          position: absolute;
          right: 0.75rem;
          width: 0.875rem;
          height: 0.875rem;
          border: 2px solid #6b7280;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .scrollbar-custom::-webkit-scrollbar {
          width: 6px;
        }

        .scrollbar-custom::-webkit-scrollbar-track {
          background: transparent;
        }

        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {/* Sidebar */}
      <aside className="w-64 bg-[#171717] flex flex-col border-r border-[#2a2a2a]">
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a2a]">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0f0f0f] hover:bg-[#1a1a1a] transition-colors text-sm font-medium">
            <span className="material-icons text-lg">edit</span>
            <span>New chat</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-custom">
          {/* Uploaded Files Section */}
          {uploadedFiles.length > 0 && (
            <div className="p-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                Uploaded Files
              </h2>
              <div className="space-y-1">
                {uploadedFiles.map((file, index) => {
                  const { icon, color } = getFileIcon(
                    typeof file === "string" ? file : file.name
                  );
                  const filename = typeof file === "string" ? file : file.name;
                  const uploading = typeof file === "object" && file.uploading;

                  return (
                    <div
                      key={index}
                      className={`file-card ${uploading ? "file-uploading" : ""}`}
                    >
                      <span className={`material-icons text-base ${color}`}>{icon}</span>
                      <span className="text-sm text-gray-300 flex-1 truncate" title={filename}>
                        {filename}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past Chats Section */}
          <div className="p-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
              Past Chats
            </h2>
            <div className="space-y-1">
              <div className="file-card">
                <span className="text-sm text-gray-300 flex-1">Document Analysis Session</span>
                <span className="text-xs text-gray-500">Today</span>
              </div>
              <div className="file-card">
                <span className="text-sm text-gray-300 flex-1">PDF Summary Request</span>
                <span className="text-xs text-gray-500">Yesterday</span>
              </div>
              <div className="file-card">
                <span className="text-sm text-gray-300 flex-1">Audio Transcription Query</span>
                <span className="text-xs text-gray-500">Oct 3</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="p-3 border-t border-[#2a2a2a]">
          <button 
            onClick={handleClearSession}
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            Clear session
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-[#0f0f0f]">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors">
              <span className="material-icons text-xl">arrow_back</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-gray-300 rounded" style={{clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"}}></div>
              </div>
              <span className="text-base font-semibold">VaultAI</span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div
          ref={chatMessagesRef}
          className="flex-1 overflow-y-auto scrollbar-custom"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center mb-6">
                <div className="w-10 h-10 border-3 border-gray-300 rounded-lg" style={{clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"}}></div>
              </div>
              <h1 className="text-3xl font-semibold mb-3">What can I help with?</h1>
              <p className="text-gray-500 text-sm">Upload documents and start asking questions</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-8">
              {messages.map((message, index) => (
                <div key={index} className="mb-6">
                  {message.sender === "user" ? (
                    <div className="flex justify-end">
                      <div className="bg-[#2a2a2a] text-gray-100 px-4 py-3 rounded-2xl max-w-[85%] text-sm">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                        <div className="w-5 h-5 border-2 border-gray-300 rounded" style={{clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"}}></div>
                      </div>
                      <div className="flex-1">
                        {message.sources &&
                          message.sources.some(
                            (src) =>
                              src.type === "image" || src.type === "standalone_image"
                          ) && (
                            <div className="mb-3">
                              {message.sources
                                .filter(
                                  (src) =>
                                    src.type === "image" ||
                                    src.type === "standalone_image"
                                )
                                .map((src, idx) => (
                                  <div key={idx} className="mb-2">
                                    <img
                                      src={`../model/temp/${src.image_path}`}
                                      alt={src.image_path}
                                      className="max-w-full h-auto rounded-lg border border-[#2a2a2a] object-contain cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{ maxHeight: "300px" }}
                                      onClick={() => {
                                        setImageModalSrc(
                                          `../model/temp/${src.image_path}`
                                        );
                                        setImageModalVisible(true);
                                      }}
                                    />
                                  </div>
                                ))}
                            </div>
                          )}
                        <div
                          className="text-sm text-gray-200 leading-relaxed prose prose-invert prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: message.content }}
                        />
                        {message.sources && message.sources.length > 0 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {message.sources.map((src, idx) => {
                              if (src.type === "pdf") {
                                return (
                                  <a
                                    key={idx}
                                    href={`../model/temp/${src.source_filename}#page=${src.page_num}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-md text-gray-400 text-xs no-underline transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="material-icons text-sm">picture_as_pdf</span>
                                    PDF p.{src.page_num}
                                  </a>
                                );
                              } else if (src.type === "docx" || src.type === "text") {
                                return (
                                  <a
                                    key={idx}
                                    href="javascript:void(0)"
                                    onClick={() => handleSourceClick(src)}
                                    className="px-2.5 py-1.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-md text-gray-400 text-xs no-underline transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="material-icons text-sm">description</span>
                                    DOCX #{src.page_num}
                                  </a>
                                );
                              } else if (src.type === "audio") {
                                return (
                                  <a
                                    key={idx}
                                    href="javascript:void(0)"
                                    onClick={() => handleSourceClick(src)}
                                    title={src.source_filename}
                                    className="px-2.5 py-1.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-md text-gray-400 text-xs no-underline transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="material-icons text-sm">audiotrack</span>
                                    {formatTime(src.start_time)} - {formatTime(src.end_time)}
                                  </a>
                                );
                              } else if (
                                src.type === "standalone_image" ||
                                src.type === "image"
                              ) {
                                return (
                                  <a
                                    key={idx}
                                    href="javascript:void(0)"
                                    onClick={() => handleSourceClick(src)}
                                    title={src.source_filename}
                                    className="px-2.5 py-1.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-md text-gray-400 text-xs no-underline transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="material-icons text-sm">image</span>
                                    {src.type === "standalone_image"
                                      ? "Image"
                                      : `p.${src.page_num}`}
                                  </a>
                                );
                              }
                              return null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audio Player */}
        {audioPlayerVisible && (
          <div className="px-6 pb-4 relative">
            <div className="max-w-3xl mx-auto">
              <audio
                ref={audioPlayerRef}
                controls
                className="w-full"
                src={audioSrc}
              />
              <button
                onClick={() => {
                  setAudioPlayerVisible(false);
                  if (audioPlayerRef.current) {
                    audioPlayerRef.current.pause();
                  }
                }}
                className="absolute top-0 right-6 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-lg transition-colors"
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 pb-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] overflow-hidden">
              <div className="flex items-center gap-2 p-3">
                <input
                  type="file"
                  ref={fileUploadInputRef}
                  accept=".pdf,.docx,.mp3,.wav,.m4a,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                  className="hidden"
                  multiple
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileUploadInputRef.current?.click()}
                  className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors flex-shrink-0"
                  title="Attach file"
                >
                  <span className="material-icons text-gray-400">attach_file</span>
                </button>
                <input
                  className="flex-1 bg-transparent border-0 focus:ring-0 text-gray-100 placeholder-gray-500 outline-none text-sm px-2"
                  placeholder="Message VaultAI"
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      askQuestion();
                    }
                  }}
                />
                <button
                  onClick={handleVoiceButton}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                    isRecording ? "bg-red-500 hover:bg-red-600" : "hover:bg-[#2a2a2a]"
                  }`}
                  title={isRecording ? "Stop recording" : "Voice input"}
                >
                  <span className={`material-icons ${isRecording ? "text-white" : "text-gray-400"}`}>
                    {isRecording ? "stop" : "mic"}
                  </span>
                </button>
                <button
                  onClick={askQuestion}
                  className="p-2 bg-white hover:bg-gray-200 text-black rounded-lg transition-colors flex-shrink-0"
                  title="Send message"
                >
                  <span className="material-icons">arrow_upward</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600 text-center mt-2">
              VaultAI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>

      {/* DOCX Modal */}
      {modalVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalVisible(false);
            }
          }}
        >
          <div className="bg-[#1a1a1a] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-[#2a2a2a]">
            <div className="flex justify-between items-center p-4 border-b border-[#2a2a2a]">
              <h2 className="text-lg font-semibold text-gray-100">
                {modalTitle}
              </h2>
              <button
                onClick={() => setModalVisible(false)}
                className="text-gray-400 hover:text-gray-200 text-2xl leading-none w-8 h-8 flex items-center justify-center hover:bg-[#2a2a2a] rounded-lg transition-colors"
              >
                &times;
              </button>
            </div>
            <div
              className="prose prose-invert prose-sm p-4 overflow-y-auto scrollbar-custom"
              dangerouslySetInnerHTML={{ __html: modalContent }}
            />
          </div>
        </div>
      )}

      {/* Image Modal */}
      {imageModalVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50"
          onClick={() => setImageModalVisible(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setImageModalVisible(false)}
              className="absolute -top-12 right-0 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Close
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