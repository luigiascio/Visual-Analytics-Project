<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import * as d3 from 'd3';

const chartContainer = ref(null); // Riferimento al grafico a barre
const mapContainer = ref(null);   // Riferimento alla mappa
const loading = ref(true);
const errorMsg = ref(null);

// --- STATO INTERATTIVO ---
// hoveredLoc: tiene traccia della location su cui l'utente ha il mouse (per sincronizzare grafico e mappa)
const hoveredLoc = ref(null);
const tooltip = ref({ visible: false, x: 0, y: 0, content: null });

// --- CONFIGURAZIONE DATE (Analisi Pre/Post Ban) ---
const BAN_DATE = new Date("2035-05-14"); // Data del ban
const START_DATE = new Date("2035-01-01");
const END_DATE = new Date("2035-12-31");
const MS_PER_DAY = 1000 * 60 * 60 * 24;
// Calcolo durata periodi per normalizzare i dati (media giornaliera)
const DAYS_PRE = (BAN_DATE - START_DATE) / MS_PER_DAY;
const DAYS_POST = (END_DATE - BAN_DATE) / MS_PER_DAY;

// --- CONFIGURAZIONE COLORI ---
const COLORS = {
    violation: "#dc2626",   // Rosso
    suspicious: "#f97316",  // Arancione
    transit: "#3b82f6",     // Blu
    port: "#94a3b8"         // Grigio
};
const STACK_KEYS = ["violation", "suspicious", "transit", "port"];

// Liste zone geografiche per colorazione mappa
const PRESERVE_ZONES = ["Ghoti Preserve", "Nemo Reef", "Don Limpet Preserve"];
const FISHING_ZONES = ["Wrasse Beds", "Cod Table", "Tuna Shelf"];
const LAND_ZONES = ["Suna Island", "Silent Sanctuary", "Tull Island", "Mansfield Island", "Makara Shoal"];
const CITY_LABELS = ["Himark", "Lomark", "Haacklee", "Port Grove", "Paackland", "South Paackland", "Centralia"];
const HIDDEN_LABELS = ["Suna Island", "Silent Sanctuary", "Tull Island", "Mansfield Island", "Thalassa Retreat", "Makara Shoal"];

// DATI
const chartData = ref([]);
const geoData = ref(null);

// --- CARICAMENTO ---
onMounted(async () => {
    try {
        // Carica dati attività e mappa geografica
        const [respData, respGeo] = await Promise.all([
            fetch('/other_candidates.json'),
            fetch('/Oceanus Geography.geojson')
        ]);

        if (!respData.ok || !respGeo.ok) throw new Error("Dataset mancanti.");

        const rawData = await respData.json();
        geoData.value = await respGeo.json();
        
        // Elabora i dati calcolando le differenze Pre/Post ban
        processData(rawData);
        loading.value = false;
        
        // Disegna visualizzazioni al prossimo tick
        nextTick(() => {
            drawChart(); 
            drawMap();   
        });

    } catch(e) {
        console.error(e);
        errorMsg.value = e.message;
        loading.value = false;
    }
});

// --- WATCHER SINCRONIZZAZIONE ---
// Quando cambia la location sotto il mouse, evidenzia sia mappa che grafico
watch(hoveredLoc, (newLoc) => {
    highlightMapFeature(newLoc);
    highlightChartBar(newLoc);
});

// --- ELABORAZIONE DATI (Calcolo Delta) ---
function processData(data) {
    const locStats = {};
    // 1. Aggrega conteggi per Luogo -> Periodo -> Tipo
    Object.values(data).flat().forEach(ping => {
        const loc = ping.loc.replace("City of ", "");
        const date = new Date(ping.time);
        const type = ping.type || "transit";
        const period = date <= BAN_DATE ? 'pre' : 'post'; // Split temporale

        if (!locStats[loc]) {
            locStats[loc] = { pre: {}, post: {} };
            STACK_KEYS.forEach(k => { locStats[loc].pre[k] = 0; locStats[loc].post[k] = 0; });
        }
        locStats[loc][period][type]++;
    });

    // 2. Calcola Differenza Media Giornaliera (Delta)
    const rows = Object.keys(locStats).map(loc => {
        const row = { loc, totalDelta: 0, positives: [], negatives: [] };
        STACK_KEYS.forEach(key => {
            const avgPre = locStats[loc].pre[key] / DAYS_PRE;
            const avgPost = locStats[loc].post[key] / DAYS_POST;
            const delta = avgPost - avgPre;

            // Filtra cambiamenti minimi (rumore)
            if (Math.abs(delta) > 0.01) {
                if (delta > 0) row.positives.push({ key, val: delta });
                else row.negatives.push({ key, val: delta }); 
                row.totalDelta += delta;
            }
        });
        return row;
    });

    // 3. Filtra e ordina per rilevanza
    chartData.value = rows
        .filter(d => Math.abs(d.totalDelta) > 0.15)
        .sort((a, b) => b.totalDelta - a.totalDelta);
}

// --- DISEGNO GRAFICO A BARRE DIVERGENTI ---
function drawChart() {
    if (!chartContainer.value) return;
    const el = chartContainer.value;
    d3.select(el).selectAll("*").remove();

    // Margini per etichette
    const margin = { top: 60, right: 30, bottom: 40, left: 120 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(el).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Titolo
    svg.append("text").attr("x", width/2).attr("y", -35).attr("text-anchor", "middle")
        .style("font-size", "15px").style("font-weight", "bold").style("fill", "#1e293b")
        .text("Daily Activity Shift Post Seafood Ban");

    // Etichette Direzionali (Decrease / Increase)
    svg.append("text")
        .attr("x", 0).attr("y", -10).attr("text-anchor", "start")
        .style("font-size", "10px").style("fill", "#64748b").style("font-style", "italic")
        .text("← Decrease in Activity");

    svg.append("text")
        .attr("x", width).attr("y", -10).attr("text-anchor", "end")
        .style("font-size", "10px").style("fill", "#64748b").style("font-style", "italic")
        .text("Increase in Activity →");

    // Scala X simmetrica basata sul valore massimo
    const maxStacked = d3.max(chartData.value, d => {
        const sumPos = d3.sum(d.positives, i => i.val);
        const sumNeg = Math.abs(d3.sum(d.negatives, i => i.val));
        return Math.max(sumPos, sumNeg);
    }) || 1;

    // Scale
    const y = d3.scaleBand()
        .domain(chartData.value.map(d => d.loc))
        .range([0, height]).padding(0.3);

    const x = d3.scaleLinear()
        .domain([-maxStacked, maxStacked])
        .range([0, width]);

    // Griglie
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
        .style("stroke-dasharray", "3,3").style("stroke-opacity", 0.1).style("color", "#94a3b8")
        .select(".domain").remove();

    svg.append("g").attr("class", "grid").attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(-height).tickFormat(""))
        .style("stroke-dasharray", "3,3").style("stroke-opacity", 0.1).style("color", "#94a3b8")
        .select(".domain").remove();

    // Assi
    svg.append("g").call(d3.axisLeft(y).tickSize(0))
        .style("font-size", "11px").style("font-weight", "600").style("color", "#334155").select(".domain").remove();

    svg.append("g").attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(Math.abs))
        .style("color", "#64748b").select(".domain").remove();

    // Linea Zero Centrale
    svg.append("line")
        .attr("x1", x(0)).attr("x2", x(0))
        .attr("y1", 0).attr("y2", height)
        .attr("stroke", "#475569").attr("stroke-width", 1.5);

    // Disegno Barre
    const rows = svg.selectAll(".row")
        .data(chartData.value).enter().append("g")
        .attr("class", "row")
        .attr("id", d => `bar-${d.loc.replace(/\s+/g, '-')}`)
        .attr("transform", d => `translate(0, ${y(d.loc)})`)
        .style("cursor", "pointer")
        .on("mouseover", (e, d) => hoveredLoc.value = d.loc)
        .on("mouseout", () => hoveredLoc.value = null)
        .on("mousemove", (event, d) => {
             const [mx, my] = d3.pointer(event, chartContainer.value);
             tooltip.value = { visible: true, x: mx + 20, y: my, content: d };
        })
        .on("mouseleave", () => tooltip.value.visible = false);

    rows.each(function(d) {
        const g = d3.select(this);
        const barHeight = y.bandwidth();
        const zeroX = x(0);

        // Barre Positive (Destra)
        let currentX = zeroX;
        d.positives.forEach(seg => {
            const barW = x(seg.val) - zeroX;
            g.append("rect").attr("x", currentX).attr("y", 0)
                .attr("width", barW).attr("height", barHeight)
                .attr("fill", COLORS[seg.key]).attr("opacity", 0.9);
            currentX += barW;
        });

        // Barre Negative (Sinistra)
        currentX = zeroX;
        d.negatives.forEach(seg => {
            const w = zeroX - x(seg.val);
            const startX = currentX - w;
            g.append("rect").attr("x", startX).attr("y", 0)
                .attr("width", w).attr("height", barHeight)
                .attr("fill", COLORS[seg.key]).attr("opacity", 0.9);
            currentX = startX;
        });
    });

    // Legenda
    const legend = svg.append("g").attr("transform", `translate(${width - 90}, ${height - 80})`);
    legend.append("rect").attr("x", -10).attr("y", -10).attr("width", 100).attr("height", 90).attr("fill", "white").attr("opacity", 0.8).attr("rx", 4);

    Object.keys(COLORS).forEach((k, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i*18})`);
        row.append("rect").attr("width", 12).attr("height", 12).attr("fill", COLORS[k]).attr("rx", 2);
        row.append("text").attr("x", 16).attr("y", 10).text(k.charAt(0).toUpperCase() + k.slice(1))
            .style("font-size", "10px").style("fill", "#64748b").style("font-weight", "600");
    });
}

// Funzione Linking: Evidenzia barra nel grafico
function highlightChartBar(locName) {
    if (!chartContainer.value) return;
    const svg = d3.select(chartContainer.value);
    svg.selectAll(".row").attr("opacity", 0.5);
    if (locName) {
        svg.select(`#bar-${locName.replace(/\s+/g, '-')}`).attr("opacity", 1).attr("stroke", "#333");
    } else {
        svg.selectAll(".row").attr("opacity", 1).attr("stroke", "none");
    }
}

// --- DISEGNO MAPPA GEOGRAFICA ---
function drawMap() {
    if (!mapContainer.value || !geoData.value) return;
    const el = mapContainer.value;
    d3.select(el).selectAll("*").remove();

    const width = el.clientWidth;
    const height = 500;

    const svg = d3.select(el).append("svg")
        .attr("width", width).attr("height", height)
        .style("background", "#eef7fc")
        .style("border-radius", "8px");

    // Proiezione GeoJSON
    const projection = d3.geoIdentity().reflectY(true)
        .fitExtent([[20, 20], [width - 20, height - 20]], geoData.value);
    const pathGen = d3.geoPath().projection(projection);

    const g = svg.append("g");

    // Disegno Zone
    g.selectAll("path")
        .data(geoData.value.features).enter().append("path")
        .attr("d", pathGen)
        .attr("class", "geo-path")
        .attr("id", d => `map-${d.properties.Name.replace("City of ", "").replace(/\s+/g, '-')}`)
        // Colora in base al tipo di zona
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
        .attr("stroke-width", 1).attr("opacity", 0.9)
        .style("cursor", "pointer")
        .on("mouseover", (e, d) => hoveredLoc.value = d.properties.Name.replace("City of ", ""))
        .on("mouseout", () => hoveredLoc.value = null);

    // Etichette Zone
    g.selectAll("text")
        .data(geoData.value.features.filter(d => !HIDDEN_LABELS.includes(d.properties.Name)))
        .enter().append("text")
        .attr("transform", d => {
            const [x, y] = pathGen.centroid(d);
            return `translate(${x}, ${y})`;
        })
        .attr("dy", d => {
            const name = d.properties.Name;
            if (PRESERVE_ZONES.includes(name)) return 15;
            if (FISHING_ZONES.includes(name)) return 0;
            if (CITY_LABELS.includes(name.replace("City of ", ""))) return 5;
            return 4;
        })
        .attr("text-anchor", "middle")
        .attr("font-size", d => CITY_LABELS.includes(d.properties.Name.replace("City of ", "")) ? "10px" : "9px")
        .attr("font-weight", d => CITY_LABELS.includes(d.properties.Name.replace("City of ", "")) ? "bold" : "normal")
        .style("pointer-events", "none")
        .style("fill", d => CITY_LABELS.includes(d.properties.Name.replace("City of ", "")) ? "#000000" : "#475569") 
        .text(d => d.properties.Name.replace("City of ", ""));
}

// Funzione Linking: Evidenzia zona sulla mappa
function highlightMapFeature(locName) {
    if (!mapContainer.value) return;
    const svg = d3.select(mapContainer.value);
    
    // Reset colori
    svg.selectAll(".geo-path")
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
        .attr("stroke-width", 1);

    // Evidenzia selezione
    if (locName) {
        svg.select(`#map-${locName.replace(/\s+/g, '-')}`)
            .attr("fill", "#fcd34d")
            .attr("stroke", "#0f172a").attr("stroke-width", 2);
    }
}
</script>

<template>
    <div class="split-layout">
        <div v-if="loading" class="static-msg">Loading analysis data...</div>
        <div v-else-if="errorMsg" class="error">{{ errorMsg }}</div>
        
        <div class="panel chart-panel" ref="chartContainer"></div>
        <div class="panel map-panel" ref="mapContainer"></div>

        <div v-if="tooltip.visible" 
             class="custom-tooltip" 
             :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">
            <div class="tt-head">{{ tooltip.content.loc }}</div>
            <div class="tt-row" v-for="seg in tooltip.content.positives" :key="seg.key">
                <span :style="{color: COLORS[seg.key]}">▲ {{ seg.key }}:</span>
                <strong>+{{ seg.val.toFixed(2) }}</strong>
            </div>
            <div class="tt-row" v-for="seg in tooltip.content.negatives" :key="seg.key">
                <span :style="{color: COLORS[seg.key]}">▼ {{ seg.key }}:</span>
                <strong>{{ seg.val.toFixed(2) }}</strong>
            </div>
            <div class="tt-foot">Net: {{ tooltip.content.totalDelta > 0 ? '+' : ''}}{{ tooltip.content.totalDelta.toFixed(2) }}</div>
        </div>
    </div>
</template>

<style scoped>
.split-layout {
    display: flex;
    height: 600px;
    gap: 20px;
    padding: 10px;
    background: #fff;
    border-radius: 12px;
    position: relative;
}
.panel { border-radius: 8px; overflow: hidden; }
.chart-panel { flex: 1.2; border: 1px solid #e2e8f0; }
.map-panel { flex: 1; border: 1px solid #e2e8f0; background: #eef7fc; } 

.static-msg, .error { width: 100%; text-align: center; margin-top: 50px; color: #64748b; font-size: 1.1rem; }
.error { color: #dc2626; }

.custom-tooltip {
    position: absolute;
    background: rgba(255,255,255,0.98);
    border: 1px solid #cbd5e1;
    padding: 8px 12px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    pointer-events: none;
    z-index: 99;
    font-size: 0.8rem;
    min-width: 140px;
}
.tt-head { font-weight: 800; border-bottom: 1px solid #e2e8f0; margin-bottom: 4px; padding-bottom: 2px; color: #0f172a; }
.tt-row { display: flex; justify-content: space-between; margin-bottom: 2px; text-transform: capitalize; }
.tt-foot { margin-top: 4px; border-top: 1px solid #e2e8f0; padding-top: 2px; font-weight: bold; text-align: right; color: #334155; }
</style>