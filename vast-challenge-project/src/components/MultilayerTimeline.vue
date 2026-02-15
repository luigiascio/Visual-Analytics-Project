<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as d3 from 'd3';

const props = defineProps(['selectedVessel', 'dataUrl', 'globalStart', 'globalEnd']);
const container = ref(null);
const allTracks = ref({});

// STATO TOOLTIP
const tooltipData = ref(null); 
const tooltipPos = ref({ x: 0, y: 0 }); 

const ALL_LOCATIONS = [
    "Haacklee", "Himark", "Lomark", "Paackland", "Port Grove", "South Paackland",
    "Cod Table", "Tuna Shelf", "Wrasse Beds",
    "Exit East", "Exit North", "Exit South", "Exit West",
    "Nav 1", "Nav 2", "Nav 3", 
    "Nav A", "Nav B", "Nav C", "Nav D", "Nav E",
    "Don Limpet Preserve", "Ghoti Preserve", "Nemo Reef"
];

onMounted(async () => {
    try {
        const resp = await fetch(props.dataUrl);
        if(!resp.ok) throw new Error(`JSON non trovato: ${props.dataUrl}`);
        allTracks.value = await resp.json();
        setTimeout(drawChart, 100);
        window.addEventListener('resize', drawChart);
    } catch(e) { console.error(e); }
});

onUnmounted(() => window.removeEventListener('resize', drawChart));

watch([() => props.selectedVessel, () => props.globalStart, () => props.globalEnd], () => {
    tooltipData.value = null; 
    drawChart();
});

function drawChart() {
    if (!container.value || !allTracks.value || !allTracks.value[props.selectedVessel]) return;
    
    const el = container.value;
    d3.select(el).selectAll("svg").remove(); 

    const rawData = allTracks.value[props.selectedVessel];
    
    // 1. MODIFICA QUI: Aumentato margin.top a 60 per fare spazio alla legenda
    const margin = { top: 60, right: 20, bottom: 50, left: 115 };
    
    const width = el.clientWidth - margin.left - margin.right;
    const height = el.clientHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const svg = d3.select(el).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("overflow", "hidden") 
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Clip Path
    svg.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("y", -10)
        .attr("width", width)
        .attr("height", height + 10);

    // ZOOM LAYER
    const zoom = d3.zoom()
        .scaleExtent([1, 50]) 
        .extent([[0, 0], [width, height]])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", updateChart);

    svg.append("rect")
        .attr("class", "zoom-layer")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all") 
        .call(zoom);

    // Parse Data
    const parser = d3.timeParse("%Y-%m-%d %H:%M");
    const data = rawData.map(d => ({ ...d, dateObj: parser(d.time) })).filter(d => d.dateObj); 

    let xDomain;
    if (props.globalStart && props.globalEnd) {
        xDomain = [new Date(props.globalStart), new Date(props.globalEnd)];
        xDomain[1].setHours(23, 59, 59);
    } else {
        xDomain = d3.extent(data, d => d.dateObj);
    }
    const x = d3.scaleTime().domain(xDomain).range([0, width]);

    const y = d3.scalePoint()
        .domain(ALL_LOCATIONS)
        .range([0, height]) 
        .padding(0.7);

    // GRIDS
    const yGrid = svg.append("g").attr("class", "grid-y")
        .style("pointer-events", "none") 
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));
    yGrid.select(".domain").remove();
    yGrid.selectAll("line").style("stroke", "#e2e8f0").style("stroke-dasharray", "4,2");

    const xGrid = svg.append("g").attr("class", "grid-x")
        .style("pointer-events", "none")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(d3.timeMonth.every(1)).tickSize(-height).tickFormat(""));
    xGrid.select(".domain").remove();
    xGrid.selectAll("line").style("stroke", "#cbd5e1").style("stroke-opacity", 0.5);

    // AXES
    const xAxis = svg.append("g").attr("transform", `translate(0,${height})`) 
        .call(d3.axisBottom(x).ticks(5))
        .style("color", "#64748b").style("font-size", "10px");
    xAxis.select(".domain").attr("stroke", "#cbd5e1");

    svg.append("g").call(d3.axisLeft(y))
        .style("color", "#334155").style("font-size", "10px").style("font-weight", "500")
        .select(".domain").remove();

    const colorMap = {
        "violation": "#dc2626",   
        "suspicious": "#f97316",  
        "transit": "#3b82f6",     
        "port": "#94a3b8"         
    };

    // BARS
    const shapesGroup = svg.append("g").attr("clip-path", "url(#clip)");
    const barWidth = 3;  
    const barHeight = 16; 

    const rects = shapesGroup.selectAll("rect")
        .data(data)
        .enter().append("rect")
        .attr("x", d => x(d.dateObj) - barWidth/2)
        .attr("y", d => y(d.loc) ? y(d.loc) - barHeight/2 : -9999)
        .attr("width", barWidth)
        .attr("height", barHeight)
        .attr("fill", d => colorMap[d.type] || "#ccc")
        .attr("opacity", 0.85) 
        .style("cursor", "crosshair")
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("width", 6)
                .attr("height", 24)
                .attr("y", parseFloat(d3.select(this).attr("y")) - 4)
                .attr("opacity", 1);
            
            tooltipData.value = d;
            
            const currentX = parseFloat(d3.select(this).attr("x"));
            const currentY = parseFloat(d3.select(this).attr("y")); 

            tooltipPos.value = { 
                x: currentX + margin.left + 3,
                y: currentY + margin.top 
            };
        })
        .on("mouseout", function(event, d) {
            const originalY = y(d.loc) - barHeight/2;
            d3.select(this)
                .attr("width", barWidth)
                .attr("height", barHeight)
                .attr("x", parseFloat(d3.select(this).attr("x")))
                .attr("y", originalY)
                .attr("opacity", 0.85);
            
            tooltipData.value = null;
        });

    function updateChart(event) {
        const newX = event.transform.rescaleX(x);
        xAxis.call(d3.axisBottom(newX).ticks(5));
        xAxis.select(".domain").attr("stroke", "#cbd5e1");
        
        xGrid.call(d3.axisBottom(newX).ticks(d3.timeMonth.every(1)).tickSize(-height).tickFormat(""));
        xGrid.select(".domain").remove();
        xGrid.selectAll("line").style("stroke", "#cbd5e1").style("stroke-opacity", 0.5);

        rects.attr("x", d => newX(d.dateObj) - barWidth/2);
    }
}
</script>

<template>
    <div class="chart-container-relative" ref="container">
        <div class="chart-legend">
            <div class="legend-item">
                <span class="dot violation"></span>
                <span>Violation</span>
            </div>
            <div class="legend-item">
                <span class="dot suspicious"></span>
                <span>Suspicious</span>
            </div>
            <div class="legend-item">
                <span class="dot transit"></span>
                <span>Transit</span>
            </div>
            <div class="legend-item">
                <span class="dot port"></span>
                <span>Port</span>
            </div>
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
.chart-container-relative {
    position: relative; 
    width: 100%; 
    height: 100%; 
    background: #fff;
    cursor: grab; 
}
.chart-container-relative:active { cursor: grabbing; }

/* LEGENDA: Posizionata in alto a destra */
.chart-legend {
    position: absolute;
    top: 10px; /* Rimane in cima */
    right: 20px;
    display: flex;
    gap: 15px;
    background: rgba(255, 255, 255, 0.95);
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    z-index: 10;
    pointer-events: none; 
}
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: #475569; font-weight: 600; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.violation { background: #dc2626; }
.dot.suspicious { background: #f97316; }
.dot.transit { background: #3b82f6; }
.dot.port { background: #94a3b8; }

/* TOOLTIP */
.custom-tooltip {
    position: absolute;
    transform: translate(-50%, -115%); 
    background: white;
    border: 1px solid #94a3b8;
    border-radius: 6px;
    padding: 8px 12px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 50;
    pointer-events: none; 
    min-width: 140px;
}

.custom-tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -6px;
    border-width: 6px;
    border-style: solid;
    border-color: white transparent transparent transparent;
}
.custom-tooltip::before {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -7px;
    border-width: 7px;
    border-style: solid;
    border-color: #94a3b8 transparent transparent transparent;
}

.tt-header {
    font-size: 0.85rem;
    font-weight: 700;
    color: #334155;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
    margin-bottom: 4px;
}
.tt-body { font-size: 0.8rem; color: #475569; }
.type-violation { color: #dc2626; font-weight: bold; }
.type-suspicious { color: #d97706; font-weight: bold; }
.type-transit { color: #2563eb; }
.type-port { color: #64748b; }
</style>