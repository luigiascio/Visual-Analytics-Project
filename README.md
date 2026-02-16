# VAST Challenge 2024 (MC2) - Visual Analytics Project

**Master Degree in Data Science and Business Informatics**
**Author:** Luigi Ascione

## 📖 Project Overview
This project implements a Visual Analytics system to tackle Illegal, Unreported, and Unregulated (IUU) fishing in the fictional nation of Oceanus. developed for the **VAST Challenge 2024, Mini-Challenge 2**.

Using the "CatchNet" knowledge graph, the system combines a Python preprocessing pipeline with an interactive **Vue.js** dashboard to assist analysts in identifying suspicious vessel behaviors, reconstructing cargo provenance, and assessing the impact of regulatory actions.

📄 **Full Report:** For a detailed explanation of the methodology, findings, and answers to the research questions, please refer to the project report: **[Visual_Analytics_Report_Ascione.pdf](./Visual_Analytics_Report_Ascione.pdf)**.

---

## ⚠️ Important Note on Data
**The raw datasets (`mc2.json`) and the processed JSON files are NOT included in this repository due to GitHub file size limits.**

To run the project, you must:
1.  Download the **Mini-Challenge 2 dataset** from the [Official VAST Challenge Website](https://vast-challenge.github.io/2024/MC2.html).
2.  Place `mc2.json` in the project root.
3.  Run the preprocessing notebooks to generate the dashboard datasets, OR place the pre-calculated JSON files directly into `vast-challenge-project/public/`.

---

## 📂 Repository Structure

The project is divided into two main parts: **Data Preprocessing** (Python) and **Visualization Interface** (Vue.js).

```text
Project Root/
│
├── 📓 Preprocessing Notebooks
│   ├── Data Understanding & Preprocessing.ipynb  # Graph parsing & cleaning
│   ├── first_dataset.ipynb                       # Generates data for Task 1 (Cargo)
│   └── second_dataset.ipynb                      # Generates data for Tasks 2, 3, & 4 (Trajectories)
│
├── 📁 data/                                      # Intermediate CSV files (Excluded from repo)
│
└── 💻 vast-challenge-project/                    # VUE.JS APPLICATION
    ├── public/                                   # Assets & Final JSON Datasets (Excluded)
    │   ├── Oceanus Geography.geojson
    │   ├── candidates_enriched.json              # Output of first_dataset.ipynb
    │   ├── other_candidates.json                 # Output of second_dataset.ipynb
    │   └── south_seafood_pings.json              # Output of second_dataset.ipynb
    │
    └── src/
        ├── App.vue                               # Main Layout
        ├── views/                                # Dashboard Pages
        │   ├── Task1View.vue                     # Cargo Traffic Monitor
        │   ├── Task2View.vue                     # Target Vessel Analysis
        │   ├── Task3View.vue                     # Comparative Analysis
        │   └── Task4View.vue                     # Post-Ban Impact
        │
        └── components/                           # D3.js Visualizations
            ├── CargoMatcher.vue                  # Scatterplot for Cargo Attribution
            ├── CalendarHeatmap.vue               # Temporal Activity View
            ├── GeoAnalyzer.vue                   # Geospatial Trajectory Map
            ├── MultilayerTimeline.vue            # Split-screen Comparison Tool
            └── PostBanAnalyzer.vue               # Diverging Bar Chart (Activity Shift)
```
## 📊 The Dashboard Views

The application addresses the four main research questions (RQs) of the challenge through dedicated interactive views:

### 1. Cargo Traffic Monitor (RQ1)
* **Goal:** Solve the missing link between port-exit records and vessels.
* **Component:** `CargoMatcher.vue` (in `Task1View.vue`)
* **Methodology:** Uses a spatiotemporal matching algorithm to attribute anonymous cargo records to specific vessels based on docking windows ([0, 2] days). It visualizes suspicious flows from ecological preserves like *Nemo Reef*.

### 2. Target Vessel Analysis (RQ2)
* **Goal:** Granular investigation of the *SouthSeafood Express Corp* fleet.
* **Components:** `CalendarHeatmap.vue`, `GeoAnalyzer.vue` (in `Task2View.vue`)
* **Methodology:** Visualizes daily activity patterns and geographic trajectories to identify illegal behaviors, such as loitering in the *Ghoti Preserve* or transshipment activities at specific navigation buoys like *Nav C* and *Exit East*.

### 3. Comparative Behavioral Analysis (RQ3)
* **Goal:** Identify other vessels in the fleet behaving like known offenders.
* **Component:** `MultilayerTimeline.vue` (in `Task3View.vue`)
* **Methodology:** A "Similarity Search" tool that ranks the entire fleet using a **Suspicion Score** (calculated via 75th/90th percentile dwell time thresholds). It allows side-by-side comparison of vessel timelines to find "shadow fleet" members.

### 4. Post-Ban Impact Assessment (RQ4)
* **Goal:** Analyze the systemic impact of the fishing ban on SouthSeafood Express Corp.
* **Component:** `PostBanAnalyzer.vue` (in `Task4View.vue`)
* **Methodology:** Uses a **Diverging Stacked Bar Chart** linked to a map to visualize the "activity delta" (Pre-Ban vs. Post-Ban). It highlights phenomena such as the **displacement effect** (illegal fishing moving to *Nemo Reef*) and the rise of **Dark Ship** tactics (loitering at *Nav C* instead of docking).

---

## 🚀 Installation & Usage

### Prerequisites
* **Node.js** (LTS version recommended)
* **Python 3.x** (Only required if you want to re-run the preprocessing notebooks)

### How to Run the Dashboard
The processed JSON datasets are already included in the `public/` folder, so you can run the visualization interface immediately.

1.  **Navigate to the frontend folder:**
    ```bash
    cd vast-challenge-project
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the local development server:**
    ```bash
    npm run dev
    ```

4.  **Access the application:**
    Open your browser and navigate to the address shown in the terminal (usually `http://localhost:5173`).

---

## 👨‍💻 Author
**Luigi Ascione**
Master Degree in Data Science and Business Informatics
University of Pisa
