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
  const [inputValue, setInputValue] = useState(value || "");
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    console.log('🗺️ [AddressAutocomplete] Initializing component');
    
    // Check if Google Maps script is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      console.log('✅ [AddressAutocomplete] Google Maps already loaded');
      setIsScriptLoaded(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('⏳ [AddressAutocomplete] Google Maps script already in DOM, waiting...');
      setIsScriptLoading(true);
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          console.log('✅ [AddressAutocomplete] Google Maps loaded successfully');
          setIsScriptLoaded(true);
          setIsScriptLoading(false);
          clearInterval(checkInterval);
        }
      }, 100);
      
      setTimeout(() => {
        if (!window.google || !window.google.maps || !window.google.maps.places) {
          console.error('❌ [AddressAutocomplete] Google Maps load timeout');
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
        console.log('🔑 [AddressAutocomplete] Fetching API key...');
        const response = await base44.functions.invoke('getGoogleMapsKey', {});
        const apiKey = response.data?.apiKey;
        
        if (!apiKey) {
          console.error('❌ [AddressAutocomplete] No API key received');
          setError('Google Maps API key not configured');
          setIsScriptLoading(false);
          return;
        }
        
        console.log('🔑 [AddressAutocomplete] API key retrieved (length:', apiKey?.length, ')');
        
        // Validate API key format (should be 39 characters)
        if (apiKey.length < 30) {
          console.error('❌ [AddressAutocomplete] API key seems invalid (too short)');
          setError('Invalid Google Maps API key');
          setIsScriptLoading(false);
          return;
        }
        
        console.log('📦 [AddressAutocomplete] Loading Google Maps script...');
        
        // Define global callback before adding script
        window.initGoogleMaps = () => {
          console.log('✅ [AddressAutocomplete] Google Maps initialized via callback');
          setIsScriptLoaded(true);
          setIsScriptLoading(false);
        };
        
        // Listen for Google Maps errors (must be set before script loads)
        window.gm_authFailure = () => {
          console.error('❌ [Google Maps] Authentication failed!');
          console.error('Common causes:');
          console.error('1. Invalid API key');
          console.error('2. Maps JavaScript API not enabled');
          console.error('3. Places API not enabled');
          console.error('4. Billing not enabled on Google Cloud project');
          console.error('5. HTTP referrer restrictions blocking this domain');
          console.error('6. API restrictions preventing these APIs');
          setError('Google Maps authentication failed - check console for details');
          setIsScriptLoading(false);
        };
        
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
        script.async = true;
        script.defer = true;
        
        script.onerror = (e) => {
          console.error('❌ [AddressAutocomplete] Script load error:', e);
          setError('Failed to load Google Maps');
          setIsScriptLoading(false);
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('❌ [AddressAutocomplete] Error loading script:', error);
        setError('Could not load address autocomplete');
        setIsScriptLoading(false);
      }
    };

    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (!isScriptLoaded || !inputRef.current) return;

    try {
      console.log('🚀 [AddressAutocomplete] Initializing Autocomplete widget...');
      
      // Create autocomplete widget
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'au' },
        fields: ['formatted_address', 'address_components', 'geometry', 'place_id']
      });
      
      autocompleteRef.current = autocomplete;
      
      // Listen for place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place || !place.formatted_address) {
          console.warn('⚠️ [AddressAutocomplete] No place details received');
          return;
        }
        
        console.log('📍 [AddressAutocomplete] Place selected:', place.formatted_address);
        
        // Parse address components
        const components = {};
        if (place.address_components) {
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
        }

        // Build street address
        const street = [components.street_number, components.route].filter(Boolean).join(' ');

        // Get coordinates
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();

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

        console.log('✅ [AddressAutocomplete] Address data:', addressData);
        setInputValue(place.formatted_address);
        onChange(addressData);
      });
      
      console.log('✅ [AddressAutocomplete] Autocomplete widget initialized');
    } catch (err) {
      console.error('❌ [AddressAutocomplete] Error initializing widget:', err);
      setError('Failed to initialize autocomplete');
    }
  }, [isScriptLoaded, onChange]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // If cleared, reset address data
    if (!newValue.trim()) {
      onChange({
        address_full: "",
        address_street: "",
        address_suburb: "",
        address_state: "",
        address_postcode: "",
        address_country: "Australia",
        google_place_id: "",
        latitude: null,
        longitude: null
      });
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        required={required}
        className={className}
        disabled={disabled || isScriptLoading}
      />
      {isScriptLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-[12px] text-amber-600 mt-1">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}