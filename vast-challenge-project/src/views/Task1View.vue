<template>
  <div class="view-wrapper">
    <div class="page-header">
      <h2 class="page-title">Cargo Anomalies & Administrative Records</h2>
      <p class="page-subtitle">
        Cross-reference analysis between Port Exit Records and Vessel Trajectories.
      </p>
    </div>

    <div class="content-wrapper">
      <CargoMatcher :data="data" :filterFlag="null" />
    </div>
  </div>
</template>

<script setup>
import CargoMatcher from '../components/CargoMatcher.vue';
defineProps(['data']);
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

.content-wrapper {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}
</style>