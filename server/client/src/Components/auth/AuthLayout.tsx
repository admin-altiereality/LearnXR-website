import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
}

export const AuthLayout = ({ children, title }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card/95 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}; 