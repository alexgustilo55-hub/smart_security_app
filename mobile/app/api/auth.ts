export interface LoginResponse {
  success: boolean;
  message: string;
  user?: { user_id: number; username: string; role: string };
}

export const login = async (
  username: string,
  password: string
): Promise<LoginResponse> => {
  try {
    const response = await fetch('http://172.20.10.4:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    return {
      success: response.ok && data.success,
      message: data.message || (response.ok ? 'Login successful' : 'Invalid credentials'),
      user: data.user,
    };
  } catch (err) {
    console.error('Login network error:', err);
    return { success: false, message: 'Network error' };
  }
};
