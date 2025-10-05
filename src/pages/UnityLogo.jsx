import React from 'react';

export default function UnityLogo({ size = 32, className = "" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Hexagon outer shape */}
      <path 
        d="M50 5 L85 25 L85 65 L50 85 L15 65 L15 25 Z" 
        stroke="currentColor" 
        strokeWidth="3" 
        fill="none"
      />
      
      {/* Inner cube structure */}
      {/* Top face */}
      <path 
        d="M50 25 L65 35 L50 45 L35 35 Z" 
        fill="currentColor"
        opacity="0.8"
      />
      
      {/* Left face */}
      <path 
        d="M35 35 L35 55 L50 65 L50 45 Z" 
        fill="currentColor"
        opacity="0.6"
      />
      
      {/* Right face */}
      <path 
        d="M50 45 L50 65 L65 55 L65 35 Z" 
        fill="currentColor"
        opacity="0.9"
      />
      
      {/* Center lines */}
      <line x1="50" y1="25" x2="50" y2="45" stroke="currentColor" strokeWidth="2"/>
      <line x1="35" y1="35" x2="50" y2="45" stroke="currentColor" strokeWidth="2"/>
      <line x1="65" y1="35" x2="50" y2="45" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}
