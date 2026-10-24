import { useEffect, useState, useCallback } from 'react';

export interface RouteState {
  path: string;
  navigate: (to: string) => void;
}

function getHashPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

export function useHashRoute(): RouteState {
  const [path, setPath] = useState<string>(getHashPath);

  useEffect(() => {
    const onHashChange = () => setPath(getHashPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((to: string) => {
    const target = to.startsWith('/') ? to : `/${to}`;
    if (window.location.hash !== `#${target}`) {
      window.location.hash = target;
    } else {
      setPath(target);
    }
  }, []);

  return { path, navigate };
}
