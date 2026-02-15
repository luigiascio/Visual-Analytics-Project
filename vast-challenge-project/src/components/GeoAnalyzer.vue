<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import * as d3 from 'd3';

const props = defineProps(['selectedVessel', 'timeRange']);

const mapContainer = ref(null);
const geoData = ref(null);
const vesselTracks = ref({}); 
const loading = ref(true);

const hoveredPoint = ref(null);
const tooltipPos = ref({ x: 0, y: 0 });

const PRESERVE_ZONES = ["Ghoti Preserve", "Nemo Reef", "Don Limpet Preserve"];
const FISHING_ZONES = ["Wrasse Beds", "Cod Table", "Tuna Shelf"];
const LAND_ZONES = ["Suna Island", "Silent Sanctuary", "Tull Island", "Mansfield Island", "Makara Shoal"];
const CITY_LABELS = ["Himark", "Lomark", "Haacklee", "Port Grove", "Paackland", "South Paackland", "Centralia"];
const HIDDEN_LABELS = ["Suna Island", "Silent Sanctuary", "Tull Island", "Mansfield Island", "Thalassa Retreat", "Makara Shoal"];

const BOAT_ICON = "M 0,-18 L 11,14 L 0,8 L -11,14 Z"; 

onMounted(async () => {
    try {
        const [mapResp, tracksResp] = await Promise.all([
            fetch('/Oceanus Geography.geojson'),
            fetch('/south_seafood_pings.json')
        ]);
        geoData.value = await mapResp.json();
        const rawTracks = await tracksResp.json();

        const processed = {};
        Object.keys(rawTracks).forEach(key => {
            processed[key] = rawTracks[key].map(p => ({
                ...p,
                timestamp: new Date(p.time).getTime()
            }));
        });
        vesselTracks.value = processed;
        loading.value = false;
        nextTick(drawMap);
    } catch (e) { console.error(e); }
});

watch(() => [props.selectedVessel, props.timeRange], () => {
    hoveredPoint.value = null;
    nextTick(drawMap);
}, { deep: true });

function drawMap() {
    if (!geoData.value || !mapContainer.value || !props.selectedVessel) return;

    const width = mapContainer.value.clientWidth;
    const height = 480;
    const padding = 40;

    d3.select(mapContainer.value).selectAll("svg").remove();
    
    const svg = d3.select(mapContainer.value).append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "#eef7fc")
        .style("cursor", "grab");

    const g = svg.append("g");

    // --- ZOOM ---
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) 
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
            
            g.selectAll("path.zone").attr("stroke-width", 1 / event.transform.k);
            g.selectAll("path.track").attr("stroke-width", 2 / event.transform.k);
            
            // MODIFICA 1: Ricalcolo raggio dinamico durante lo zoom
            g.selectAll("circle.pt").attr("r", d => {
                // Se è violazione/sospetto base=5, altrimenti base=2.5 (più piccoli)
                const baseR = (d.type === 'violation' || d.type === 'suspicious') ? 5 : 2.5;
                return baseR / event.transform.k; 
            });
            
            g.select(".vessel-icon").attr("transform", `scale(${0.8 / Math.sqrt(event.transform.k)})`);

            g.selectAll("text.lbl").attr("font-size", d => {
                const isCity = CITY_LABELS.includes(d.properties.Name.replace("City of ", ""));
                const baseSize = isCity ? 10 : 9;
                return `${baseSize / Math.sqrt(event.transform.k)}px`; 
            });
        });

    svg.call(zoom);

    const projection = d3.geoIdentity().reflectY(true)
        .fitExtent([[padding, padding], [width-padding, height-padding]], geoData.value);
    const pathGenerator = d3.geoPath().projection(projection);

    // 1. ZONE
    g.selectAll("path.zone").data(geoData.value.features).enter().append("path")
        .attr("class", "zone")
        .attr("d", pathGenerator)
        .attr("fill", d => {
            const name = d.properties.Name;
            if (PRESERVE_ZONES.includes(name)) return "#ffcccc"; 
            if (FISHING_ZONES.includes(name)) return "#ffffcc";  
            if (LAND_ZONES.includes(name)) return "#d2b48c";     
            return "#cbd5e1"; 
        })
        .attr("stroke", d => {
            const name = d.properties.Name;
            if (PRESERVE_ZONES.includes(name)) return "#ff0000"; 
            if (FISHING_ZONES.includes(name)) return "#ffcc00";  
            return "white";
        })
        .attr("stroke-width", 1)
        .attr("opacity", 0.9);

    // 2. ETICHETTE
    g.selectAll("text.lbl")
        .data(geoData.value.features)
        .enter().append("text")
        .attr("class", "lbl")
        .filter(d => !HIDDEN_LABELS.includes(d.properties.Name))
        .attr("transform", d => {
            const [x, y] = pathGenerator.centroid(d);
            return `translate(${x}, ${y})`;
        })
        .attr("dy", d => {
            const name = d.properties.Name;
            const cleanName = name.replace("City of ", "");
            if (PRESERVE_ZONES.includes(name)) return 15;
            if (FISHING_ZONES.includes(name)) return -15;
            if (CITY_LABELS.includes(cleanName)) return 5;
            return -12; 
        })
        .attr("text-anchor", "middle")
        .attr("font-size", d => CITY_LABELS.includes(d.properties.Name.replace("City of ", "")) ? "10px" : "9px")
        .attr("font-weight", d => CITY_LABELS.includes(d.properties.Name.replace("City of ", "")) ? "bold" : "600")
        .attr("fill", d => CITY_LABELS.includes(d.properties.Name.replace("City of ", "")) ? "#000000" : "#475569")
        .style("pointer-events", "none") 
        .text(d => d.properties.Name.replace("City of ", ""));

    // 3. ROTTA
    const fullTrack = vesselTracks.value[props.selectedVessel];
    if (fullTrack && props.timeRange) {
        const visiblePoints = fullTrack
            .filter(p => p.timestamp >= props.timeRange.start && p.timestamp <= props.timeRange.end)
            .map(step => {
                const feat = geoData.value.features.find(f => f.properties.Name === step.loc);
                if (feat) {
                    const c = pathGenerator.centroid(feat);
                    return { x: c[0]+(step.x_offset||0), y: c[1]+(step.y_offset||0), ...step };
                }
                return null;
            }).filter(p => p);

        if (visiblePoints.length > 0) {
            const lineGen = d3.line().x(d=>d.x).y(d=>d.y);
            g.append("path").datum(visiblePoints)
                .attr("class", "track")
                .attr("d", lineGen).attr("fill", "none")
                .attr("stroke", "#2c3e50").attr("stroke-width", 2).attr("opacity", 0.7);

            // B. Punti
            g.selectAll("circle.pt").data(visiblePoints).enter().append("circle")
                .attr("class", "pt")
                .attr("cx", d=>d.x).attr("cy", d=>d.y)
                
                // MODIFICA 2: Dimensione Iniziale condizionale
                .attr("r", d => (d.type === 'violation' || d.type === 'suspicious') ? 5 : 2.5)
                
                .attr("stroke", "white")
                .attr("vector-effect", "non-scaling-stroke") 
                .attr("fill", d => {
                    if (d.type === 'violation') return "#e74c3c"; 
                    if (d.type === 'suspicious') return "#f39c12"; 
                    return "#3498db"; // Blu scuro per i punti piccoli
                })
                .style("cursor", "crosshair")
                .on("mouseover", (event, d) => {
                    // Quando passi sopra, ingrandisci leggermente per facilitare il click/visualizzazione
                    d3.select(event.currentTarget)
                        .attr("stroke", "#000")
                        .attr("stroke-width", 2)
                        .attr("r", 7); // Espandi temporaneamente
                        
                    hoveredPoint.value = d;
                    const [mouseX, mouseY] = d3.pointer(event, mapContainer.value);
                    tooltipPos.value = { x: mouseX, y: mouseY };
                })
                .on("mouseout", (event, d) => {
                    // Ripristina dimensione originale
                    const originalR = (d.type === 'violation' || d.type === 'suspicious') ? 5 : 2.5;
                    const transform = d3.zoomTransform(svg.node()); // Recupera lo zoom attuale
                    
                    d3.select(event.currentTarget)
                        .attr("stroke", "white")
                        .attr("stroke-width", 1)
                        .attr("r", originalR / transform.k); // Ripristina rispettando lo zoom

                    hoveredPoint.value = null;
                });

            // C. Barca
            const last = visiblePoints[visiblePoints.length-1];
            const boatGroup = g.append("g")
                .attr("transform", `translate(${last.x},${last.y})`)
                .style("pointer-events", "none");
            
            boatGroup.append("path")
                .attr("class", "vessel-icon")
                .attr("d", BOAT_ICON)
                .attr("fill", "#2c3e50")
                .attr("stroke", "white")    
                .attr("stroke-width", 1)
                .attr("opacity", 0.6) 
                .attr("transform", "scale(0.8)"); 
            
            svg.append("text")
               .attr("x", 20).attr("y", 25)
               .attr("font-size", "12px").attr("font-weight", "bold").attr("fill", "#334155")
               .style("pointer-events", "none")
               .text(`Showing: ${new Date(props.timeRange.start).toLocaleDateString()} - ${new Date(props.timeRange.end).toLocaleDateString()}`);

            svg.append("text")
               .attr("x", width - 10).attr("y", height - 10)
               .attr("text-anchor", "end")
               .attr("font-size", "10px").attr("fill", "#94a3b8")
               .style("pointer-events", "none")
               .text("Scroll to Zoom, Drag to Pan");

        } else {
            svg.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor", "middle")
               .text("No movements in selected timeframe").attr("fill", "#999");
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
.geo-wrapper { 
    height: 480px; 
    width: 100%; 
    border-radius: 6px; 
    overflow: hidden; 
    background: #eef7fc; 
    position: relative; 
}
.geo-wrapper:active { cursor: grabbing; }

.map-tooltip {
    position: absolute;
    transform: translate(-50%, -120%); 
    background: rgba(255, 255, 255, 0.95);
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    pointer-events: none; 
    z-index: 20;
    font-size: 0.8rem;
    color: #1e293b;
    text-align: center;
    white-space: nowrap;
}

.map-tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: white transparent transparent transparent;
}

.map-tooltip .time {
    font-weight: 700;
    color: #0f172a;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 2px;
    margin-bottom: 2px;
}
.map-tooltip .loc {
    color: #64748b;
    font-size: 0.75rem;
}
</style>