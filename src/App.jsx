import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ChatApp from './pages/ChatApp';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route for the new homepage */}
        <Route path="/" element={<HomePage />} />
        
        {/* Route for the chat application */}
        <Route path="/chat" element={<ChatApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;