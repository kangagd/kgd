import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, MapPin } from "lucide-react";
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
  const [predictions, setPredictions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const dummyMapRef = useRef(null);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    console.log('[AddressAutocomplete] Initializing component');
    
    // Check if Google Maps script is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      console.log('[AddressAutocomplete] Google Maps already loaded');
      setIsScriptLoaded(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('[AddressAutocomplete] Google Maps script already in DOM, waiting...');
      setIsScriptLoading(true);
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          console.log('[AddressAutocomplete] Google Maps loaded successfully');
          setIsScriptLoaded(true);
          setIsScriptLoading(false);
          clearInterval(checkInterval);
        }
      }, 100);
      
      setTimeout(() => {
        if (!isScriptLoaded) {
          console.error('[AddressAutocomplete] Google Maps load timeout');
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
        console.log('[AddressAutocomplete] Fetching API key...');
        const response = await base44.functions.invoke('getGoogleMapsKey', {});
        const apiKey = response.data?.apiKey;
        
        if (!apiKey) {
          console.error('[AddressAutocomplete] No API key received');
          setError('Google Maps API key not configured');
          setIsScriptLoading(false);
          return;
        }
        
        console.log('[AddressAutocomplete] API key received, loading script...');
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          console.log('[AddressAutocomplete] Google Maps script loaded successfully');
          setIsScriptLoaded(true);
          setIsScriptLoading(false);
        };
        
        script.onerror = (e) => {
          console.error('[AddressAutocomplete] Script load error:', e);
          setError('Failed to load address autocomplete');
          setIsScriptLoading(false);
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('[AddressAutocomplete] Error loading script:', error);
        setError('Could not load address autocomplete');
        setIsScriptLoading(false);
      }
    };

    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (!isScriptLoaded) return;

    try {
      console.log('[AddressAutocomplete] Initializing Google Places services...');
      
      // Initialize services
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      
      // Create a hidden div for PlacesService (it requires a map or div element)
      if (!dummyMapRef.current) {
        dummyMapRef.current = document.createElement('div');
      }
      placesServiceRef.current = new window.google.maps.places.PlacesService(dummyMapRef.current);
      
      console.log('[AddressAutocomplete] Services initialized successfully');
    } catch (err) {
      console.error('[AddressAutocomplete] Error initializing services:', err);
      setError('Failed to initialize autocomplete');
    }
  }, [isScriptLoaded]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedIndex(-1);

    if (!newValue.trim()) {
      setPredictions([]);
      setShowDropdown(false);
      // Clear structured fields
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
      return;
    }

    if (!autocompleteServiceRef.current) {
      console.warn('[AddressAutocomplete] Service not initialized, using manual input');
      // Fallback to manual input
      onChange({
        address_full: newValue,
        address_street: "",
        address_suburb: "",
        address_state: "",
        address_postcode: "",
        address_country: "Australia",
        google_place_id: "",
        latitude: null,
        longitude: null
      });
      return;
    }

    setIsLoadingSuggestions(true);
    console.log('[AddressAutocomplete] Fetching predictions for:', newValue);

    // Fetch predictions
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: newValue,
        componentRestrictions: { country: 'au' },
        types: ['address']
      },
      (results, status) => {
        setIsLoadingSuggestions(false);
        console.log('[AddressAutocomplete] Prediction status:', status, 'Results:', results);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('[AddressAutocomplete] Found', results.length, 'predictions');
          setPredictions(results.slice(0, 7));
          setShowDropdown(true);
        } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.log('[AddressAutocomplete] No results found');
          setPredictions([]);
          setShowDropdown(false);
        } else {
          console.error('[AddressAutocomplete] Prediction error:', status);
          setPredictions([]);
          setShowDropdown(false);
        }
      }
    );
  };

  const handleSelectPrediction = (prediction) => {
    if (!placesServiceRef.current) {
      console.error('[AddressAutocomplete] Places service not initialized');
      return;
    }

    console.log('[AddressAutocomplete] Selected prediction:', prediction);
    setInputValue(prediction.description);
    setShowDropdown(false);
    setPredictions([]);

    // Get detailed place information
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'formatted_address', 'place_id', 'geometry']
      },
      (place, status) => {
        console.log('[AddressAutocomplete] Place details status:', status, 'Place:', place);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
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

          console.log('[AddressAutocomplete] Parsed address:', addressData);
          onChange(addressData);
        } else {
          console.error('[AddressAutocomplete] Failed to get place details:', status);
        }
      }
    );
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          handleSelectPrediction(predictions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setPredictions([]);
        setSelectedIndex(-1);
        break;
    }
  };

  const formatPrediction = (prediction) => {
    const terms = prediction.terms;
    if (!terms || terms.length === 0) {
      return { primary: prediction.description, secondary: '' };
    }

    // First term(s) are usually street number + street name
    const primary = terms.slice(0, Math.min(2, terms.length))
      .map(t => t.value)
      .join(' ');

    // Remaining terms are suburb, state, country
    const secondary = terms.slice(Math.min(2, terms.length))
      .map(t => t.value)
      .join(', ');

    return { primary, secondary };
  };

  return (
    <div className="relative space-y-2">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          required={required}
          className={className}
          disabled={disabled || isScriptLoading}
        />
        {isLoadingSuggestions && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-[#E5E7EB] max-h-[280px] overflow-y-auto"
          style={{ top: '100%', left: 0, right: 0 }}
        >
          {predictions.map((prediction, index) => {
            const { primary, secondary } = formatPrediction(prediction);
            return (
              <button
                key={prediction.place_id}
                type="button"
                onClick={() => handleSelectPrediction(prediction)}
                className={`
                  w-full px-4 py-3 text-left flex items-start gap-3 transition-colors
                  hover:bg-[#F3F4F6] active:bg-[#E5E7EB]
                  ${index === selectedIndex ? 'bg-[#F3F4F6]' : ''}
                  ${index === 0 ? 'rounded-t-lg' : ''}
                  ${index === predictions.length - 1 ? 'rounded-b-lg' : ''}
                  border-b border-[#E5E7EB] last:border-b-0
                  min-h-[44px]
                `}
              >
                <MapPin className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[14px] text-[#111827] leading-[1.4]">
                    {primary}
                  </div>
                  {secondary && (
                    <div className="text-[12px] text-[#6B7280] leading-[1.35] mt-0.5">
                      {secondary}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-[12px] text-amber-600">
          <AlertCircle className="w-4 h-4" />
          <span>Autocomplete unavailable, please enter address manually.</span>
        </div>
      )}
    </div>
  );
}