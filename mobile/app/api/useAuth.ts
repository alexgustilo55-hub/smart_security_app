import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeRouter } from '../api/navigation';

export const useAuth = () => {
  const router = useSafeRouter();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const loggedIn = await AsyncStorage.getItem('isLoggedIn');
        if (loggedIn !== 'true') {
          router.replace('/login'); // redirect if not logged in
        } else {
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.log('Auth check error:', err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  return { loading, isLoggedIn };
};