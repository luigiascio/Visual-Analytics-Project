<template>
  <div class="matcher-wrapper">
    
    <div class="analytics-card">
      
      <div class="card-header">
        <div class="header-left">
          <h3>Cargo Traffic Monitor</h3>
          <span class="stat-badge">
            <strong>{{ filteredData.length }}</strong> Records
          </span>
        </div>

        <div class="header-controls">
          <div class="control-item">
            <label>Filter Category</label>
            <div class="select-wrapper">
              <select v-model="selectedCommodity">
                <option value="ALL_SUSPECT">⚠️ All Suspect Activity</option>
                <option value="">All Products</option>
                <option v-for="item in distinctCommodities" :key="item" :value="item">
                  {{ item }}
                </option>
              </select>
            </div>
          </div>

          <div class="control-item">
            <label>Time Range</label>
            <div class="date-wrapper">
              <input type="date" v-model="startDate" />
              <span class="arrow">→</span>
              <input type="date" v-model="endDate" />
            </div>
          </div>
        </div>
      </div>

      <div class="chart-section">
        
        <div v-if="loading" class="overlay-msg">Processing Data...</div>
        <div v-else-if="filteredData.length === 0" class="overlay-msg">
            No data found for this selection.
        </div>

        <div ref="chartRef" class="d3-container"></div>
        <div ref="tooltipRef" class="custom-tooltip"></div>

        <div class="custom-legend">
          <div class="legend-group">
            <span class="legend-title">Classification:</span>
            <div class="legend-item"><span class="dot" style="background:#6366f1"></span> Suspect (Ghoti Preserve)</div>
            <div class="legend-item"><span class="dot" style="background:#8b5cf6"></span> Suspect (Nemo Reef)</div>
            <div class="legend-item"><span class="dot" style="background:#0ea5e9"></span> Legal (Cod)</div>
            <div class="legend-item"><span class="dot" style="background:#10b981"></span> Legal (Tuna)</div>
            <div class="legend-item"><span class="dot" style="background:#06b6d4"></span> Legal (Other)</div>
          </div>
          <div class="legend-group">
            <span class="legend-title">Anomalies:</span>
            <div class="legend-item">
              <span class="triangle-icon"></span> Negative Qty
            </div>
          </div>
        </div>
      </div>
    </div>

    <transition name="slide-up">
      <div class="details-panel" v-if="selectedReport">
        
        <div class="details-header">
          <h3>Report ID: <span class="highlight">{{ selectedReport.report_id }}</span></h3>
          <button @click="selectedReport = null" class="close-btn">Close ✕</button>
        </div>
        
        <div class="report-info">
          <div class="info-pill" :style="{ backgroundColor: getColor(selectedReport.commodity), color: 'white' }">
            {{ selectedReport.commodity }}
          </div>
          <div class="info-pill" :class="{ 'negative-pill': selectedReport.qty_tons < 0 }">
            {{ formatQty(selectedReport.qty_tons) }} Tons
          </div>
          <div class="info-pill date-pill">
            {{ formatDate(selectedReport.dateObj) }}
          </div>
        </div>

        <h4>Candidate Vessels ({{ selectedReport.candidates.length }})</h4>
        
        <div class="candidates-grid">
          <div v-for="(vessel, idx) in selectedReport.candidates" :key="idx" class="vessel-card">
            <div class="v-head">
              <strong>{{ vessel.vessel_name }}</strong>
              <span class="v-flag">{{ vessel.flag }}</span>
            </div>
            <div class="v-body">
              <p>Company: {{ vessel.company }}</p>
              <div class="provenance" :class="{ 'alert-purple': (vessel.probable_cargo || '').toLowerCase().includes('suspect') }">
                <span class="icon" v-if="(vessel.probable_cargo || '').toLowerCase().includes('suspect')">⚠️</span>
                from <strong>{{ vessel.provenance }}</strong>
              </div>
            </div>
          </div>
        </div>

      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import * as d3 from 'd3';

const props = defineProps(['data']);

// --- STATE ---
const chartRef = ref(null);
const tooltipRef = ref(null);
const selectedCommodity = ref('ALL_SUSPECT');
const startDate = ref('');
const endDate = ref('');
const selectedReport = ref(null);
const loading = ref(false);

// --- UTILS (COLORI) ---
const getColor = (commodity) => {
  const c = (commodity || "").toLowerCase();
  if (c.includes('suspect')) {
    if (c.includes('tuna') || c.includes('mixed')) return '#6366f1'; // Indaco
    return '#8b5cf6'; // Viola chiaro
  }
  if (c.includes('cod')) return '#0ea5e9'; // Azzurro cielo
  if (c.includes('tuna')) return '#10b981'; // Verde acqua
  if (c.includes('wrasse') || c.includes('salmon')) return '#06b6d4'; // Ciano
  return '#94a3b8'; // Grigio
};

const formatQty = (val) => {
    if (val === null || val === undefined) return "0";
    return Number(val).toFixed(2);
};

// --- DATA PARSING ---
const parsedData = computed(() => {
  if (!props.data || !Array.isArray(props.data)) return [];
  const parser = d3.timeParse("%Y-%m-%d %H:%M:%S");

  return props.data.map(d => {
    let comm = d.commodity;
    if (!comm || comm === 'nan' || comm === 'null') comm = 'Unknown';
    let finalDate = d.dateObj;
    if (!finalDate || !(finalDate instanceof Date) || isNaN(finalDate)) {
        finalDate = parser(d.date) || new Date(d.date);
    }
    let qty = +d.qty_tons;
    if (isNaN(qty)) qty = 0;

    return { ...d, commodity: comm, dateObj: finalDate, qty_tons: qty };
  }).filter(d => d.dateObj instanceof Date && !isNaN(d.dateObj));
});

const distinctCommodities = computed(() => 
  [...new Set(parsedData.value.map(d => d.commodity))].sort()
);

const filteredData = computed(() => {
  if (!startDate.value || !endDate.value) return [];
  const start = new Date(startDate.value);
  const end = new Date(endDate.value);
  end.setHours(23, 59, 59);

  return parsedData.value.filter(d => {
    let validComm = true;
    if (selectedCommodity.value === 'ALL_SUSPECT') {
      validComm = d.commodity.toLowerCase().includes('suspect');
    } else if (selectedCommodity.value) {
      validComm = d.commodity === selectedCommodity.value;
    }
    const validDate = d.dateObj >= start && d.dateObj <= end;
    return validComm && validDate;
  });
});

watch(() => props.data, async (newData) => {
  if (newData && newData.length > 0) {
    loading.value = true;
    if (!startDate.value) {
        const dates = parsedData.value.map(d => d.dateObj);
        if (dates.length > 0) {
            const minD = new Date(Math.min(...dates));
            const maxD = new Date(Math.max(...dates));
            startDate.value = minD.toISOString().split('T')[0];
            endDate.value = maxD.toISOString().split('T')[0];
        }
    }
    await nextTick();
    drawChart();
    loading.value = false;
  }
}, { immediate: true, deep: true });

watch([selectedCommodity, startDate, endDate], () => {
  selectedReport.value = null; 
  drawChart();
});

const formatDate = d3.timeFormat("%d %b %Y");

// --- D3 CHART ---
const drawChart = () => {
  const container = chartRef.value;
  if (!container) return;
  d3.select(container).selectAll("*").remove();

  const data = filteredData.value;
  if (!data.length) return;

  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  const width = container.clientWidth - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  if (width <= 0) return;

  const svg = d3.select(container).append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime().domain(d3.extent(data, d => d.dateObj)).range([0, width]);
  const yExtent = d3.extent(data, d => d.qty_tons);
  const yMin = Math.min(0, (yExtent[0] || 0) * 1.1);
  const yMax = Math.max(0, (yExtent[1] || 100) * 1.1);
  const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

  const xGrid = d3.axisBottom(x).ticks(10).tickSize(-height).tickFormat("");
  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height})`)
      .style("opacity", 0.05).call(xGrid);

  const xAxis = d3.axisBottom(x).ticks(Math.max(5, Math.floor(width/80))).tickFormat(d3.timeFormat("%d %b"));
  svg.append("g").attr("transform", `translate(0,${height})`).call(xAxis).style("color", "#64748b");
  svg.append("g").call(d3.axisLeft(y)).style("color", "#64748b");

  svg.append("line").attr("x1",0).attr("x2",width).attr("y1",y(0)).attr("y2",y(0))
      .attr("stroke","#cbd5e1").attr("stroke-dasharray","4");

  svg.append("text").attr("transform", "rotate(-90)").attr("y", -45).attr("x", -height/2)
      .attr("text-anchor", "middle").style("fill", "#64748b").style("font-size", "12px").text("Quantity (Tons)");

  const tooltip = d3.select(tooltipRef.value);

  const triangle = d3.symbol().type(d3.symbolTriangle).size(60);
  const circle = d3.symbol().type(d3.symbolCircle).size(60);

  svg.selectAll(".point")
    .data(data)
    .enter().append("path")
    .attr("class", "point")
    .attr("d", d => d.qty_tons < 0 ? triangle() : circle())
    .attr("transform", d => `translate(${x(d.dateObj)}, ${y(d.qty_tons)}) ${d.qty_tons < 0 ? 'rotate(180)' : ''}`) 
    // MODIFICA QUI: Uso sempre il colore della commodity
    .attr("fill", d => getColor(d.commodity)) 
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .style("cursor", "pointer")
    .style("opacity", 0.8)
    .on("mouseover", function(event, d) {
       d3.select(this)
         .transition().duration(100)
         .attr("d", d3.symbol().type(d.qty_tons < 0 ? d3.symbolTriangle : d3.symbolCircle).size(150)) 
         .style("opacity", 1);
       
       tooltip.style("opacity", 1)
         .html(`
            <strong>${d.report_id}</strong><br>
            ${d.commodity}<br>
            <span>${formatQty(d.qty_tons)} tons</span>
         `)
         .style("left", (event.pageX + 10) + "px")
         .style("top", (event.pageY - 30) + "px");
    })
    .on("mouseout", function(event) {
       const isSelected = selectedReport.value && selectedReport.value.report_id === d3.select(this).datum().report_id;
       if (!isSelected) {
         d3.select(this)
           .transition().duration(100)
           .attr("d", d3.symbol().type(d3.select(this).datum().qty_tons < 0 ? d3.symbolTriangle : d3.symbolCircle).size(60)) 
           .style("opacity", 0.8);
       }
       tooltip.style("opacity", 0);
    })
    .on("click", function(event, d) {
       selectedReport.value = d;
       svg.selectAll(".point")
          .attr("d", p => d3.symbol().type(p.qty_tons < 0 ? d3.symbolTriangle : d3.symbolCircle).size(60)())
          .style("opacity", 0.8)
          .attr("stroke", "white").attr("stroke-width", 1);
       
       d3.select(this)
          .attr("d", d3.symbol().type(d.qty_tons < 0 ? d3.symbolTriangle : d3.symbolCircle).size(200)())
          .style("opacity", 1)
          .attr("stroke", "#2c3e50").attr("stroke-width", 2);
    });
};

onMounted(() => window.addEventListener('resize', drawChart));
</script>

<style scoped>
.matcher-wrapper { width: 100%; }

.analytics-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 25px;
  border-bottom: 1px solid #e2e8f0;
  background-color: #fff;
}

.header-left h3 { margin: 0; color: #2c3e50; font-size: 1.2rem; font-weight: 700; }
.stat-badge { background: #f1f5f9; color: #64748b; font-size: 0.8rem; padding: 2px 8px; border-radius: 4px; margin-top: 4px; display: inline-block; }

.header-controls { display: flex; gap: 20px; }
.control-item label { font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; display: block; }
.select-wrapper select { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; color: #334155; background: white; cursor: pointer; }
.date-wrapper { display: flex; align-items: center; gap: 5px; background: white; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 6px; }
.date-wrapper input { border: none; font-family: inherit; color: #334155; outline: none; font-size: 0.9rem; }
.arrow { color: #94a3b8; font-size: 0.8rem; }

.chart-section { position: relative; background: #fdfdfd; padding: 20px; min-height: 400px; }
.d3-container { width: 100%; height: 400px; }
.overlay-msg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #94a3b8; }
.custom-tooltip { position: absolute; background: rgba(44, 62, 80, 0.95); color: white; padding: 8px 12px; border-radius: 6px; pointer-events: none; font-size: 0.8rem; opacity: 0; transition: opacity 0.2s; z-index: 50; }

.custom-legend { display: flex; gap: 30px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 0.8rem; justify-content: center; }
.legend-group { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.legend-title { font-weight: bold; margin-right: 5px; color: #475569; }
.legend-item { display: flex; align-items: center; color: #64748b; }
.dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; }

/* LEGENDA TRIANGOLO NEUTRA (GRIGIO SCURO) */
.triangle-icon {
  width: 0; 
  height: 0; 
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 8px solid #475569; /* Triangolo Grigio Scuro */
  margin-right: 5px;
}

.details-panel {
  background: white;
  padding: 20px;
  border-radius: 12px; 
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  border: 1px solid #e2e8f0;
  margin-top: 20px;
}

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(20px); }

.details-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
.highlight { color: #3b82f6; font-family: monospace; }
.close-btn { background: transparent; border: 1px solid #cbd5e1; padding: 4px 12px; border-radius: 4px; color: #64748b; cursor: pointer; }
.close-btn:hover { color: #ef4444; border-color: #ef4444; background: #fee2e2; }

.report-info { display: flex; gap: 10px; margin-bottom: 20px; }
.info-pill { padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 0.85rem; }
.negative-pill { background-color: #f8fafc; color: #475569; border: 1px solid #94a3b8; } /* Pill neutra per negativo */
.date-pill { background-color: #f1f5f9; color: #475569; }

.candidates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 15px;
}

.vessel-card {
  border: 1px solid #e2e8f0;
  padding: 12px;
  border-radius: 6px;
  background: #f8fafc;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.v-head { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.95rem; }
.v-flag { background: #e2e8f0; padding: 1px 6px; border-radius: 4px; font-size: 0.75rem; color: #64748b; }
.v-body { font-size: 0.85rem; color: #64748b; }

.provenance { margin-top: 8px; padding: 6px; background: #fff; border-left: 3px solid #cbd5e1; border-radius: 2px; font-size: 0.85rem; }
.provenance.alert-purple { border-left-color: #8b5cf6; color: #5b21b6; background: #f5f3ff; }
.icon { margin-right: 4px; }
</style>