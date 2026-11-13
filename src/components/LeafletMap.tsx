import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

export interface LeafletMapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  locationTitle?: string;
  interactive?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
}

export default function LeafletMap({
  latitude = 8.228,
  longitude = 124.2452,
  zoom = 14,
  locationTitle,
  interactive = true,
  onLocationSelect,
}: LeafletMapProps) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<any>(null);
  const isFirstRender = useRef(true);
  const isInteractive = interactive !== false;
  const escapedTitle = (locationTitle || "Location").replace(/'/g, "\\'");
  const leafletHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
      <style>
        * { box-sizing: border-box; }
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .custom-pin-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: translate(-50%, -100%);
          pointer-events: auto;
          cursor: pointer;
        }
        .pin-label-bar {
          background: #ffffff;
          color: #1f2937;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 9999px;
          border: 1.5px solid #72AF5B;
          box-shadow: 0 4px 10px rgba(0,0,0,0.18);
          white-space: nowrap;
          max-width: 170px;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
          margin-bottom: 3px;
        }
        .pin-icon {
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { 
          zoomControl: false,
          attributionControl: false,
          dragging: ${isInteractive},
          touchZoom: ${isInteractive},
          scrollWheelZoom: ${isInteractive},
          doubleClickZoom: ${isInteractive}
        }).setView([${latitude}, ${longitude}], ${zoom});

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        var customIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: '<div class="custom-pin-container">' +
                  '<div class="pin-label-bar">${escapedTitle}</div>' +
                  '<svg class="pin-icon" width="34" height="34" viewBox="0 0 24 24" fill="#72AF5B" xmlns="http://www.w3.org/2000/svg">' +
                    '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>' +
                  '</svg>' +
                '</div>',
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });

        var marker = L.marker([${latitude}, ${longitude}], { icon: customIcon }).addTo(map);

        window.leafletMap = map;
        window.leafletMarker = marker;

        function updatePin(lat, lng, title) {
          if (map && marker) {
            map.flyTo([lat, lng], 15, { animate: true, duration: 0.8 });
            marker.setLatLng([lat, lng]);
            if (title) {
              var el = document.querySelector('.pin-label-bar');
              if (el) el.textContent = title;
            }
          }
        }
        window.updatePin = updatePin;

        window.addEventListener('message', function(e) {
          try {
            var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (d && d.type === 'UPDATE_PIN' && d.latitude && d.longitude) {
              updatePin(d.latitude, d.longitude, d.title);
            }
          } catch(err) {}
        });

        setTimeout(function() {
          map.invalidateSize();
        }, 250);

        if (${isInteractive}) {
          map.on('click', function(e) {
            var lat = e.latlng.lat;
            var lng = e.latlng.lng;
            marker.setLatLng(e.latlng);
            var payload = JSON.stringify({ latitude: lat, longitude: lng });
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(payload);
            } else if (window.parent) {
              window.parent.postMessage(payload, '*');
            }
          });
        }
      </script>
    </body>
    </html>
  `;

  const handleNativeMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.latitude && data.longitude && onLocationSelect) {
        onLocationSelect(data.latitude, data.longitude);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const safeTitle = escapedTitle.replace(/"/g, '\\"');
    if (Platform.OS === "web") {
      iframeRef.current?.contentWindow?.postMessage?.(
        {
          type: "UPDATE_PIN",
          latitude,
          longitude,
          title: locationTitle,
        },
        "*",
      );
    } else {
      const js = `
        if (typeof window.updatePin === 'function') {
          window.updatePin(${latitude}, ${longitude}, "${safeTitle}");
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
    }
  }, [latitude, longitude, escapedTitle, locationTitle]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleWebMessage = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data.latitude && data.longitude && onLocationSelect) {
          onLocationSelect(data.latitude, data.longitude);
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener("message", handleWebMessage);
    return () => window.removeEventListener("message", handleWebMessage);
  }, [onLocationSelect]);

  return (
    <View style={styles.container}>
      {Platform.OS === "web" ? (
        <iframe
          ref={iframeRef}
          srcDoc={leafletHtml}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          }}
          title="Leaflet Map"
        />
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: leafletHtml }}
          onMessage={handleNativeMessage}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  webView: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#e5e7eb",
  },
});
