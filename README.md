# Route Visualization

A web application that visualizes routes between locations using natural language processing and map visualization.

## Features

- Natural language processing to extract locations and route preferences
- Interactive map visualization using Mapbox GL JS
- Support for multiple waypoints
- Route preferences (transport mode, avoid tolls, highways, ferries)
- Fallback mechanisms for robust location extraction

## Setup

1. Clone the repository
   ```
   git clone https://github.com/your-username/route-visualization.git
   cd route-visualization
   ```

2. Configure API keys
   - Copy `config.sample.js` to `config.js`
   - Add your Mapbox and Gemini API keys to `config.js`

3. Run the application
   - Open `index.html` in your browser or use a local server
   ```
   python -m http.server 8000
   ```
   - Navigate to `http://localhost:8000`

## API Keys Required

- [Mapbox](https://www.mapbox.com/) - For map visualization and geocoding
- [Google Gemini](https://ai.google.dev/) - For natural language processing

## Usage

Enter natural language queries in the search box, such as:
- "Route from New York to Los Angeles"
- "Walking path from Central Park to Times Square"
- "Cycling route from San Francisco to Oakland avoiding highways"
- "Show me a route from London through Paris to Berlin avoiding tolls"

## Project Structure

- `index.html` - Main HTML file with the user interface
- `script.js` - Main JavaScript file handling map initialization and route processing
- `nlp.js` - Natural language processing module using Gemini API
- `config.sample.js` - Template for configuration (copy to config.js with your API keys)

## License

MIT