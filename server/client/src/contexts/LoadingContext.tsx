/**
 * LoadingContext - Global context for managing background loading indicator
 * 
 * Provides a centralized way to show/hide the loading indicator across the app
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingState {
  isVisible: boolean;
  type?: 'skybox' | '3d-asset' | 'unified' | 'general';
  progress?: number;
  message?: string;
  stage?: string;
}

interface LoadingContextType {
  loadingState: LoadingState;
  showLoading: (state: Omit<LoadingState, 'isVisible'>) => void;
  hideLoading: () => void;
  updateProgress: (progress: number, message?: string, stage?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isVisible: false
  });

  const showLoading = (state: Omit<LoadingState, 'isVisible'>) => {
    setLoadingState({
      isVisible: true,
      ...state
    });
  };

  const hideLoading = () => {
    setLoadingState(prev => ({
      ...prev,
      isVisible: false
    }));
  };

  const updateProgress = (progress: number, message?: string, stage?: string) => {
    setLoadingState(prev => ({
      ...prev,
      progress,
      ...(message && { message }),
      ...(stage && { stage })
    }));
  };

  return (
    <LoadingContext.Provider
      value={{
        loadingState,
        showLoading,
        hideLoading,
        updateProgress
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

