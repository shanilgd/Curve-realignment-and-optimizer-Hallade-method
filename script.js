// Global data structure
let curveData = [];

// Chart instances
let chartVersines = null;
let chartSlews = null;

// DOM Elements
const tabTable = document.getElementById('tab-table');
const tabCharts = document.getElementById('tab-charts');
const contentTable = document.getElementById('content-table');
const contentCharts = document.getElementById('content-charts');

const btnGenerate = document.getElementById('btn-generate-table');
const btnDownloadTemplate = document.getElementById('btn-download-template');
const btnImportExcelHeader = document.getElementById('btn-import-excel');
const btnExportExcel = document.getElementById('btn-export-excel');
const btnClear = document.getElementById('btn-clear');
const btnOptimize = document.getElementById('btn-optimize');

const tableFoot = document.getElementById('table-foot');
const totalExgEl = document.getElementById('total-exg');
const totalProEl = document.getElementById('total-pro');
const tableBody = document.getElementById('table-body');
const slewLimitInput = document.getElementById('slew-limit');
const optStatus = document.getElementById('optimization-status');

// Stat Elements
const statTotalStns = document.getElementById('stat-total-stns');
const statTotalVersine = document.getElementById('stat-total-versine');
const statMaxSlew = document.getElementById('stat-max-slew');
const statSmoothness = document.getElementById('stat-smoothness');

// Right Panel Tab Listeners
tabTable.addEventListener('click', () => {
    tabTable.classList.add('active');
    tabCharts.classList.remove('active');
    contentTable.classList.add('active');
    contentCharts.classList.remove('active');
});

tabCharts.addEventListener('click', () => {
    tabCharts.classList.add('active');
    tabTable.classList.remove('active');
    contentCharts.classList.add('active');
    contentTable.classList.remove('active');
    
    // Resize/render charts to fit the container
    if (chartVersines) chartVersines.resize();
    if (chartSlews) chartSlews.resize();
});

// Setup Initial Blank Charts
function initCharts() {
    const ctxVer = document.getElementById('chart-versines').getContext('2d');
    chartVersines = new Chart(ctxVer, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Existing Versine',
                    data: [],
                    borderColor: '#f87171',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Proposed Versine',
                    data: [],
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });

    const ctxSlew = document.getElementById('chart-slews').getContext('2d');
    chartSlews = new Chart(ctxSlew, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Corrected Slew',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });
}

// Generate Station Table Grid dynamically
btnGenerate.addEventListener('click', () => {
    const beforeVal = document.getElementById('stns-before').value.trim();
    const beforeCount = beforeVal !== "" ? (parseInt(beforeVal) || 0) : 5;
    
    const curveVal = document.getElementById('stns-curve').value.trim();
    const curveCount = curveVal !== "" ? (parseInt(curveVal) || 0) : 31;
    
    const afterVal = document.getElementById('stns-after').value.trim();
    const afterCount = afterVal !== "" ? (parseInt(afterVal) || 0) : 5;
    
    curveData = [];
    
    // Stations before curve (Negative stations)
    for (let i = beforeCount; i >= 1; i--) {
        curveData.push({ stn: `-${i}`, exg: 0, pro: 0 });
    }
    
    // Stations in curve (0 to n)
    for (let i = 0; i < curveCount; i++) {
        curveData.push({ stn: `${i}`, exg: 0, pro: 0 });
    }
    
    // Stations after curve (Positive stations)
    for (let i = 1; i <= afterCount; i++) {
        curveData.push({ stn: `+${i}`, exg: 0, pro: 0 });
    }
    
    recalculate();
    renderTable();
    updateCharts();
    
    btnOptimize.disabled = false;
    btnExportExcel.disabled = false;
});

// Excel Import
async function handleExcelImport() {
    const path = await window.electronAPI.openFileDialog();
    if (!path) return;
    
    const result = await window.electronAPI.readExcelData(path);
    if (result.success) {
        curveData = result.data.map(row => ({
            stn: row.stn,
            exg: row.exg,
            pro: row.pro
        }));
        
        recalculate();
        renderTable();
        updateCharts();
        
        btnOptimize.disabled = false;
        btnExportExcel.disabled = false;
        
        showStatus("Excel data imported successfully!", "success");
    } else {
        showStatus(`Import failed: ${result.error}`, "error");
    }
}

btnImportExcelHeader.addEventListener('click', handleExcelImport);

// Template Download
btnDownloadTemplate.addEventListener('click', async () => {
    const result = await window.electronAPI.downloadTemplate();
    if (result && result.success) {
        showStatus("Template downloaded successfully!", "success");
    } else if (result && result.error) {
        showStatus(`Template download failed: ${result.error}`, "error");
    }
});

// Excel Export
btnExportExcel.addEventListener('click', async () => {
    if (curveData.length === 0) return;
    const path = await window.electronAPI.saveFileDialog('Curve_Realignment_Output.xlsx');
    if (!path) return;
    
    const result = await window.electronAPI.writeExcelData(path, curveData);
    if (result.success) {
        showStatus("Excel output saved successfully!", "success");
    } else {
        showStatus(`Export failed: ${result.error}`, "error");
    }
});

// Run SciPy Optimizer
btnOptimize.addEventListener('click', async () => {
    if (curveData.length === 0) return;
    
    showStatus("Running SciPy optimization in the background...", "warning");
    btnOptimize.disabled = true;
    
    const stns = curveData.map(r => r.stn);
    const v_ex = curveData.map(r => r.exg);
    
    let slewLimit = null;
    const limitVal = slewLimitInput.value ? slewLimitInput.value.trim() : "";
    if (limitVal !== "") {
        slewLimit = parseFloat(limitVal);
    }
    
    const max_slew_in = curveData.map(r => (r.maxIn === '' || r.maxIn === undefined || r.maxIn === null) ? null : parseFloat(r.maxIn));
    const max_slew_out = curveData.map(r => (r.maxOut === '' || r.maxOut === undefined || r.maxOut === null) ? null : parseFloat(r.maxOut));
    const response = await window.electronAPI.runOptimization({ stns, v_ex, max_slew_in, max_slew_out, slew_limit: slewLimit });
    btnOptimize.disabled = false;
    
    if (response.success) {
        // Populate optimized proposed versines back to curveData
        curveData.forEach((row, idx) => {
            row.pro = response.v_pro[idx];
        });
        
        recalculate();
        renderTable();
        updateCharts();
        
        let msg = `Optimization successful! Max Slew: ${response.max_slew.toFixed(1)} mm.`;
        if (response.warning) {
            msg += ` Note: ${response.warning}`;
            showStatus(msg, "warning");
        } else {
            showStatus(msg, "success");
        }
    } else {
        showStatus(`Optimization failed: ${response.error}`, "error");
    }
});

// Clear Data
btnClear.addEventListener('click', () => {
    curveData = [];
    tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">No stations generated. Click "Browse & Import Excel" or "Generate Station Grid" to begin.</td></tr>`;
    btnOptimize.disabled = true;
    btnExportExcel.disabled = true;
    
    statTotalStns.textContent = "-";
    statTotalVersine.textContent = "-";
    statMaxSlew.textContent = "-";
    statSmoothness.textContent = "-";
    
    if (chartVersines) {
        chartVersines.data.labels = [];
        chartVersines.data.datasets[0].data = [];
        chartVersines.data.datasets[1].data = [];
        chartVersines.update();
    }
    if (chartSlews) {
        chartSlews.data.labels = [];
        chartSlews.data.datasets[0].data = [];
        chartSlews.update();
    }
    
    optStatus.classList.add('hidden');
    if (tableFoot) tableFoot.classList.add('hidden');
});

// Slew Math Recalculation (Exactly matches Excel)
function recalculate() {
    const N = curveData.length;
    if (N === 0) return;
    
    // First Pass: Diff, cumulative sums, raw slew
    let prevFirstSum = 0;
    let prevSecondSum = 0;
    
    curveData.forEach((row) => {
        row.diff = row.pro - row.exg;
        row.firstSum = prevFirstSum + row.diff;
        row.secondSum = prevSecondSum + prevFirstSum;
        row.rawSlew = -2 * row.secondSum;
        
        prevFirstSum = row.firstSum;
        prevSecondSum = row.secondSum;
    });
    
    // Second Pass: Linear correction and corrected slew
    const lastRawSlew = curveData[N-1].rawSlew;
    
    curveData.forEach((row, idx) => {
        row.linCorr = Number((lastRawSlew * idx / (N - 1)).toFixed(1));
        row.corrSlew = Number((row.rawSlew - row.linCorr).toFixed(1));
    });
    
    // Update Stats
    statTotalStns.textContent = N;
    
    const sumExg = curveData.reduce((s, r) => s + r.exg, 0);
    const sumPro = curveData.reduce((s, r) => s + r.pro, 0);
    statTotalVersine.textContent = `${sumExg} mm`;
    if (totalExgEl) totalExgEl.textContent = sumExg;
    if (totalProEl) totalProEl.textContent = sumPro;
    
    const maxS = Math.max(...curveData.map(r => Math.abs(r.corrSlew)));
    statMaxSlew.textContent = `${maxS.toFixed(1)} mm`;
    
    // Smoothness (sum of squared second differences of proposed)
    let smoothVal = 0;
    for (let i = 2; i < N; i++) {
        const diff2 = curveData[i].pro - 2 * curveData[i-1].pro + curveData[i-2].pro;
        smoothVal += diff2 * diff2;
    }
    statSmoothness.textContent = smoothVal.toFixed(0);
}

// Render Table rows
function renderTable() {
    if (curveData.length === 0) return;
    
    tableBody.innerHTML = '';
    if (tableFoot) tableFoot.classList.remove('hidden');
    
    curveData.forEach((row, idx) => {
        const tr = document.createElement('tr');
        
        // Color class for corrected slew
        let slewClass = 'slew-zero';
        if (row.corrSlew > 0.05) slewClass = 'slew-positive';
        else if (row.corrSlew < -0.05) slewClass = 'slew-negative';
        
        tr.innerHTML = `
            <td>${row.stn}</td>
            <td><input type="number" class="cell-input cell-exg" data-idx="${idx}" value="${row.exg !== 0 ? row.exg : ''}" placeholder="0"></td>
            <td><input type="number" class="cell-input cell-pro" data-idx="${idx}" value="${row.pro !== 0 ? row.pro : ''}" placeholder="0"></td>
            <td><input type="number" class="cell-input cell-max-in" data-idx="${idx}" placeholder="-" value="${row.maxIn !== undefined ? row.maxIn : ''}"></td>
            <td><input type="number" class="cell-input cell-max-out" data-idx="${idx}" placeholder="-" value="${row.maxOut !== undefined ? row.maxOut : ''}"></td>
            <td class="text-center hover-cell" data-idx="${idx}" data-col="D">${row.diff}</td>
            <td class="text-center hover-cell" data-idx="${idx}" data-col="E">${row.firstSum}</td>
            <td class="text-center hover-cell" data-idx="${idx}" data-col="F">${row.secondSum}</td>
            <td class="text-center hover-cell" data-idx="${idx}" data-col="G">${row.rawSlew.toFixed(1)}</td>
            <td class="text-center hover-cell" data-idx="${idx}" data-col="H">${row.linCorr.toFixed(1)}</td>
            <td class="text-center hover-cell ${slewClass}" data-idx="${idx}" data-col="I">${row.corrSlew.toFixed(1)}</td>
        `;
        
        tableBody.appendChild(tr);
    });
    
    // Attach event listeners to inputs to allow direct manual entry editing
    document.querySelectorAll('.cell-exg').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            curveData[idx].exg = parseInt(e.target.value) || 0;
            recalculate();
            updateRowValues(idx);
            updateCharts();
        });
    });
    
    document.querySelectorAll('.cell-pro').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            curveData[idx].pro = parseInt(e.target.value) || 0;
            recalculate();
            updateRowValues(idx);
            updateCharts();
        });
    });
    
    document.querySelectorAll('.cell-max-in').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            curveData[idx].maxIn = e.target.value;
        });
    });
    
    document.querySelectorAll('.cell-max-out').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            curveData[idx].maxOut = e.target.value;
        });
    });
}

// Inline updates of row values without re-rendering the entire table (keeps input focus)
function updateRowValues(idx) {
    recalculate();
    
    // We must update ALL rows because changing a value at idx affects the mathematical sums for every row after it
    const rows = tableBody.querySelectorAll('tr');
    curveData.forEach((row, i) => {
        const tr = rows[i];
        if (!tr) return;
        
        let slewClass = 'slew-zero';
        if (row.corrSlew > 0.05) slewClass = 'slew-positive';
        else if (row.corrSlew < -0.05) slewClass = 'slew-negative';
        
        tr.children[5].textContent = row.diff;
        tr.children[6].textContent = row.firstSum;
        tr.children[7].textContent = row.secondSum;
        tr.children[8].textContent = row.rawSlew.toFixed(1);
        tr.children[9].textContent = row.linCorr.toFixed(1);
        tr.children[10].className = `text-center hover-cell ${slewClass}`;
        tr.children[10].textContent = row.corrSlew.toFixed(1);
    });
}

// Update charts with current dataset
function updateCharts() {
    if (curveData.length === 0) return;
    
    const labels = curveData.map(r => r.stn);
    const existing = curveData.map(r => r.exg);
    const proposed = curveData.map(r => r.pro);
    const slews = curveData.map(r => r.corrSlew);
    
    if (chartVersines) {
        chartVersines.data.labels = labels;
        chartVersines.data.datasets[0].data = existing;
        chartVersines.data.datasets[1].data = proposed;
        chartVersines.update();
    }
    
    if (chartSlews) {
        chartSlews.data.labels = labels;
        chartSlews.data.datasets[0].data = slews;
        chartSlews.update();
    }
}

// Show Status banner
function showStatus(msg, type) {
    optStatus.textContent = msg;
    optStatus.className = `status-msg ${type}`;
}

// Start Up
window.addEventListener('DOMContentLoaded', () => {
    initCharts();
});

// Custom Tooltip Logic
const tooltip = document.getElementById('custom-tooltip');
let tooltipTimeout;

tableBody.addEventListener('mouseover', (e) => {
    const td = e.target.closest('.hover-cell');
    if (!td) return;
    
    const idx = parseInt(td.getAttribute('data-idx'));
    const col = td.getAttribute('data-col');
    if (isNaN(idx) || !curveData[idx]) return;
    
    const row = curveData[idx];
    const N = curveData.length;
    
    tooltipTimeout = setTimeout(() => {
        let title = '';
        let formula = '';
        let calc = '';
        let result = '';
        
        if (col === 'D') {
            title = 'Difference (D)';
            formula = 'D = Proposed (C) - Existing (B)';
            calc = `D = ${row.pro} - ${row.exg}`;
            result = row.diff;
        } else if (col === 'E') {
            title = 'First Sum (E)';
            formula = 'E = Prev First Sum + Diff (D)';
            const prevE = idx === 0 ? 0 : curveData[idx-1].firstSum;
            calc = `E = ${prevE} + ${row.diff}`;
            result = row.firstSum;
        } else if (col === 'F') {
            title = 'Second Sum (F)';
            formula = 'F = Prev Second Sum + First Sum (E)';
            const prevF = idx === 0 ? 0 : curveData[idx-1].secondSum;
            calc = `F = ${prevF} + ${row.firstSum}`;
            result = row.secondSum;
        } else if (col === 'G') {
            title = 'Raw Slew (G)';
            formula = 'G = -2 &times; Second Sum (F)';
            calc = `G = -2 &times; ${row.secondSum}`;
            result = row.rawSlew.toFixed(1);
        } else if (col === 'H') {
            title = 'Linear Correction (H)';
            formula = 'H = Final Raw Slew &times; (Current Index / Total Intervals)';
            const finalRaw = curveData[N-1].rawSlew;
            calc = `H = ${finalRaw.toFixed(1)} &times; (${idx} / ${N-1})`;
            result = row.linCorr.toFixed(1) + ' mm';
        } else if (col === 'I') {
            title = 'Corrected Slew (I)';
            formula = 'I = Raw Slew (G) - Linear Correction (H)';
            calc = `I = ${row.rawSlew.toFixed(1)} - ${row.linCorr.toFixed(1)}`;
            result = row.corrSlew.toFixed(1) + ' mm';
        }
        
        tooltip.innerHTML = `
            <h4>${title}</h4>
            <div class="formula">${formula}</div>
            <div class="calculation">${calc}</div>
            <div class="result">Result: ${result}</div>
        `;
        
        const rect = td.getBoundingClientRect();
        let left = rect.left + window.scrollX + (rect.width / 2) - 175;
        let top = rect.top + window.scrollY - 120;
        
        if (left < 10) left = 10;
        if (top < 10) top = rect.bottom + window.scrollY + 10;
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.classList.add('visible');
    }, 1000);
});

tableBody.addEventListener('mouseout', (e) => {
    const td = e.target.closest('.hover-cell');
    if (td) {
        clearTimeout(tooltipTimeout);
        tooltip.classList.remove('visible');
    }
});


  // Check for Updates
  const btnCheckUpdate = document.getElementById('btn-check-update');
  if (btnCheckUpdate) {
      btnCheckUpdate.addEventListener('click', async () => {
          btnCheckUpdate.disabled = true;
          const originalHTML = btnCheckUpdate.innerHTML;
          btnCheckUpdate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
          
          try {
              const res = await window.electronAPI.checkForUpdates();
              if (res.success) {
                  // If update is available, the main process will show a dialog.
                  // We just reset the button after a delay so it doesn't stay spinning forever.
                  setTimeout(() => {
                      btnCheckUpdate.disabled = false;
                      btnCheckUpdate.innerHTML = originalHTML;
                  }, 3000);
              } else {
                  showStatus(`Update check failed: ${res.error}`, "error");
                  btnCheckUpdate.disabled = false;
                  btnCheckUpdate.innerHTML = originalHTML;
              }
          } catch (e) {
              showStatus(`Update check failed: ${e.message}`, "error");
              btnCheckUpdate.disabled = false;
              btnCheckUpdate.innerHTML = originalHTML;
          }
      });
  }

  // UI and Modals Logic
  window.electronAPI.getVersion().then(v => {
      document.getElementById('app-version-tag').textContent = `v${v}`;
  });

  const updateModal = document.getElementById('update-modal');
  const manualModal = document.getElementById('manual-modal');
  const changelogModal = document.getElementById('changelog-modal');
  const creditsModal = document.getElementById('credits-modal');

  document.getElementById('btn-check-updates').addEventListener('click', () => {
      const btn = document.getElementById('btn-check-updates');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
      btn.disabled = true;
      window.electronAPI.checkForUpdates();
      
      setTimeout(() => {
          btn.innerHTML = originalText;
          btn.disabled = false;
      }, 3000); // Re-enable button after timeout if no response
  });

  document.getElementById('btn-help').addEventListener('click', () => {
      manualModal.classList.remove('hidden');
  });
  document.getElementById('close-manual').addEventListener('click', () => {
      manualModal.classList.add('hidden');
  });

  document.getElementById('btn-changelog').addEventListener('click', () => {
      changelogModal.classList.remove('hidden');
  });
  document.getElementById('close-changelog').addEventListener('click', () => {
      changelogModal.classList.add('hidden');
  });

  document.getElementById('btn-credits').addEventListener('click', () => {
      creditsModal.classList.remove('hidden');
  });
  document.getElementById('close-credits').addEventListener('click', () => {
      creditsModal.classList.add('hidden');
  });

  // Updater logic
  window.electronAPI.onUpdateAvailable((version) => {
      const btn = document.getElementById('btn-check-updates');
      btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down" style="color: #60a5fa;"></i> Updates';
      btn.disabled = false;
      
      document.getElementById('update-version-text').textContent = `Version ${version} is available!`;
      updateModal.classList.remove('hidden');
  });

  document.getElementById('btn-update-cancel').addEventListener('click', () => {
      updateModal.classList.add('hidden');
  });

  document.getElementById('btn-update-download').addEventListener('click', () => {
      document.getElementById('update-action-container').classList.add('hidden');
      document.getElementById('update-progress-container').classList.remove('hidden');
      window.electronAPI.downloadUpdate();
  });

  window.electronAPI.onUpdateProgress((percent) => {
      document.getElementById('update-progress-fill').style.width = `${percent}%`;
      document.getElementById('update-progress-text').textContent = `Downloading: ${Math.round(percent)}%`;
  });

  window.electronAPI.onUpdateDownloaded(() => {
      document.getElementById('update-progress-container').classList.add('hidden');
      document.getElementById('update-install-container').classList.remove('hidden');
  });

  document.getElementById('btn-update-install').addEventListener('click', () => {
      window.electronAPI.installUpdate();
  });
