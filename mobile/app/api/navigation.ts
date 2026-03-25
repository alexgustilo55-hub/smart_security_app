import { useRouter } from 'expo-router';

export const useSafeRouter = () => {
  const router = useRouter();

  const push = (path: string) => {
    try {
      router.push(path as any);
    } catch (err) {
      console.log('Push navigation error:', err);
    }
  };

  const replace = (path: string) => {
    try {
      router.replace(path as any);
    } catch (err) {
      console.log('Replace navigation error:', err);
    }
  };

  return { push, replace };
};