import { useState, useEffect, useRef } from 'react';
import { LocationData } from '@/lib/types';
import { KARE_CAMPUS, LocationSource } from '@/lib/constants';

/**
 * useGeolocation – watches the user's GPS position with high accuracy.
 * Returns the latest location, its source, loading state and any error.
 * Falls back to a provided manual location and ultimately to the KARE campus.
 */
export function useGeolocation(manualLocation?: LocationData) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [source, setSource] = useState<LocationSource>('DEFAULT');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      // No geolocation support – use manual or campus fallback.
      if (manualLocation) {
        setLocation(manualLocation);
        setSource('MANUAL');
      } else {
        setLocation(KARE_CAMPUS);
        setSource('CAMPUS');
      }
      setIsLoading(false);
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setLocation({
        name: 'Current Location',
        locality: `±${Math.round(accuracy)}m`,
        latitude,
        longitude,
        country: ''
      });
      setSource('GPS');
      setError(undefined);
      setIsLoading(false);
    };

    const onError = (err: GeolocationPositionError) => {
      let msg = '';
      switch (err.code) {
        case err.PERMISSION_DENIED:
          msg = 'Location permission denied.';
          break;
        case err.POSITION_UNAVAILABLE:
          msg = 'Location information unavailable.';
          break;
        case err.TIMEOUT:
          msg = 'Location request timed out.';
          break;
        default:
          msg = 'Unknown location error.';
      }
      setError(msg);
      // Fallback handling – use manual if provided, else campus.
      if (manualLocation) {
        setLocation(manualLocation);
        setSource('MANUAL');
      } else {
        setLocation(KARE_CAMPUS);
        setSource('CAMPUS');
      }
      setIsLoading(false);
    };

    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    });
    watchIdRef.current = watchId;
    setIsLoading(true);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [manualLocation]);

  return { location, source, error, isLoading };
}
