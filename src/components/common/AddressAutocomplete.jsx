import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AddressAutocomplete({ 
  value, 
  onChange, 
  id,
  placeholder = "Start typing an address...",
  required = false,
  className = "",
  disabled = false
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if Google Maps script is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      console.log('Google Maps already loaded');
      setIsScriptLoaded(true);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      console.log('Google Maps script tag found, waiting for load...');
      setIsScriptLoading(true);
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          console.log('Google Maps loaded successfully');
          setIsScriptLoaded(true);
          setIsScriptLoading(false);
          clearInterval(checkInterval);
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!isScriptLoaded) {
          console.error('Google Maps script load timeout');
          setError('Address autocomplete timed out');
          setIsScriptLoading(false);
          clearInterval(checkInterval);
        }
      }, 10000);
      
      return () => clearInterval(checkInterval);
    }

    // Load Google Maps script
    const loadGoogleMapsScript = async () => {
      setIsScriptLoading(true);
      try {
        console.log('Fetching Google Maps API key...');
        const { data } = await base44.functions.invoke('getGoogleMapsKey');
        const apiKey = data.apiKey;
        
        if (!apiKey) {
          console.error('No Google Maps API key received');
          setError('Google Maps API key not configured');
          setIsScriptLoading(false);
          return;
        }
        
        console.log('Loading Google Maps script...');
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          console.log('Google Maps script loaded successfully');
          setIsScriptLoaded(true);
          setIsScriptLoading(false);
        };
        
        script.onerror = (e) => {
          console.error('Failed to load Google Maps script:', e);
          setError('Failed to load address autocomplete');
          setIsScriptLoading(false);
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setError('Could not load address autocomplete');
        setIsScriptLoading(false);
      }
    };

    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (!isScriptLoaded || !inputRef.current) {
      console.log('Not initializing autocomplete:', { isScriptLoaded, hasInputRef: !!inputRef.current });
      return;
    }

    try {
      console.log('Initializing Google Places Autocomplete...');
      
      // Destroy existing autocomplete if it exists
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }

      // Initialize autocomplete
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'au' },
        fields: ['formatted_address', 'address_components', 'place_id', 'geometry'],
        types: ['address']
      });

      console.log('Autocomplete initialized successfully');

      // Listen for place selection
      const listener = autocompleteRef.current.addListener('place_changed', () => {
        console.log('Place changed event fired');
        const place = autocompleteRef.current.getPlace();
        
        if (!place || !place.address_components) {
          console.log('No place selected or incomplete data, using free-form input');
          // Fallback: user typed but didn't select from dropdown
          onChange({
            address_full: inputRef.current.value,
            address_street: '',
            address_suburb: '',
            address_state: '',
            address_postcode: '',
            address_country: 'Australia',
            google_place_id: '',
            latitude: null,
            longitude: null
          });
          return;
        }

        console.log('Place selected:', place.formatted_address);

        // Parse address components
        const components = {};
        place.address_components.forEach(component => {
          const types = component.types;
          if (types.includes('street_number')) {
            components.street_number = component.long_name;
          }
          if (types.includes('route')) {
            components.route = component.long_name;
          }
          if (types.includes('locality')) {
            components.suburb = component.long_name;
          }
          if (types.includes('administrative_area_level_1')) {
            components.state = component.short_name;
          }
          if (types.includes('postal_code')) {
            components.postcode = component.long_name;
          }
          if (types.includes('country')) {
            components.country = component.long_name;
          }
        });

        // Build street address
        const street = [components.street_number, components.route].filter(Boolean).join(' ');

        // Get coordinates
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();

        // Return structured address data
        const addressData = {
          address_full: place.formatted_address,
          address_street: street,
          address_suburb: components.suburb || '',
          address_state: components.state || '',
          address_postcode: components.postcode || '',
          address_country: components.country || 'Australia',
          google_place_id: place.place_id || '',
          latitude: lat || null,
          longitude: lng || null
        };
        
        console.log('Address data:', addressData);
        onChange(addressData);
      });
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
      setError('Failed to initialize address autocomplete');
    }

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isScriptLoaded, onChange]);

  const handleInputChange = (e) => {
    // Allow free-form typing as fallback
    const textValue = e.target.value;
    onChange({
      address_full: textValue,
      address_street: '',
      address_suburb: '',
      address_state: '',
      address_postcode: '',
      address_country: 'Australia',
      google_place_id: '',
      latitude: null,
      longitude: null
    });
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          className={className}
          disabled={disabled}
        />
        {isScriptLoading && !error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertCircle className="w-4 h-4" />
          <span>{error} - you can type manually.</span>
        </div>
      )}
      {isScriptLoaded && !error && (
        <p className="text-xs text-green-600">✓ Address autocomplete ready</p>
      )}
    </div>
  );
}