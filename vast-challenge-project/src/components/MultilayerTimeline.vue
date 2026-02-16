<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as d3 from 'd3';

// --- CONFIGURAZIONE ---
// Props: Nave selezionata, URL dati, e range temporale globale (opzionale)
const props = defineProps(['selectedVessel', 'dataUrl', 'globalStart', 'globalEnd']);
const container = ref(null);    // Riferimento al div grafico
const allTracks = ref({});      // Dati di tutte le navi

// --- STATO INTERATTIVO ---
const tooltipData = ref(null);       // Dati per il tooltip (hover)
const tooltipPos = ref({ x: 0, y: 0 }); // Posizione del tooltip

// Lista ordinata di tutte le location possibili (Asse Y)
const ALL_LOCATIONS = [
    "Haacklee", "Himark", "Lomark", "Paackland", "Port Grove", "South Paackland",
    "Cod Table", "Tuna Shelf", "Wrasse Beds",
    "Exit East", "Exit North", "Exit South", "Exit West",
    "Nav 1", "Nav 2", "Nav 3", 
    "Nav A", "Nav B", "Nav C", "Nav D", "Nav E",
    "Don Limpet Preserve", "Ghoti Preserve", "Nemo Reef"
];

// --- CARICAMENTO DATI ---
onMounted(async () => {
    try {
        const resp = await fetch(props.dataUrl);
        if(!resp.ok) throw new Error(`JSON non trovato`);
        allTracks.value = await resp.json();
        setTimeout(drawChart, 100); // Ritardo per assicurare rendering DOM
        window.addEventListener('resize', drawChart);
    } catch(e) { console.error(e); }
});

onUnmounted(() => window.removeEventListener('resize', drawChart));

// Ridisegna se cambiano input (nave o date)
watch([() => props.selectedVessel, () => props.globalStart, () => props.globalEnd], () => {
    tooltipData.value = null; 
    drawChart();
});

// --- RENDERING D3.JS ---
function drawChart() {
    if (!container.value || !allTracks.value || !allTracks.value[props.selectedVessel]) return;
    
    const el = container.value;
    d3.select(el).selectAll("svg").remove(); // Pulisce vecchio grafico

    const rawData = allTracks.value[props.selectedVessel];
    
    // Margini aumentati in alto per la legenda
    const margin = { top: 60, right: 20, bottom: 50, left: 115 };
    const width = el.clientWidth - margin.left - margin.right;
    const height = el.clientHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    // Setup SVG
    const svg = d3.select(el).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("overflow", "hidden") 
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Clip Path: Maschera per nascondere elementi fuori dall'area grafico durante lo zoom
    svg.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("y", -10).attr("width", width).attr("height", height + 10);

    // --- ZOOM ---
    const zoom = d3.zoom()
        .scaleExtent([1, 50]) // Zoom max 50x
        .extent([[0, 0], [width, height]])
        .translateExtent([[0, 0], [width, height]]) // Limita panning
        .on("zoom", updateChart); // Chiama updateChart al movimento

    // Rettangolo invisibile per catturare eventi mouse zoom
    svg.append("rect")
        .attr("class", "zoom-layer")
        .attr("width", width).attr("height", height)
        .style("fill", "none").style("pointer-events", "all") 
        .call(zoom);

    // Parsing Date
    const parser = d3.timeParse("%Y-%m-%d %H:%M");
    const data = rawData.map(d => ({ ...d, dateObj: parser(d.time) })).filter(d => d.dateObj); 

    // Definizione Dominio X (Tempo)
    let xDomain;
    if (props.globalStart && props.globalEnd) {
        xDomain = [new Date(props.globalStart), new Date(props.globalEnd)];
        xDomain[1].setHours(23, 59, 59);
    } else {
        xDomain = d3.extent(data, d => d.dateObj);
    }
    const x = d3.scaleTime().domain(xDomain).range([0, width]);

    // Scala Y (Categorie Location)
    const y = d3.scalePoint()
        .domain(ALL_LOCATIONS)
        .range([0, height]) 
        .padding(0.7);

    // --- GRIGLIE ---
    // Griglia Orizzontale (Linee tratteggiate per ogni location)
    const yGrid = svg.append("g").attr("class", "grid-y")
        .style("pointer-events", "none") 
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));
    yGrid.select(".domain").remove();
    yGrid.selectAll("line").style("stroke", "#e2e8f0").style("stroke-dasharray", "4,2");

    // Griglia Verticale (Mesi)
    const xGrid = svg.append("g").attr("class", "grid-x")
        .style("pointer-events", "none")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(d3.timeMonth.every(1)).tickSize(-height).tickFormat(""));
    xGrid.select(".domain").remove();
    xGrid.selectAll("line").style("stroke", "#cbd5e1").style("stroke-opacity", 0.5);

    // --- ASSI ---
    const xAxis = svg.append("g").attr("transform", `translate(0,${height})`) 
        .call(d3.axisBottom(x).ticks(5))
        .style("color", "#64748b").style("font-size", "10px");
    xAxis.select(".domain").attr("stroke", "#cbd5e1");

    svg.append("g").call(d3.axisLeft(y))
        .style("color", "#334155").style("font-size", "10px").style("font-weight", "500")
        .select(".domain").remove();

    // Mappa Colori Eventi
    const colorMap = {
        "violation": "#dc2626",   // Rosso
        "suspicious": "#f97316",  // Arancione
        "transit": "#3b82f6",     // Blu
        "port": "#94a3b8"         // Grigio
    };

    // --- DISEGNO BARRE (EVENTI) ---
    const shapesGroup = svg.append("g").attr("clip-path", "url(#clip)");
    const barWidth = 3;  
    const barHeight = 16; 

    const rects = shapesGroup.selectAll("rect")
        .data(data)
        .enter().append("rect")
        .attr("x", d => x(d.dateObj) - barWidth/2) // Posiziona in base al tempo
        .attr("y", d => y(d.loc) ? y(d.loc) - barHeight/2 : -9999) // Posiziona in base alla location
        .attr("width", barWidth).attr("height", barHeight)
        .attr("fill", d => colorMap[d.type] || "#ccc")
        .attr("opacity", 0.85) 
        .style("cursor", "crosshair")
        
        // Hover: Ingrandisce barra e mostra tooltip
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("width", 6).attr("height", 24) // Espande
                .attr("y", parseFloat(d3.select(this).attr("y")) - 4)
                .attr("opacity", 1);
            
            tooltipData.value = d;
            
            // Calcola posizione tooltip relativa al mouse/barra
            const currentX = parseFloat(d3.select(this).attr("x"));
            const currentY = parseFloat(d3.select(this).attr("y")); 
            tooltipPos.value = { 
                x: currentX + margin.left + 3,
                y: currentY + margin.top 
            };
        })
        .on("mouseout", function(event, d) {
            // Ripristina dimensioni originali
            const originalY = y(d.loc) - barHeight/2;
            d3.select(this)
                .attr("width", barWidth).attr("height", barHeight)
                .attr("x", parseFloat(d3.select(this).attr("x")))
                .attr("y", originalY)
                .attr("opacity", 0.85);
            tooltipData.value = null;
        });

    // Funzione chiamata durante lo Zoom/Pan
    function updateChart(event) {
        // Ricalcola scala X
        const newX = event.transform.rescaleX(x);
        
        // Aggiorna asse X e griglia
        xAxis.call(d3.axisBottom(newX).ticks(5));
        xAxis.select(".domain").attr("stroke", "#cbd5e1");
        
        xGrid.call(d3.axisBottom(newX).ticks(d3.timeMonth.every(1)).tickSize(-height).tickFormat(""));
        xGrid.select(".domain").remove();
        xGrid.selectAll("line").style("stroke", "#cbd5e1").style("stroke-opacity", 0.5);

        // Riposiziona le barre
        rects.attr("x", d => newX(d.dateObj) - barWidth/2);
    }
}
</script>

<template>
    <div class="chart-container-relative" ref="container">
        <div class="chart-legend">
            <div class="legend-item"><span class="dot violation"></span> Violation</div>
            <div class="legend-item"><span class="dot suspicious"></span> Suspicious</div>
            <div class="legend-item"><span class="dot transit"></span> Transit</div>
            <div class="legend-item"><span class="dot port"></span> Port</div>
        </div>

        <div v-if="tooltipData" 
             class="custom-tooltip"
             :style="{ top: tooltipPos.y + 'px', left: tooltipPos.x + 'px' }">
            <div class="tt-header">{{ tooltipData.time }}</div>
            <div class="tt-body">
                <div><strong>Loc:</strong> {{ tooltipData.loc }}</div>
                <div><strong>Type:</strong> <span :class="'type-' + tooltipData.type">{{ tooltipData.type }}</span></div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Container grafico */
.chart-container-relative {
    position: relative; width: 100%; height: 100%; 
    background: #fff; cursor: grab; 
}
.chart-container-relative:active { cursor: grabbing; }

/* Legenda in alto a destra */
.chart-legend {
    position: absolute; top: 10px; right: 20px;
    display: flex; gap: 15px;
    background: rgba(255, 255, 255, 0.95);
    padding: 6px 12px; border-radius: 20px; border: 1px solid #e2e8f0;
    z-index: 10; pointer-events: none; 
}
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: #475569; font-weight: 600; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.violation { background: #dc2626; }
.dot.suspicious { background: #f97316; }
.dot.transit { background: #3b82f6; }
.dot.port { background: #94a3b8; }

/* Stile Tooltip */
.custom-tooltip {
    position: absolute; transform: translate(-50%, -115%); 
    background: white; border: 1px solid #94a3b8; border-radius: 6px;
    padding: 8px 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 50; pointer-events: none; min-width: 140px;
}
/* Freccetta tooltip (CSS puro) */
.custom-tooltip::after {
    content: ""; position: absolute; top: 100%; left: 50%; margin-left: -6px;
    border-width: 6px; border-style: solid; border-color: white transparent transparent transparent;
}
</style>