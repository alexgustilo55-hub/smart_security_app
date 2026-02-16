export interface LoginResponse {
  success: boolean;
  message: string;
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await fetch('http://10.25.197.196:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) return { success: false, message: 'Server error' };

    return response.json(); 
  } catch {
    return { success: false, message: 'Network error' };
  }
};
