import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { LocationData } from '@/lib/types';
import { KARE_CAMPUS, LocationSource } from '@/lib/constants';
import { useGeolocation } from '@/hooks/useGeolocation';

interface LocationContextValue {
  location: LocationData;
  source: LocationSource;
  setManualLocation: (loc: LocationData) => void;
  resetLocation: () => void;
  error?: string;
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return ctx;
};

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Persist manual location in localStorage
  const [manualLocation, setManualLocationState] = useState<LocationData | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('manual_location');
      if (stored) {
        try {
          setManualLocationState(JSON.parse(stored) as LocationData);
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }, []);

  const { location, source, error, isLoading } = useGeolocation(manualLocation);

  const setManualLocation = useCallback((loc: LocationData) => {
    setManualLocationState(loc);
    if (typeof window !== 'undefined') {
      localStorage.setItem('manual_location', JSON.stringify(loc));
    }
  }, []);

  const resetLocation = useCallback(() => {
    setManualLocationState(undefined);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('manual_location');
    }
  }, []);

  const finalLocation = location ?? KARE_CAMPUS;
  const finalSource = source ?? 'CAMPUS';

  return (
    <LocationContext.Provider
      value={{
        location: finalLocation,
        source: finalSource,
        setManualLocation,
        resetLocation,
        error,
        isLoading,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};
