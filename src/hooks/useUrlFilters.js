import { useState, useEffect, useCallback } from 'react';

export function useUrlFilters(initialFilters) {
  const [filters, setFiltersState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const state = { ...initialFilters };
    Object.keys(initialFilters).forEach((key) => {
      if (params.has(key)) {
        state[key] = params.get(key);
      }
    });
    return state;
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setFiltersState((prev) => {
        let hasChanges = false;
        const newState = { ...prev };
        Object.keys(initialFilters).forEach((key) => {
          const urlVal = params.has(key) ? params.get(key) : initialFilters[key];
          if (newState[key] !== urlVal) {
            newState[key] = urlVal;
            hasChanges = true;
          }
        });
        return hasChanges ? newState : prev;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilters = useCallback((update) => {
    setFiltersState((prev) => {
      const newFilters = typeof update === 'function' ? update(prev) : { ...prev, ...update };
      
      const url = new URL(window.location);
      let hasChanges = false;
      
      Object.keys(newFilters).forEach((key) => {
        if (newFilters[key] === initialFilters[key] || newFilters[key] === '') {
          if (url.searchParams.has(key)) {
            url.searchParams.delete(key);
            hasChanges = true;
          }
        } else {
          if (url.searchParams.get(key) !== newFilters[key]) {
            url.searchParams.set(key, newFilters[key]);
            hasChanges = true;
          }
        }
      });
      
      if (hasChanges) {
        window.history.pushState({}, '', url);
      }
      return newFilters;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [filters, setFilters];
}
