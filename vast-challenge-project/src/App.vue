<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import * as d3 from 'd3';

// --- GLOBAL STATE ---
const allData = ref([]);
const loading = ref(true);
const error = ref(null);

// Caricamento Dati
onMounted(async () => {
    try {
        console.log("App: Loading global data...");
        const response = await fetch('/candidates_enriched.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const textData = await response.text();
        const cleanText = textData.replace(/:\s*NaN\b/g, ': null');
        const rawData = JSON.parse(cleanText);
        
        const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");
        
        rawData.forEach(d => { 
            d.dateObj = parseTime(d.date) || new Date(d.date); 
            d.qty_tons = (d.qty_tons === null) ? 0 : d.qty_tons;
        });
        
        rawData.sort((a, b) => a.dateObj - b.dateObj);
        allData.value = rawData;
        loading.value = false;
        console.log("App: Data loaded", allData.value.length);

    } catch (e) { 
        console.error(e);
        error.value = "Errore caricamento dati: " + e.message;
        loading.value = false;
    }
});
</script>

<template>
  <div class="app-layout">
    
    <header class="top-navbar">
      
      <div class="brand">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
        <h1>VAST 2024</h1>
        <span class="brand-divider">|</span>
        <p>FishEye Analytics</p>
      </div>

      <nav class="nav-menu">
        <RouterLink to="/task1" class="nav-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            Cargo Network
        </RouterLink>
        
        <RouterLink to="/task2" class="nav-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><circle cx="12" cy="5" r="3"></circle><line x1="12" y1="22" x2="12" y2="8"></line><path d="M5 12H2a10 10 0 0 0 20 0h-3"></path></svg>
            Target Analysis
        </RouterLink>
        
        <RouterLink to="/task3" class="nav-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M2 12h5"></path><path d="M17 12h5"></path><path d="M12 2v5"></path><path d="M12 17v5"></path><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
            Similarity Search
        </RouterLink>
        
        <RouterLink to="/task4" class="nav-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            Post-Ban Impact
        </RouterLink>
      </nav>

      <div class="footer-info">
        <small>Exam Project</small>
      </div>
    </header>

    <main class="main-content">
      
      <div v-if="loading" class="full-center">
        <div class="loader"></div>
        <p>Initializing Knowledge Graph...</p>
      </div>

      <div v-else-if="error" class="full-center error">
        {{ error }}
      </div>

      <RouterView v-else :data="allData" v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </RouterView>

    </main>
  </div>
</template>

<style>
/* Reset */
body { margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', sans-serif; background-color: #f4f7f6; }

/* Layout Verticale */
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* TOP NAVBAR STYLES */
.top-navbar {
  height: 60px; /* Altezza leggermente ridotta per look più moderno */
  background-color: #0f172a; /* Slate 900 (più scuro) */
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
  z-index: 50;
  flex-shrink: 0;
  border-bottom: 1px solid #1e293b;
}

/* Brand Section */
.brand { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
}
.brand h1 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #f8fafc; letter-spacing: 0.5px; }
.brand p { margin: 0; color: #94a3b8; font-size: 0.85rem; font-weight: 500; }
.brand-divider { color: #334155; font-size: 1.2rem; font-weight: 300; }

/* Navigation Menu */
.nav-menu { 
  display: flex; 
  flex-direction: row;
  gap: 4px; /* Spazio piccolo tra i bottoni */
  height: 100%;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px; /* Spazio tra icona e testo */
  padding: 0 16px;
  color: #94a3b8; /* Colore inattivo più tenue */
  text-decoration: none;
  border-bottom: 2px solid transparent; 
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.9rem;
  height: 100%;
  position: relative;
}

.nav-item:hover { 
  background-color: rgba(255,255,255,0.05); 
  color: #f1f5f9; 
}

.nav-icon {
    opacity: 0.8;
}

/* Link Attivo */
.router-link-active {
  color: #38bdf8; /* Sky Blue */
  background-color: rgba(56, 189, 248, 0.08);
  border-bottom-color: #38bdf8;
}
.router-link-active .nav-icon {
    opacity: 1;
    stroke-width: 2.5; /* Icona leggermente più marcata quando attiva */
}

/* Footer Info */
.footer-info { 
  text-align: right; 
  color: #475569; 
  min-width: 100px;
  font-size: 0.8rem;
}

/* MAIN CONTENT */
.main-content {
  flex-grow: 1;
  padding: 0; /* Rimosso padding globale, ogni vista gestisce il suo */
  overflow-y: auto;
  background-color: #f1f5f9; /* Sfondo leggermente grigio */
  position: relative;
}

/* Utilities */
.full-center {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #64748b;
}

.loader {
  border: 3px solid #e2e8f0;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.error { color: #ef4444; font-weight: 600; font-size: 0.9rem; }

@media (max-width: 768px) {
  .brand p, .footer-info { display: none; }
  .nav-item { padding: 0 10px; font-size: 0.8rem; }
  .nav-item span { display: none; } /* Nascondi testo su mobile, mostra solo icona */
}
</style>