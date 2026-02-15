<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import * as d3 from 'd3';

// PROPS
const props = defineProps(['selectedVessel', 'dataUrl']);
const emit = defineEmits(['update-range']);

// STATE
const container = ref(null);
const vesselTracks = ref({});
const selectionStart = ref(null); 
const selectionEnd = ref(null);   

const COLORS = {
    violation: "#e74c3c",   
    suspicious: "#f39c12",  
    port: "#95a5a6",        
    transit: "#3498db",     
    empty: "#ecf0f1"        
};

function getPriority(type) {
    if (type === 'violation') return 5;
    if (type === 'suspicious') return 3;
    if (type === 'port') return 2;
    if (type === 'transit') return 1;
    return 0;
}

// FETCH DATA
onMounted(async () => {
    try {
        const url = props.dataUrl || '/south_seafood_pings.json';
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Errore caricamento JSON da ${url}`);
        
        const rawTracks = await resp.json();
        const processed = {};
        Object.keys(rawTracks).forEach(name => {
            const dailyMap = new Map();
            rawTracks[name].forEach(p => {
                const dateKey = p.time.split(' ')[0];
                const hour = new Date(p.time).getHours();
                const slot = hour < 12 ? 'AM' : 'PM';
                if (!dailyMap.has(dateKey)) {
                    dailyMap.set(dateKey, { AM: {priority:-1, status:'empty'}, PM: {priority:-1, status:'empty'} });
                }
                const dayData = dailyMap.get(dateKey);
                const currentPrio = getPriority(p.type);
                if (currentPrio > dayData[slot].priority) {
                    dayData[slot] = { priority: currentPrio, status: p.type, details: p.loc };
                }
            });
            processed[name] = dailyMap;
        });

        vesselTracks.value = processed;
        await nextTick();
        drawCalendar();

    } catch (e) { console.error(e); }
});

watch(() => props.selectedVessel, async () => {
    selectionStart.value = null;
    selectionEnd.value = null;
    await nextTick();
    drawCalendar();
});

// --- DRAWING LOGIC ---
function drawCalendar() {
    if (!container.value || !props.selectedVessel || !vesselTracks.value[props.selectedVessel]) return;
    
    d3.select(container.value).selectAll("*").remove();

    // DIMENSIONI AUMENTATE (Slightly Larger)
    const daySize = 19; // Era 15
    const cellGap = 4;  // Era 3
    const margin = { top: 30, right: 20, bottom: 20, left: 40 };
    
    const width = 53 * (daySize + cellGap) + margin.left + margin.right; 
    const height = 7 * (daySize + cellGap) + margin.top + margin.bottom; 

    const svg = d3.select(container.value).append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("font-family", "Segoe UI, sans-serif");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const dataMap = vesselTracks.value[props.selectedVessel];
    const startDate = new Date("2035-01-01");
    const endDate = new Date("2035-12-31");
    const days = d3.timeDays(startDate, endDate);

    // Labels Giorni
    const weekDays = ["Mon", "Wed", "Fri"];
    const weekDayIndices = [1, 3, 5]; 
    g.selectAll(".label-day").data(weekDayIndices).enter().append("text")
        .attr("x", -8)
        .attr("y", d => d * (daySize + cellGap) + daySize / 1.5)
        .attr("text-anchor", "end")
        .text((d, i) => weekDays[i])
        .attr("font-size", "12px") // Font leggermente più grande
        .attr("fill", "#94a3b8");

    // Labels Mesi
    const months = d3.timeMonths(startDate, endDate);
    g.selectAll(".label-month").data(months).enter().append("text")
        .attr("x", d => d3.timeWeek.count(d3.timeYear(d), d) * (daySize + cellGap))
        .attr("y", -10)
        .text(d3.timeFormat("%b"))
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .attr("fill", "#475569");

    // Gruppi Giorni
    const dayGroups = g.selectAll("g.day").data(days).enter().append("g")
        .attr("transform", d => `translate(${d3.timeWeek.count(d3.timeYear(d), d) * (daySize + cellGap)}, ${d.getDay() * (daySize + cellGap)})`);

    // Helper per disegnare gli slot
    const drawSlot = (selection, slotType, yPos) => {
        // Rettangolo colorato (stato)
        selection.append("rect")
            .attr("width", daySize)
            .attr("height", (daySize/2) - 0.5)
            .attr("y", yPos)
            .attr("rx", 2) // Arrotondamento leggermente maggiore
            .attr("fill", d => getColor(d, slotType, dataMap));

        // Rettangolo interazione (overlay)
        selection.append("rect")
            .attr("class", `slot-${slotType}`)
            .attr("width", daySize)
            .attr("height", (daySize/2) - 0.5)
            .attr("y", yPos)
            .attr("rx", 2)
            .attr("fill", d => getOverlayFill(d, slotType))
            .attr("stroke", d => getOverlayStroke(d, slotType))
            .attr("stroke-width", 2.5) // Bordo di selezione più evidente
            .style("cursor", "pointer")
            .on("click", (event, d) => handleSlotClick(d, slotType))
            .append("title").text(d => `${d.toLocaleDateString()} ${slotType}`);
    };

    drawSlot(dayGroups, 'AM', 0);
    drawSlot(dayGroups, 'PM', (daySize/2) + 1);
}

// LOGICA CLICK
function handleSlotClick(dateObj, slot) {
    const clickedTs = new Date(dateObj).setHours(slot === 'AM' ? 0 : 12, 0, 0, 0);

    if (!selectionStart.value || (selectionStart.value && selectionEnd.value)) {
        selectionStart.value = clickedTs;
        selectionEnd.value = null;
    } else {
        if (clickedTs < selectionStart.value) {
            selectionEnd.value = selectionStart.value;
            selectionStart.value = clickedTs;
        } else {
            selectionEnd.value = clickedTs;
        }
        const endRange = selectionEnd.value + (12 * 60 * 60 * 1000) - 1;
        emit('update-range', { start: selectionStart.value, end: endRange });
    }
    updateSelectionVisuals();
}

function updateSelectionVisuals() {
    if (!container.value) return;
    const svg = d3.select(container.value);
    
    svg.selectAll(".slot-AM")
        .attr("fill", d => getOverlayFill(d, 'AM'))
        .attr("stroke", d => getOverlayStroke(d, 'AM'));

    svg.selectAll(".slot-PM")
        .attr("fill", d => getOverlayFill(d, 'PM'))
        .attr("stroke", d => getOverlayStroke(d, 'PM'));
}

function getOverlayStroke(d, slot) {
    const ts = new Date(d).setHours(slot === 'AM' ? 0 : 12, 0, 0, 0);
    if (ts === selectionStart.value || ts === selectionEnd.value) return "#22c55e";
    return "none";
}

function getOverlayFill(d, slot) {
    const ts = new Date(d).setHours(slot === 'AM' ? 0 : 12, 0, 0, 0);
    const s = selectionStart.value;
    const e = selectionEnd.value;
    if (s && ts === s) return "transparent"; 
    if (e && ts === e) return "transparent"; 
    if (s && e && ts > s && ts < e) return "rgba(34, 197, 94, 0.4)"; 
    return "transparent";
}

function getColor(d, slot, map) {
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d - offset)).toISOString().slice(0, -1);
    const key = localISOTime.split('T')[0];
    const entry = map?.get(key);
    if (!entry) return COLORS.empty;
    return COLORS[entry[slot].status] || COLORS.empty;
}
</script>

<template>
  <div class="calendar-component">
    
    <div class="calendar-header">
        <div class="legend">
            <div class="item"><span class="box red"></span> Violation</div>
            <div class="item"><span class="box orange"></span> Suspicious</div>
            <div class="item"><span class="box blue"></span> Transit</div>
            <div class="item"><span class="box gray"></span> Port</div>
            <div class="item"><span class="box green-border"></span> Selected Range</div>
        </div>
        
        <div class="instructions">
            Click AM/PM slots to filter map
        </div>
    </div>

    <div ref="container" class="viz-area"></div>
  </div>
</template>

<style scoped>
.calendar-component { 
    display: flex; 
    flex-direction: column; 
    width: 100%;
}

.calendar-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 10px; 
}

.instructions { 
    font-size: 0.8rem; 
    color: #64748b; 
    font-style: italic;
}

.viz-area { 
    overflow-x: auto; /* Permette lo scroll se il calendario è più largo dello schermo */
    margin-bottom: -5px; 
    /* Bordo opzionale per delimitare l'area */
    /* border: 1px solid #f1f5f9; */
    border-radius: 4px;
}

.legend { display: flex; gap: 12px; font-size: 0.8rem; color: #475569; font-weight: 500; }
.item { display: flex; align-items: center; }
.box { width: 12px; height: 12px; margin-right: 5px; border-radius: 2px; }

.red { background: #e74c3c; } 
.orange { background: #f39c12; } 
.gray { background: #95a5a6; } 
.blue { background: #3498db; }
.green-border { border: 2px solid #22c55e; background: transparent; width: 12px; height: 7px;}
</style>