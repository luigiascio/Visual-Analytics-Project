import { createRouter, createWebHistory } from 'vue-router'
import Task1View from '../views/Task1View.vue'
import Task2View from '../views/Task2View.vue'
import Task3View from '../views/Task3View.vue'
import Task4View from '../views/Task4View.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/task1' }, // Default redirect
    { path: '/task1', name: 'task1', component: Task1View },
    { path: '/task2', name: 'task2', component: Task2View },
    { path: '/task3', name: 'task3', component: Task3View },
    { path: '/task4', name: 'task4', component: Task4View },
  ]
})

export default router