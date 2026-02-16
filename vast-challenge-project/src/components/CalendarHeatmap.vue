<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import * as d3 from 'd3';

// --- CONFIGURAZIONE ---
const props = defineProps(['selectedVessel', 'dataUrl']); // Input: Nave e file dati
const emit = defineEmits(['update-range']);               // Output: Evento cambio date

// --- STATO ---
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

// --- LOGICA PRIORITÀ ---
// Se ci sono più eventi, vince il più grave (Violazione > Transito)
function getPriority(type) {
    if (type === 'violation') return 5;
    if (type === 'suspicious') return 3;
    if (type === 'port') return 2;
    if (type === 'transit') return 1;
    return 0;
}

// --- CARICAMENTO DATI ---
onMounted(async () => {
    try {
        const url = props.dataUrl || '/south_seafood_pings.json';
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Errore JSON`);
        
        const rawTracks = await resp.json();
        const processed = {};

        // Raggruppa i ping per Giorno e Slot (AM/PM)
        Object.keys(rawTracks).forEach(name => {
            const dailyMap = new Map();
            rawTracks[name].forEach(p => {
                const dateKey = p.time.split(' ')[0];
                const hour = new Date(p.time).getHours();
                const slot = hour < 12 ? 'AM' : 'PM';

                if (!dailyMap.has(dateKey)) {
                    dailyMap.set(dateKey, { AM: {priority:-1, status:'empty'}, PM: {priority:-1, status:'empty'} });
                }

                // Sovrascrive solo se l'evento nuovo è più grave
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
        drawCalendar(); // Avvia disegno D3

    } catch (e) { console.error(e); }
});

// Ridisegna se cambia la nave
watch(() => props.selectedVessel, async () => {
    selectionStart.value = null; // Reset selezione
    selectionEnd.value = null;
    await nextTick();
    drawCalendar();
});

// --- RENDERING D3.JS ---
function drawCalendar() {
    if (!container.value || !props.selectedVessel || !vesselTracks.value[props.selectedVessel]) return;
    
    d3.select(container.value).selectAll("*").remove(); // Pulisce SVG precedente

    // Configurazione Layout
    const daySize = 19; 
    const cellGap = 4;
    const margin = { top: 30, right: 20, bottom: 20, left: 40 };
    const width = 53 * (daySize + cellGap) + margin.left + margin.right; 
    const height = 7 * (daySize + cellGap) + margin.top + margin.bottom; 

    const svg = d3.select(container.value).append("svg")
        .attr("width", width).attr("height", height)
        .style("font-family", "Segoe UI, sans-serif");

    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    const dataMap = vesselTracks.value[props.selectedVessel];
    const days = d3.timeDays(new Date("2035-01-01"), new Date("2035-12-31")); // Genera giorni anno

    // Labels Giorni (Lun, Mer, Ven)
    const weekDays = ["Mon", "Wed", "Fri"];
    g.selectAll(".label-day").data([1, 3, 5]).enter().append("text")
        .attr("x", -8).attr("y", d => d * (daySize + cellGap) + daySize / 1.5)
        .attr("text-anchor", "end").text((d, i) => weekDays[i])
        .attr("font-size", "12px").attr("fill", "#94a3b8");

    // Labels Mesi (Jan, Feb...)
    g.selectAll(".label-month").data(d3.timeMonths(new Date("2035-01-01"), new Date("2035-12-31"))).enter().append("text")
        .attr("x", d => d3.timeWeek.count(d3.timeYear(d), d) * (daySize + cellGap))
        .attr("y", -10).text(d3.timeFormat("%b"))
        .attr("font-size", "12px").attr("font-weight", "600").attr("fill", "#475569");

    // Gruppo per ogni giorno posizionato a griglia
    const dayGroups = g.selectAll("g.day").data(days).enter().append("g")
        .attr("transform", d => `translate(${d3.timeWeek.count(d3.timeYear(d), d) * (daySize + cellGap)}, ${d.getDay() * (daySize + cellGap)})`);

    // Helper disegno slot (AM o PM)
    const drawSlot = (selection, slotType, yPos) => {
        // Rettangolo Stato (Colore)
        selection.append("rect")
            .attr("width", daySize).attr("height", (daySize/2) - 0.5).attr("y", yPos).attr("rx", 2)
            .attr("fill", d => getColor(d, slotType, dataMap));

        // Rettangolo Interazione (Click + Bordo Selezione)
        selection.append("rect")
            .attr("class", `slot-${slotType}`)
            .attr("width", daySize).attr("height", (daySize/2) - 0.5).attr("y", yPos).attr("rx", 2)
            .attr("fill", d => getOverlayFill(d, slotType))     // Sfondo verde se selezionato
            .attr("stroke", d => getOverlayStroke(d, slotType)) // Bordo verde
            .attr("stroke-width", 2.5)
            .style("cursor", "pointer")
            .on("click", (event, d) => handleSlotClick(d, slotType))
            .append("title").text(d => `${d.toLocaleDateString()} ${slotType}`);
    };

    drawSlot(dayGroups, 'AM', 0);
    drawSlot(dayGroups, 'PM', (daySize/2) + 1);
}

// --- GESTIONE INTERAZIONE ---
function handleSlotClick(dateObj, slot) {
    const clickedTs = new Date(dateObj).setHours(slot === 'AM' ? 0 : 12, 0, 0, 0);

    // Logica inizio/fine selezione
    if (!selectionStart.value || (selectionStart.value && selectionEnd.value)) {
        selectionStart.value = clickedTs; // Nuovo inizio
        selectionEnd.value = null;
    } else {
        if (clickedTs < selectionStart.value) { // Inversione se clicco indietro
            selectionEnd.value = selectionStart.value;
            selectionStart.value = clickedTs;
        } else {
            selectionEnd.value = clickedTs;
        }
        // Emette evento al padre
        const endRange = selectionEnd.value + (12 * 60 * 60 * 1000) - 1;
        emit('update-range', { start: selectionStart.value, end: endRange });
    }
    updateSelectionVisuals();
}

// Aggiorna solo colori selezione (più veloce di ridisegnare tutto)
function updateSelectionVisuals() {
    if (!container.value) return;
    const svg = d3.select(container.value);
    
    ['AM', 'PM'].forEach(slot => {
        svg.selectAll(`.slot-${slot}`)
            .attr("fill", d => getOverlayFill(d, slot))
            .attr("stroke", d => getOverlayStroke(d, slot));
    });
}

// Bordo Verde (Start/End)
function getOverlayStroke(d, slot) {
    const ts = new Date(d).setHours(slot === 'AM' ? 0 : 12, 0, 0, 0);
    if (ts === selectionStart.value || ts === selectionEnd.value) return "#22c55e";
    return "none";
}

// Sfondo Verde Trasparente (Range interno)
function getOverlayFill(d, slot) {
    const ts = new Date(d).setHours(slot === 'AM' ? 0 : 12, 0, 0, 0);
    const s = selectionStart.value;
    const e = selectionEnd.value;
    if (s && e && ts > s && ts < e) return "rgba(34, 197, 94, 0.4)";
    return "transparent";
}

// Recupera colore dalla mappa dati
function getColor(d, slot, map) {
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d - offset)).toISOString().slice(0, -1);
    const key = localISOTime.split('T')[0]; // Chiave YYYY-MM-DD
    const entry = map?.get(key);
    return entry ? (COLORS[entry[slot].status] || COLORS.empty) : COLORS.empty;
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
        <div class="instructions">Click AM/PM slots to filter map</div>
    </div>
    <div ref="container" class="viz-area"></div>
  </div>
</template>

<style scoped>
/* CSS base */
.calendar-component { display: flex; flex-direction: column; width: 100%; }
.calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.viz-area { overflow-x: auto; margin-bottom: -5px; border-radius: 4px; }
.legend { display: flex; gap: 12px; font-size: 0.8rem; color: #475569; font-weight: 500; }
.item { display: flex; align-items: center; }
.box { width: 12px; height: 12px; margin-right: 5px; border-radius: 2px; }
.red { background: #e74c3c; } 
.orange { background: #f39c12; } 
.gray { background: #95a5a6; } 
.blue { background: #3498db; }
.green-border { border: 2px solid #22c55e; background: transparent; width: 12px; height: 7px;}
</style>