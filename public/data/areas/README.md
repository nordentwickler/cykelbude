# GeoJSON-Dateien für Liefergebiete

In diesem Ordner müssen die GeoJSON-Dateien für die verschiedenen Liefergebiete liegen.

## Benötigte Dateien

- `standard.geojson` - Polygon für das Standard-Liefergebiet
- `stadtrand.geojson` - Polygon für das Stadtrand-Liefergebiet
- `umland.geojson` - Polygon für das Umland-Liefergebiet

## Struktur

Jede Datei sollte ein GeoJSON-FeatureCollection-Objekt enthalten mit einem oder mehreren Polygon-Features.

Siehe `EXAMPLE.geojson` für ein Beispiel.

## Farben auf der Karte

- **Standard**: Pink (#FF1493)
- **Stadtrand**: Blau (#4169E1)
- **Umland**: Grün (#32CD32)

## Tools zum Erstellen von GeoJSON

- [geojson.io](https://geojson.io) - Online-Tool zum Zeichnen und Bearbeiten von GeoJSON
- [Mapbox Studio](https://studio.mapbox.com) - Professioneller Editor
- QGIS - Open-Source Desktop GIS

## Koordinaten-Format

Die Koordinaten sollten im Format `[longitude, latitude]` angegeben werden (NICHT lat/lng!).

Beispiel für Berlin:
- Longitude: 13.4050
- Latitude: 52.5200
