import { useRouter } from 'expo-router';

export const useSafeRouter = () => {
  const router = useRouter();

  const push = (path: string) => {
    // @ts-ignore
    router?.push(path);
  };

  const replace = (path: string) => {
    // @ts-ignore
    router?.replace(path);
  };

  return { push, replace };
};
