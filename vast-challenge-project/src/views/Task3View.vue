<script setup>
import { ref, onMounted } from 'vue';
import MultiLayerTimeline from '../components/MultilayerTimeline.vue';

// STATO
const targetList = ref([]);   
const suspectList = ref([]);  
const selectedTarget = ref(null);   
const selectedSuspect = ref(null);  
const dateRange = ref({ start: "2035-01-01", end: "2035-12-31" });

onMounted(async () => {
    try {
        const respTarget = await fetch('/south_seafood_pings.json');
        const dataTarget = await respTarget.json();
        targetList.value = Object.keys(dataTarget);
        
        if (targetList.value.includes("Snapper Snatcher")) {
            selectedTarget.value = "Snapper Snatcher";
        } else if (targetList.value.length > 0) {
            selectedTarget.value = targetList.value[0];
        }

        const respSuspect = await fetch('/other_candidates.json');
        const dataSuspect = await respSuspect.json();
        
        suspectList.value = Object.keys(dataSuspect).map(name => {
            const tracks = dataSuspect[name];
            const violationCount = tracks.filter(t => t.type === 'violation').length;
            const susCount = tracks.filter(t => t.type === 'suspicious').length;
            const calcScore = (violationCount * 10) + (susCount * 1);
            return { name, score: calcScore };
        }).sort((a,b) => b.score - a.score);

        if (suspectList.value.length > 0) {
            selectedSuspect.value = suspectList.value[0].name;
        }

    } catch(e) { console.error("Errore Dashboard:", e); }
});
</script>

<template>
  <div class="dashboard-wrapper">
    
    <div class="main-header">
        <div class="header-titles">
            <h2>Investigative Comparison</h2>
            <p>Compare known targets vs emerging threats to identify similar patterns.</p>
        </div>
        
        <div class="global-filter">
            <span class="filter-label">Analysis Period</span>
            <div class="date-input-group">
                <input type="date" v-model="dateRange.start" class="styled-date">
                <span class="sep">→</span>
                <input type="date" v-model="dateRange.end" class="styled-date">
            </div>
        </div>
    </div>

    <div class="split-container">
        
        <div class="panel left-panel">
            <div class="panel-header target-header">
                <div class="header-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-target"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                    <h3>Known Targets</h3>
                </div>
                <select v-model="selectedTarget" class="vessel-select">
                    <option v-for="name in targetList" :key="name" :value="name">
                        {{ name }}
                    </option>
                </select>
            </div>

            <div class="viz-area">
                <div class="viz-wrapper" v-if="selectedTarget">
                    <MultiLayerTimeline 
                        :selectedVessel="selectedTarget"
                        :globalStart="dateRange.start"
                        :globalEnd="dateRange.end"
                        dataUrl="/south_seafood_pings.json" 
                    />
                </div>
            </div>
        </div>

        <div class="divider">
            <div class="vs-badge">VS</div>
        </div>

        <div class="panel right-panel">
            <div class="panel-header suspect-header">
                <div class="header-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-suspect"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <h3>Suspicious Candidates</h3>
                </div>
                <select v-model="selectedSuspect" class="vessel-select">
                    <option v-for="v in suspectList" :key="v.name" :value="v.name">
                        {{ v.name }} [{{ v.score }} pts]
                    </option>
                </select>
            </div>

            <div class="viz-area">
                <div class="viz-wrapper" v-if="selectedSuspect">
                    <MultiLayerTimeline 
                        :selectedVessel="selectedSuspect"
                        :globalStart="dateRange.start"
                        :globalEnd="dateRange.end"
                        dataUrl="/other_candidates.json" 
                    />
                </div>
            </div>
        </div>

    </div>
  </div>
</template>

<style scoped>
.dashboard-wrapper { height: 96vh; max-width: 98%; margin: 0 auto; display: flex; flex-direction: column; padding-bottom: 10px; }

/* HEADER UNIFICATO (Stesso stile delle altre) */
.main-header { flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: white; border-bottom: 1px solid #e2e8f0; }

.header-titles h2 { 
    margin: 0 0 4px 0; 
    color: #0f172a; /* Nero/Slate scuro */
    font-size: 1.6rem; 
    font-weight: 800; 
    letter-spacing: -0.02em;
}
.header-titles p { margin: 0; color: #64748b; font-size: 0.95rem; }

/* FILTRI */
.global-filter { display: flex; align-items: center; gap: 12px; background: #fff; padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.filter-label { font-size: 0.85rem; font-weight: 600; color: #64748b; }
.date-input-group { display: flex; align-items: center; gap: 8px; }
.styled-date { border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px; color: #334155; font-size: 0.9rem; background: #f8fafc; outline: none; }
.styled-date:focus { border-color: #3b82f6; background: white; }

/* PANELS */
.split-container { flex: 1; display: flex; overflow: hidden; background: #f1f5f9; padding: 20px; gap: 20px; }
.panel { flex: 1; background: white; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
.panel-header { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
.header-label { display: flex; align-items: center; gap: 10px; }
.panel-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }

.left-panel { border-top: 4px solid #ef4444; }
.target-header { background: #fff1f2; color: #991b1b; }
.icon-target { color: #dc2626; }

.right-panel { border-top: 4px solid #1e3a8a; }
.suspect-header { background: #f0f9ff; color: #0c4a6e; }
.icon-suspect { color: #0369a1; }

.vessel-select { padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 500; min-width: 220px; font-size: 0.9rem; color: #334155; outline: none; }
.viz-area { flex: 1; padding: 0; position: relative; }
.viz-wrapper { width: 100%; height: 100%; }
.divider { display: flex; align-items: center; justify-content: center; width: 0; position: relative; z-index: 10; }
.vs-badge { background: white; border: 2px solid #cbd5e1; padding: 6px 10px; border-radius: 20px; font-weight: 800; color: #64748b; font-size: 0.75rem; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
</style>