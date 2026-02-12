export interface User {
  id: string;
  username: string;
  email: string | null;
  roles: string[];
  createdAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface PairingRequest {
  deviceId?: string;
}

export interface PairingResponse {
  id: string;
  pairingCode?: string;
  paired: boolean;
  name?: string;
}

export interface PairDeviceRequest {
  pairingCode: string;
  name?: string;
}
