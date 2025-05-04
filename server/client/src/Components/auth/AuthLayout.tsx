import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
}

export const AuthLayout = ({ children, title }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="w-full max-w-md p-8 bg-dark-900/95 backdrop-blur-sm rounded-2xl shadow-xl border border-dark-800">
        <h2 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-primary-400 to-primary-600 text-transparent bg-clip-text">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}; 