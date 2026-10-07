# Assignment 11 - Cosmos Space Dashboard

A Vanilla JavaScript dashboard that consumes three public space APIs:

- NASA Astronomy Picture of the Day (APOD)
- The Space Devs Launch Library 2
- Solar System OpenData

## Run

Open the folder with VS Code and run `index.html` using Live Server (recommended), or serve the folder with any simple local web server.

## NASA API key

The project works with NASA's `DEMO_KEY` by default. For a higher request limit, replace the `NASA_API_KEY` value at the top of `assets/js/index.js` with your own key.

## Main features

- Responsive sidebar navigation between Today in Space, Launches, and Planets.
- NASA APOD with date picker, loading state, media handling, and full-resolution link.
- Live upcoming launches, featured launch card, launch status, provider, rocket, date/time, location, mission details, and images.
- Eight Solar System planets with live physical/orbital data and comparison table.
- Graceful fallback UI when an external API is unavailable.
