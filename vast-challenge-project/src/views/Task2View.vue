<template>
  <div class="view-wrapper">
    <div class="page-header">
      <h2 class="page-title">The SouthSeafood Investigation</h2>
      <p class="page-subtitle">
        In-depth tracking of suspicious vessels. Filter by time on the calendar to see the trajectory on the map.
      </p>
    </div>
    
    <div class="viz-block unified-container">
        
        <div class="card-top-row">
            <div class="selector-panel">
                <div class="panel-label">TARGET VESSEL</div>
                <div class="custom-select-wrapper">
                    <select v-model="task2Vessel">
                        <option v-for="v in vesselList" :key="v" :value="v">{{ v }}</option>
                    </select>
                </div>
                <div class="meta-info">
                    <small>Select to update view</small>
                </div>
            </div>

            <div class="calendar-panel">
                <CalendarHeatmap 
                    :selectedVessel="task2Vessel" 
                    @update-range="updateDateRange" 
                />
            </div>
        </div>

        <div class="map-wrapper">
            <GeoAnalyzer 
                :selectedVessel="task2Vessel" 
                :timeRange="task2Range" 
            />
        </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import GeoAnalyzer from '../components/GeoAnalyzer.vue';
import CalendarHeatmap from '../components/CalendarHeatmap.vue';

defineProps(['data']); 

const task2Vessel = ref("Snapper Snatcher");
const task2Range = ref({ 
    start: new Date("2035-01-01").getTime(), 
    end: new Date("2035-12-31").getTime() 
});

const vesselList = [
    "Snapper Snatcher", 
    "Roach Robber"
]; 

function updateDateRange(newRange) {
    task2Range.value = newRange;
}
</script>

<style scoped>
.view-wrapper { 
  max-width: 1400px; 
  margin: 0 auto; 
  padding: 20px;
}

/* HEADER UNIFICATO */
.page-header { margin-bottom: 24px; }

.page-title { 
  font-size: 1.8rem; 
  font-weight: 800; 
  color: #0f172a; /* Nero/Slate scuro */
  margin: 0 0 8px 0; 
  letter-spacing: -0.02em;
}

.page-subtitle { 
  color: #64748b; 
  font-size: 1rem; 
  margin: 0; 
  line-height: 1.5;
}

/* CARD VIZ */
.viz-block { 
    background: white; 
    border-radius: 12px; 
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
    border: 1px solid #e2e8f0;
    overflow: hidden; 
}

.card-top-row {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    background-color: #fff;
}

.selector-panel {
    width: 250px; 
    padding: 20px;
    background-color: #f8fafc; 
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.panel-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #94a3b8;
    margin-bottom: 8px;
    letter-spacing: 0.05em;
}

.custom-select-wrapper select {
    width: 100%;
    padding: 10px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.95rem;
    color: #334155;
    background-color: white;
    cursor: pointer;
    font-weight: 600;
    outline: none;
    transition: border-color 0.2s;
}

.custom-select-wrapper select:hover { border-color: #94a3b8; }

.meta-info { margin-top: 8px; color: #94a3b8; font-size: 0.8rem; font-style: italic; }

.calendar-panel {
    flex-grow: 1; 
    padding: 15px 20px 5px 20px;
    min-width: 0;
}

.map-wrapper {
    height: 600px; 
    background-color: #f1f5f9; 
    position: relative;
}
</style>