export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  username: string;
}

export interface RegisterDTO {
  email: string;
  username: string;
  password: string;
  avatarUrl?: string;
}

export interface LoginDTO {
  login: string; // email ou username
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    avatarUrl?: string | null;
  };
  token: string;
}
