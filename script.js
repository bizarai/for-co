// Import configuration and NLP module
import config from './config.js';
import { processNaturalLanguage } from './nlp.js';

const mapboxToken = config.mapbox.token;

mapboxgl.accessToken = mapboxToken;

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-122.42136449, 37.80176523], // Center the map on San Francisco
  zoom: 8
});

map.on('load', () => {
  console.log('Map loaded');
  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: []
      }
    }
  });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#00a0f0',
      'line-width': 3
    }
  });
  console.log('Layer added');
});

const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const loadingIndicator = document.getElementById('loading-indicator');

searchButton.addEventListener('click', async () => {
  const inputValue = searchInput.value;
  
  if (!inputValue.trim()) {
    alert('Please enter a search query');
    return;
  }
  
  // Show loading indicator
  loadingIndicator.style.display = 'block';
  
  try {
    // Process the natural language input
    const result = await processNaturalLanguage(inputValue);
    console.log('NLP Result:', result);
    
    if (result.locations && result.locations.length > 0) {
      // Process the extracted locations and preferences
      getRouteCoordinates(result.locations, result.preferences, true);
    } else {
      // Fallback to direct processing if NLP fails to extract locations
      getRouteCoordinates(inputValue);
    }
  } catch (error) {
    console.error('Error processing input:', error);
    // Fallback to direct processing
    getRouteCoordinates(inputValue);
  } finally {
    // Hide loading indicator
    loadingIndicator.style.display = 'none';
  }
});

const geocodingUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';

/**
 * Get route coordinates based on input and preferences
 * @param {string|Array} input - The input string or array of locations
 * @param {Object} preferences - Optional route preferences
 * @param {boolean} isLocationArray - Whether the input is already an array of locations
 */
function getRouteCoordinates(input, preferences = null, isLocationArray = false) {
  // Default preferences if not provided
  preferences = preferences || {
    transportMode: 'driving',
    avoidTolls: false,
    avoidHighways: false,
    avoidFerries: false
  };

  // Handle the input based on whether it's an array or string
  let locations;
  
  if (isLocationArray && Array.isArray(input)) {
    // If input is already an array of locations, use it directly
    console.log('Using provided locations array:', input);
    locations = input;
  } else {
    // Process the input string to extract locations
    // First, remove any trailing punctuation like periods
    let inputString = input.trim();
    inputString = inputString.replace(/[.!?]+$/, '').trim();
    
    console.log('Input after removing trailing punctuation:', inputString);
    
    // Use more specific separators to avoid splitting multi-word location names
    const separators = [' to ', ' 到 ', ', ', ' and ', ' => ', ',', '，'];
    
    // Preprocess the input string to handle common prepositions and descriptive words
    let processedInput = inputString;
    const commonPrepositions = ['from', 'to', 'through', 'via', 'between', 'starting at', 'ending at'];
    const commonDescriptors = ['route', 'path', 'directions', 'way', 'road', 'show me', 'find', 'get', 'display'];
    
    // Handle "From X to Y" pattern - we need to preserve both locations
    const fromToPattern = /^from\s+([^\s][^\n]+?)\s+to\s+([^\s][^\n]+)/i;
    const fromToMatch = processedInput.match(fromToPattern);
    
    if (fromToMatch) {
      // If we have a "From X to Y" pattern, extract both locations directly
      console.log('Detected From-To pattern, extracting locations directly');
      locations = [fromToMatch[1].trim(), fromToMatch[2].trim()];
      
      // Check if there are more locations after "to Y"
      const remainingText = processedInput.substring(processedInput.indexOf(fromToMatch[2]) + fromToMatch[2].length).trim();
      
      if (remainingText) {
        // Process any additional locations after the "to Y" part
        const additionalLocations = processRemainingLocations(remainingText, separators, commonPrepositions);
        if (additionalLocations.length > 0) {
          locations = locations.concat(additionalLocations);
        }
      }
    } else {
      // Remove common descriptive words at the beginning of the string
      const startsWithDescriptor = new RegExp(`^(${commonDescriptors.join('|')})\s+`, 'i');
      processedInput = processedInput.replace(startsWithDescriptor, '');
      
      // Handle "X to Y to Z" pattern without "from"
      // Standardize prepositions between locations to ensure consistent processing
      commonPrepositions.forEach(preposition => {
        const escapedPreposition = preposition.replace(/\s+/g, '\\s+');
        const prepositionRegex = new RegExp(`\\s+${escapedPreposition}\\s+`, 'gi');
        processedInput = processedInput.replace(prepositionRegex, ' __LOCATION_SEPARATOR__ ');
      });
      
      // Then replace all marked separators with a consistent delimiter
      processedInput = processedInput.replace(/__LOCATION_SEPARATOR__/g, 'to');
      
      console.log('Processed input after preposition replacement:', processedInput);
      
      locations = processedInput
        .split(new RegExp(separators.join('|'), 'gi'))
        .map(location => location.trim())
        .filter(location => location !== '')
        // Filter out any remaining prepositions that might be isolated
        .filter(location => !commonPrepositions.includes(location.toLowerCase()));
    }
    
    console.log('Extracted locations:', locations);
  }

  if (locations.length < 1) {
    console.error('No valid locations found in input');
    return;
  }

  const geocodePromises = locations.map(location =>
    fetch(`${geocodingUrl}${encodeURIComponent(location)}.json?access_token=${mapboxToken}`)
      .then(response => response.json())
      .then(data => {
        if (data.features.length > 0) {
          const coordinates = data.features[0].geometry.coordinates;
          return `${coordinates[0]},${coordinates[1]}`;
        } else {
          throw new Error(`Unable to geocode location: ${location}`);
        }
      })
  );

  Promise.all(geocodePromises)
    .then(coordinates => {
      console.log('Geocoded coordinates:', coordinates);
      console.log('Number of locations:', locations.length);
      
      let url;
      if (locations.length === 1) {
        // If there's only one location, center the map on it
        const singleLocation = coordinates[0].split(',').map(Number);
        map.setCenter(singleLocation);
        map.setZoom(12);
        console.log('Single location:', singleLocation);

        // Clear the route data
        map.getSource('route').setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        });
        return;
      } else if (locations.length === 2) {
        // For routes with exactly 2 locations (origin and destination)
        const origin = coordinates[0];
        const destination = coordinates[1];
        
        // Format coordinates for the API
        const formattedOrigin = origin.split(',').map(Number);
        const formattedDestination = destination.split(',').map(Number);
        
        // Create the coordinates string for the API
        const coordinatesString = `${formattedOrigin.join(',')};${formattedDestination.join(',')}`;
        
        url = `https://api.mapbox.com/directions/v5/mapbox/${preferences.transportMode}/${coordinatesString}?geometries=geojson&access_token=${mapboxToken}`;
        console.log('Creating route from origin to destination:', [locations[0], locations[1]]);
      } else {
        // For routes with 3 or more locations (origin, waypoints, destination)
        // Format all coordinates properly
        const formattedCoordinates = coordinates.map(coord => {
          if (typeof coord === 'string') {
            return coord.split(',').map(Number);
          }
          return coord;
        });
        
        // Join all coordinates in the format expected by the Mapbox API
        const coordinatesString = formattedCoordinates.map(coord => coord.join(',')).join(';');
        
        url = `https://api.mapbox.com/directions/v5/mapbox/${preferences.transportMode}/${coordinatesString}?geometries=geojson&access_token=${mapboxToken}`;
        console.log('Creating multi-stop route with all locations:', locations);
        console.log('Using formatted coordinates:', formattedCoordinates);
      }

      // Add avoid parameters if specified
      const avoidParams = [];
      if (preferences.avoidTolls) avoidParams.push('tolls');
      if (preferences.avoidHighways) avoidParams.push('highways');
      if (preferences.avoidFerries) avoidParams.push('ferries');
      
      if (avoidParams.length > 0) {
        url += `&exclude=${avoidParams.join(',')}`;
      }

      console.log('Directions API URL:', url);

      fetch(url)
        .then(response => response.json())
        .then(data => {
          console.log('Response data:', data);
          if (data.routes && data.routes.length > 0) {
            const coordinates = data.routes[0].geometry.coordinates;
            const mapData = {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: coordinates
              }
            };
            console.log('Map data:', mapData);
            
            // Update the map with the route data
            if (map.loaded() && map.getSource('route')) {
              map.getSource('route').setData(mapData);
              
              // Compute the bounding box for all coordinates
              const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
              }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

              // Fit the map to the bounds
              map.fitBounds(bounds, {
                padding: 50
              });
            } else {
              console.error('Map or source not ready');
            }
          } else {
            console.error('No valid route found in the API response');
          }
        })
        .catch(error => {
          console.error('Error fetching directions:', error);
        });
    })
    .catch(error => {
      console.error('Error geocoding locations:', error);
    });
}

/**
 * Process remaining text to extract additional locations
 * @param {string} text - The remaining text to process
 * @param {Array} separators - Array of separator strings
 * @param {Array} commonPrepositions - Array of common prepositions
 * @returns {Array} - Array of extracted locations
 */
function processRemainingLocations(text, separators, commonPrepositions) {
  // First check if there are any separators in the text
  const hasSeparator = separators.some(sep => text.includes(sep));
  
  if (hasSeparator) {
    // If there are separators, split by them
    return text
      .split(new RegExp(separators.join('|'), 'gi'))
      .map(location => location.trim())
      .filter(location => location !== '')
      .filter(location => !commonPrepositions.includes(location.toLowerCase()));
  } else {
    // If no separators, check if the text itself is a location
    const cleaned = text.trim();
    return cleaned ? [cleaned] : [];
  }
}
