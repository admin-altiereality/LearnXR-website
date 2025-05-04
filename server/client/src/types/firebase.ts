export interface User {
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Skybox {
  id: string;
  userId: string;
  imageUrl: string;
  promptUsed: string;
  styleId: number;
  metadata: {
    theme?: string;
    location?: string;
    resolution?: string;
    style?: string;
  };
  createdAt: string;
  title?: string;
  status: 'pending' | 'complete' | 'failed';
} 