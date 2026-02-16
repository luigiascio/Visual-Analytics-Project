<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import * as d3 from 'd3';

// --- CONFIGURAZIONE ---
// Props: Nave selezionata e Intervallo temporale (filtrato dal calendario)
const props = defineProps(['selectedVessel', 'timeRange']);

// --- STATO REATTIVO ---
const mapContainer = ref(null);   // Riferimento al div mappa
const geoData = ref(null);        // Dati GeoJSON (confini, isole)
const vesselTracks = ref({});     // Dati ping navi processati
const loading = ref(true);        // Stato caricamento

const hoveredPoint = ref(null);   // Punto sotto il mouse (per tooltip)
const tooltipPos = ref({ x: 0, y: 0 }); // Posizione tooltip

// --- COSTANTI GEOGRAFICHE ---
// Liste per colorare le zone diversamente
const PRESERVE_ZONES = ["Ghoti Preserve", "Nemo Reef", "Don Limpet Preserve"];
const FISHING_ZONES = ["Wrasse Beds", "Cod Table", "Tuna Shelf"];
const LAND_ZONES = ["Suna Island", "Silent Sanctuary", "Tull Island", "Mansfield Island", "Makara Shoal"];
// Etichette visibili/nascoste per pulizia visiva
const CITY_LABELS = ["Himark", "Lomark", "Haacklee", "Port Grove", "Paackland", "South Paackland", "Centralia"];
const HIDDEN_LABELS = ["Suna Island", "Silent Sanctuary", "Tull Island", "Mansfield Island", "Thalassa Retreat", "Makara Shoal"];

// Icona SVG nave (Path)
const BOAT_ICON = "M 0,-18 L 11,14 L 0,8 L -11,14 Z"; 

// --- CARICAMENTO DATI ---
onMounted(async () => {
    try {
        // Carica mappa e dati navi in parallelo
        const [mapResp, tracksResp] = await Promise.all([
            fetch('/Oceanus Geography.geojson'),
            fetch('/south_seafood_pings.json')
        ]);
        geoData.value = await mapResp.json();
        const rawTracks = await tracksResp.json();

        // Pre-processamento: converte stringhe data in timestamp numerici (veloce per filtri)
        const processed = {};
        Object.keys(rawTracks).forEach(key => {
            processed[key] = rawTracks[key].map(p => ({
                ...p,
                timestamp: new Date(p.time).getTime()
            }));
        });
        vesselTracks.value = processed;
        loading.value = false;
        nextTick(drawMap); // Avvia disegno mappa
    } catch (e) { console.error(e); }
});

// --- WATCHERS ---
// Ridisegna se cambia nave o intervallo temporale
watch(() => [props.selectedVessel, props.timeRange], () => {
    hoveredPoint.value = null; // Chiude tooltip
    nextTick(drawMap);
}, { deep: true });

// --- RENDERING D3.JS ---
function drawMap() {
    if (!geoData.value || !mapContainer.value || !props.selectedVessel) return;

    const width = mapContainer.value.clientWidth;
    const height = 480;
    const padding = 40;

    d3.select(mapContainer.value).selectAll("svg").remove(); // Reset SVG
    
    // Setup SVG con Zoom/Pan
    const svg = d3.select(mapContainer.value).append("svg")
        .attr("width", width).attr("height", height)
        .style("background", "#eef7fc")
        .style("cursor", "grab");

    const g = svg.append("g"); // Gruppo che verrà zoomato

    // --- ZOOM BEHAVIOR ---
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) // Zoom min 1x, max 8x
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", (event) => {
            g.attr("transform", event.transform); // Applica trasformazione
            
            // --- ZOOM SEMANTICO ---
            // Mantiene linee e punti leggibili quando si zooma
            g.selectAll("path.zone").attr("stroke-width", 1 / event.transform.k);
            g.selectAll("path.track").attr("stroke-width", 2 / event.transform.k);
            
            // Ricalcola dimensione punti (Violazioni rimangono più grandi)
            g.selectAll("circle.pt").attr("r", d => {
                const baseR = (d.type === 'violation' || d.type === 'suspicious') ? 5 : 2.5;
                return baseR / event.transform.k; 
            });
            
            // Scala icona nave e testo
            g.select(".vessel-icon").attr("transform", `scale(${0.8 / Math.sqrt(event.transform.k)})`);
            g.selectAll("text.lbl").attr("font-size", d => {
                const isCity = CITY_LABELS.includes(d.properties.Name.replace("City of ", ""));
                const baseSize = isCity ? 10 : 9;
                return `${baseSize / Math.sqrt(event.transform.k)}px`; 
            });
        });

    svg.call(zoom);

    // Proiezione Cartografica (Adatta GeoJSON al div)
    const projection = d3.geoIdentity().reflectY(true)
        .fitExtent([[padding, padding], [width-padding, height-padding]], geoData.value);
    const pathGenerator = d3.geoPath().projection(projection);

    // 1. DISEGNO ZONE (GeoJSON)
    g.selectAll("path.zone").data(geoData.value.features).enter().append("path")
        .attr("class", "zone")
        .attr("d", pathGenerator)
        // Colora in base al tipo di zona (Preserve, Fishing, Land)
        .attr("fill", d => {
            const name = d.properties.Name;
            if (PRESERVE_ZONES.includes(name)) return "#ffcccc"; 
            if (FISHING_ZONES.includes(name)) return "#ffffcc";  
            if (LAND_ZONES.includes(name)) return "#d2b48c";     
            return "#cbd5e1"; 
        })
        .attr("stroke", d => { // Bordo colorato per zone speciali
            const name = d.properties.Name;
            if (PRESERVE_ZONES.includes(name)) return "#ff0000"; 
            if (FISHING_ZONES.includes(name)) return "#ffcc00";  
            return "white";
        })
        .attr("stroke-width", 1).attr("opacity", 0.9);

    // 2. DISEGNO ETICHETTE
    g.selectAll("text.lbl")
        .data(geoData.value.features)
        .enter().append("text")
        .attr("class", "lbl")
        .filter(d => !HIDDEN_LABELS.includes(d.properties.Name)) // Nasconde etichette inutili
        .attr("transform", d => {
            const [x, y] = pathGenerator.centroid(d); // Posiziona al centro della zona
            return `translate(${x}, ${y})`;
        })
        .attr("dy", d => { // Aggiustamento fine posizione Y
            const name = d.properties.Name;
            if (PRESERVE_ZONES.includes(name)) return 15;
            if (FISHING_ZONES.includes(name)) return -15;
            return -12; 
        })
        .attr("text-anchor", "middle")
        .text(d => d.properties.Name.replace("City of ", ""));

    // 3. DISEGNO ROTTA NAVE
    const fullTrack = vesselTracks.value[props.selectedVessel];
    if (fullTrack && props.timeRange) {
        // Filtra punti nel range temporale selezionato
        const visiblePoints = fullTrack
            .filter(p => p.timestamp >= props.timeRange.start && p.timestamp <= props.timeRange.end)
            .map(step => {
                // Trova coordinate X,Y della location nel GeoJSON
                const feat = geoData.value.features.find(f => f.properties.Name === step.loc);
                if (feat) {
                    const c = pathGenerator.centroid(feat);
                    // Aggiunge offset casuale (jitter) per evitare sovrapposizioni perfette
                    return { x: c[0]+(step.x_offset||0), y: c[1]+(step.y_offset||0), ...step };
                }
                return null;
            }).filter(p => p);

        if (visiblePoints.length > 0) {
            // A. Linea Rotta
            const lineGen = d3.line().x(d=>d.x).y(d=>d.y);
            g.append("path").datum(visiblePoints)
                .attr("class", "track")
                .attr("d", lineGen).attr("fill", "none")
                .attr("stroke", "#2c3e50").attr("stroke-width", 2).attr("opacity", 0.7);

            // B. Punti (Ping)
            g.selectAll("circle.pt").data(visiblePoints).enter().append("circle")
                .attr("class", "pt")
                .attr("cx", d=>d.x).attr("cy", d=>d.y)
                // Dimensione dinamica (Violazioni > Normali)
                .attr("r", d => (d.type === 'violation' || d.type === 'suspicious') ? 5 : 2.5)
                .attr("fill", d => {
                    if (d.type === 'violation') return "#e74c3c"; // Rosso
                    if (d.type === 'suspicious') return "#f39c12"; // Arancione
                    return "#3498db"; // Blu
                })
                .style("cursor", "crosshair")
                // Interazione Mouseover (Ingrandisce + Tooltip)
                .on("mouseover", (event, d) => {
                    d3.select(event.currentTarget)
                        .attr("stroke", "#000").attr("stroke-width", 2).attr("r", 7);
                    
                    hoveredPoint.value = d;
                    const [mouseX, mouseY] = d3.pointer(event, mapContainer.value);
                    tooltipPos.value = { x: mouseX, y: mouseY };
                })
                .on("mouseout", (event, d) => {
                    // Ripristina dimensione corretta in base allo zoom attuale
                    const originalR = (d.type === 'violation' || d.type === 'suspicious') ? 5 : 2.5;
                    const transform = d3.zoomTransform(svg.node());
                    d3.select(event.currentTarget)
                        .attr("stroke", "white").attr("stroke-width", 1)
                        .attr("r", originalR / transform.k);
                    hoveredPoint.value = null;
                });

            // C. Icona Barca (Ultima posizione)
            const last = visiblePoints[visiblePoints.length-1];
            g.append("g").attr("transform", `translate(${last.x},${last.y})`)
                .append("path").attr("d", BOAT_ICON)
                .attr("fill", "#2c3e50").attr("stroke", "white").attr("opacity", 0.6)
                .attr("transform", "scale(0.8)");
            
            // Legenda temporale
            svg.append("text").attr("x", 20).attr("y", 25)
               .attr("font-size", "12px").attr("font-weight", "bold").attr("fill", "#334155")
               .text(`Showing: ${new Date(props.timeRange.start).toLocaleDateString()} - ${new Date(props.timeRange.end).toLocaleDateString()}`);
        }
    }
}
</script>

<template>
  <div class="geo-wrapper" ref="mapContainer">
      <div v-if="hoveredPoint" 
           class="map-tooltip"
           :style="{ top: tooltipPos.y + 'px', left: tooltipPos.x + 'px' }">
          <div class="time">{{ new Date(hoveredPoint.time).toLocaleString() }}</div>
          <div class="loc">{{ hoveredPoint.loc }}</div>
      </div>
  </div>
</template>

<style scoped>
/* CSS base mappa */
.geo-wrapper { 
    height: 480px; width: 100%; 
    border-radius: 6px; overflow: hidden; background: #eef7fc; 
    position: relative; 
}
.geo-wrapper:active { cursor: grabbing; }

/* Stile Tooltip */
.map-tooltip {
    position: absolute; transform: translate(-50%, -120%); 
    background: rgba(255, 255, 255, 0.95); padding: 6px 10px;
    border-radius: 6px; border: 1px solid #cbd5e1;
    pointer-events: none; z-index: 20;
    font-size: 0.8rem; color: #1e293b; text-align: center;
}
/* Freccetta tooltip */
.map-tooltip::after {
    content: ""; position: absolute; top: 100%; left: 50%; margin-left: -5px;
    border-width: 5px; border-style: solid; border-color: white transparent transparent transparent;
}
</style>