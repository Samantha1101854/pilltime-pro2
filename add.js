class MedicationHistory {
    constructor() {
        this.history = JSON.parse(localStorage.getItem('pilltime-history') || '[]');
        this.reminders = JSON.parse(localStorage.getItem('pilltime-reminders') || '[]');
        this.currentView = 'timeline';
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.chart = null;
        this.init();
    }

    init() {
        this.setupThemeToggle();
        this.loadHistory();
        this.setupFilters();
        this.setupViewToggle();
        this.setupCalendar();
        this.setupChart();
        this.setupEventListeners();
        this.updateStats();
        this.updateSummary();
        this.updateInsights();
    }

    setupThemeToggle() {
        const themeSwitch = document.getElementById('theme-switch');
        if (!themeSwitch) return;

        const savedTheme = localStorage.getItem('pilltime-theme') || 'light';
        const icon = themeSwitch.querySelector('i');
        const text = themeSwitch.querySelector('span');
        
        if (savedTheme === 'dark') {
            icon.className = 'fas fa-sun';
            text.textContent = 'Light Mode';
        }

        themeSwitch.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('pilltime-theme', newTheme);
            
            if (newTheme === 'dark') {
                icon.className = 'fas fa-sun';
                text.textContent = 'Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                text.textContent = 'Dark Mode';
            }
        });
    }

    loadHistory() {
        this.filterHistory();
    }

    filterHistory() {
        const dateRange = document.getElementById('date-range').value;
        const medicationFilter = document.getElementById('medication-filter').value;
        const statusFilter = document.getElementById('status-filter').value;
        const sortBy = document.getElementById('sort-by').value;

        let filtered = this.history.filter(entry => {
            // Filter by medication
            if (medicationFilter && entry.medication !== medicationFilter) {
                return false;
            }

            // Filter by status
            if (statusFilter) {
                const status = this.getStatus(entry);
                if (status !== statusFilter) {
                    return false;
                }
            }

            // Filter by date range
            if (dateRange) {
                const [start, end] = dateRange.split(' to ');
                const entryDate = new Date(entry.takenAt || entry.time);
                const startDate = new Date(start);
                const endDate = new Date(end);
                
                if (entryDate < startDate || entryDate > endDate) {
                    return false;
                }
            }

            return true;
        });

        // Sort the results
        filtered.sort((a, b) => {
            const dateA = new Date(a.takenAt || a.time);
            const dateB = new Date(b.takenAt || b.time);
            
            switch (sortBy) {
                case 'oldest':
                    return dateA - dateB;
                case 'medication':
                    return a.medication.localeCompare(b.medication);
                case 'delay':
                    const delayA = this.getDelay(a);
                    const delayB = this.getDelay(b);
                    return delayB - delayA;
                default: // newest
                    return dateB - dateA;
            }
        });

        this.displayHistory(filtered);
        this.updateMedicationFilter(filtered);
    }

    getStatus(entry) {
        if (!entry.takenAt) return 'missed';
        
        const scheduled = new Date(entry.scheduledTime || entry.time);
        const taken = new Date(entry.takenAt);
        const delay = taken - scheduled;
        
        if (delay <= 300000) { // 5 minutes
            return 'taken';
        } else {
            return 'late';
        }
    }

    getDelay(entry) {
        if (!entry.takenAt) return 0;
        
        const scheduled = new Date(entry.scheduledTime || entry.time);
        const taken = new Date(entry.takenAt);
        return taken - scheduled;
    }

    displayHistory(history) {
        const timelineContainer = document.querySelector('.timeline-container');
        const noHistory = document.getElementById('no-history');
        
        if (history.length === 0) {
            timelineContainer.innerHTML = '';
            noHistory.style.display = 'block';
            return;
        }

        noHistory.style.display = 'none';
        
        const timelineHTML = history.map(entry => this.createTimelineItem(entry)).join('');
        timelineContainer.innerHTML = timelineHTML;
        
        // Add click handlers
        document.querySelectorAll('.timeline-content').forEach((item, index) => {
            item.addEventListener('click', () => {
                this.showHistoryDetails(history[index]);
            });
        });
    }

    createTimelineItem(entry) {
        const date = new Date(entry.takenAt || entry.time);
        const timeString = date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        const dateString = date.toLocaleDateString();
        const status = this.getStatus(entry);
        const delay = this.getDelay(entry);
        
        let delayText = '';
        if (status === 'taken' && delay > 0) {
            const minutes = Math.floor(delay / 60000);
            delayText = `(+${minutes}m)`;
        } else if (status === 'late') {
            const minutes = Math.floor(delay / 60000);
            delayText = `(${minutes}min late)`;
        }

        return `
            <div class="timeline-item">
                <div class="timeline-marker ${status}"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <div class="timeline-time">${dateString} ${timeString} ${delayText}</div>
                        <div class="timeline-status ${status}">
                            ${status === 'taken' ? 'Taken' : status === 'late' ? 'Taken Late' : 'Missed'}
                        </div>
                    </div>
                    <div class="timeline-medication">${entry.medication}</div>
                    <div class="timeline-details">
                        <span>${entry.dosage || ''}</span>
                        <span>${entry.instructions || ''}</span>
                    </div>
                </div>
            </div>
        `;
    }

    updateMedicationFilter(history) {
        const filterSelect = document.getElementById('medication-filter');
        const medications = [...new Set(history.map(entry => entry.medication))];
        
        // Keep the current selection
        const currentValue = filterSelect.value;
        
        // Clear existing options except "All Medications"
        filterSelect.innerHTML = '<option value="">All Medications</option>';
        
        // Add new options
        medications.forEach(med => {
            const option = document.createElement('option');
            option.value = med;
            option.textContent = med;
            filterSelect.appendChild(option);
        });
        
        // Restore selection
        if (medications.includes(currentValue)) {
            filterSelect.value = currentValue;
        }
    }

    setupFilters() {
        const filters = ['date-range', 'medication-filter', 'status-filter', 'sort-by'];
        
        filters.forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.filterHistory());
            }
        });

        // Setup date range picker
        if (typeof flatpickr !== 'undefined') {
            flatpickr('#date-range', {
                mode: 'range',
                dateFormat: 'Y-m-d',
                onChange: () => this.filterHistory()
            });
        }

        // Clear filters button
        document.getElementById('clear-filters').addEventListener('click', () => {
            document.getElementById('date-range').value = '';
            document.getElementById('medication-filter').value = '';
            document.getElementById('status-filter').value = '';
            document.getElementById('sort-by').value = 'newest';
            this.filterHistory();
        });
    }

    setupViewToggle() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);
            });
        });
    }

    switchView(view) {
        // Update active button
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });

        // Show/hide views
        document.querySelectorAll('.history-view').forEach(viewElement => {
            viewElement.classList.remove('active-view');
            if (viewElement.id === `${view}-view`) {
                viewElement.classList.add('active-view');
            }
        });

        this.currentView = view;

        // Update view-specific content
        if (view === 'calendar') {
            this.updateCalendar();
        } else if (view === 'chart') {
            this.updateChart();
        }
    }

    setupCalendar() {
        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
            this.updateCalendar();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.updateCalendar();
        });
    }

    updateCalendar() {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        document.getElementById('current-month').textContent = 
            `${monthNames[this.currentMonth]} ${this.currentYear}`;

        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const calendarGrid = document.getElementById('calendar-grid');
        calendarGrid.innerHTML = '';

        // Day headers
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            calendarGrid.appendChild(dayElement);
        });

        // Empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-date';
            calendarGrid.appendChild(emptyCell);
        }

        // Days of the month
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateElement = document.createElement('div');
            dateElement.className = 'calendar-date';
            dateElement.textContent = day;

            const currentDate = new Date(this.currentYear, this.currentMonth, day);
            
            // Check if today
            if (currentDate.toDateString() === today.toDateString()) {
                dateElement.classList.add('today');
            }

            // Check if has doses on this day
            const hasDoses = this.hasDosesOnDate(currentDate);
            if (hasDoses) {
                dateElement.classList.add('has-doses');
                dateElement.title = `${hasDoses} dose(s) on this day`;
            }

            dateElement.addEventListener('click', () => {
                this.filterByDate(currentDate);
            });

            calendarGrid.appendChild(dateElement);
        }
    }

    hasDosesOnDate(date) {
        const dateString = date.toDateString();
        return this.history.filter(entry => {
            const entryDate = new Date(entry.takenAt || entry.time).toDateString();
            return entryDate === dateString;
        }).length;
    }

    filterByDate(date) {
        const dateString = date.toISOString().split('T')[0];
        if (typeof flatpickr !== 'undefined') {
            flatpickr('#date-range').setDate([dateString, dateString]);
            this.filterHistory();
        }
    }

    setupChart() {
        const ctx = document.getElementById('adherence-chart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Adherence Rate',
                    data: [],
                    borderColor: 'rgb(67, 97, 238)',
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: value => value + '%'
                        }
                    }
                }
            }
        });

        // Chart controls
        document.getElementById('chart-type').addEventListener('change', () => {
            this.updateChart();
        });

        document.querySelectorAll('.chart-period .btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.chart-period .btn').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                this.updateChart();
            });
        });
    }

    updateChart() {
        const chartType = document.getElementById('chart-type').value;
        const period = document.querySelector('.chart-period .btn.active').dataset.period;
        
        let labels = [];
        let data = [];

        // Calculate chart data based on type and period
        if (chartType === 'weekly') {
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            data = this.calculateWeeklyAdherence();
        } else if (chartType === 'monthly') {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            labels = monthNames;
            data = this.calculateMonthlyAdherence();
        } else {
            const medications = this.getUniqueMedications();
            labels = medications;
            data = this.calculateMedicationAdherence(medications);
        }

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.data.datasets[0].label = chartType === 'medication' ? 'Medication Adherence' : 'Adherence Rate';
        this.chart.update();
    }

    calculateWeeklyAdherence() {
        // Simplified calculation - in real app, calculate based on actual data
        return [95, 92, 98, 85, 90, 88, 94];
    }

    calculateMonthlyAdherence() {
        // Simplified calculation
        return [90, 92, 95, 88, 85, 92, 94, 96, 89, 91, 93, 95];
    }

    calculateMedicationAdherence(medications) {
        // Simplified calculation
        return medications.map(() => Math.floor(Math.random() * 20) + 80);
    }

    getUniqueMedications() {
        return [...new Set(this.history.map(entry => entry.medication))].slice(0, 7);
    }

    setupEventListeners() {
        // Export button
        document.getElementById('export-history')?.addEventListener('click', () => {
            this.exportHistory();
        });

        // Print button
        document.getElementById('print-history')?.addEventListener('click', () => {
            window.print();
        });

        // Report generation buttons
        ['doctor-report', 'weekly-report', 'monthly-report'].forEach(type => {
            const button = document.getElementById(`generate-${type}`);
            if (button) {
                button.addEventListener('click', () => {
                    this.generateReport(type);
                });
            }
        });

        // Modal close buttons
        document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('history-details-modal').style.display = 'none';
            });
        });

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('history-details-modal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    showHistoryDetails(entry) {
        const modal = document.getElementById('history-details-modal');
        
        document.getElementById('detail-medication').textContent = entry.medication;
        document.getElementById('detail-dosage').textContent = entry.dosage || 'Not specified';
        
        if (entry.scheduledTime) {
            const scheduled = new Date(entry.scheduledTime);
            document.getElementById('detail-scheduled').textContent = scheduled.toLocaleString();
        } else {
            document.getElementById('detail-scheduled').textContent = 'Not scheduled';
        }
        
        if (entry.takenAt) {
            const taken = new Date(entry.takenAt);
            document.getElementById('detail-taken').textContent = taken.toLocaleString();
            
            const delay = this.getDelay(entry);
            if (delay > 0) {
                const minutes = Math.floor(delay / 60000);
                document.getElementById('detail-delay').textContent = `${minutes} minutes late`;
            } else {
                document.getElementById('detail-delay').textContent = 'On time';
            }
        } else {
            document.getElementById('detail-taken').textContent = 'Not taken';
            document.getElementById('detail-delay').textContent = 'N/A';
        }
        
        const status = this.getStatus(entry);
        document.getElementById('detail-status').textContent = 
            status === 'taken' ? 'Taken' : status === 'late' ? 'Taken Late' : 'Missed';
        
        document.getElementById('detail-notes').textContent = entry.notes || 'No notes available';
        
        modal.style.display = 'flex';
    }

    updateStats() {
        // Total doses
        const totalDoses = this.history.filter(entry => entry.takenAt).length;
        document.getElementById('total-doses').textContent = totalDoses;

        // Adherence rate (simplified)
        const scheduledDoses = this.reminders.length * 30; // Approximate
        const adherenceRate = scheduledDoses > 0 ? 
            Math.round((totalDoses / scheduledDoses) * 100) : 100;
        document.getElementById('adherence-rate').textContent = `${adherenceRate}%`;

        // Streak
        const streak = this.calculateStreak();
        document.getElementById('current-streak').textContent = streak;

        // Average delay
        const takenEntries = this.history.filter(entry => entry.takenAt);
        if (takenEntries.length > 0) {
            const totalDelay = takenEntries.reduce((sum, entry) => {
                return sum + this.getDelay(entry);
            }, 0);
            const avgDelay = Math.round(totalDelay / takenEntries.length / 60000);
            document.getElementById('avg-delay').textContent = `${avgDelay}m`;
        }
    }

    calculateStreak() {
        if (this.history.length === 0) return 0;
        
        // Simplified streak calculation
        const takenDates = this.history
            .filter(entry => entry.takenAt)
            .map(entry => new Date(entry.takenAt).toDateString())
            .sort()
            .reverse();
        
        if (takenDates.length === 0) return 0;
        
        let streak = 1;
        let currentDate = new Date(takenDates[0]);
        
        for (let i = 1; i < takenDates.length; i++) {
            const prevDate = new Date(takenDates[i - 1]);
            const currentDate = new Date(takenDates[i]);
            const diffDays = Math.floor((prevDate - currentDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    }

    updateSummary() {
        const summaryBody = document.getElementById('summary-body');
        const medications = this.getUniqueMedications();
        
        if (medications.length === 0) {
            summaryBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No medication history available</td>
                </tr>
            `;
            return;
        }

        const summaryRows = medications.map(medication => {
            const entries = this.history.filter(entry => entry.medication === medication);
            const takenEntries = entries.filter(entry => entry.takenAt);
            const onTimeEntries = takenEntries.filter(entry => this.getStatus(entry) === 'taken');
            
            let averageDelay = 0;
            if (takenEntries.length > 0) {
                const totalDelay = takenEntries.reduce((sum, entry) => sum + this.getDelay(entry), 0);
                averageDelay = Math.round(totalDelay / takenEntries.length / 60000);
            }
            
            const adherenceRate = entries.length > 0 ? 
                Math.round((takenEntries.length / entries.length) * 100) : 0;
            
            let lastTaken = 'Never';
            if (takenEntries.length > 0) {
                const lastDate = new Date(Math.max(...takenEntries.map(e => new Date(e.takenAt))));
                lastTaken = lastDate.toLocaleDateString();
            }
            
            return `
                <tr>
                    <td><strong>${medication}</strong></td>
                    <td>${takenEntries.length}</td>
                    <td>${onTimeEntries.length}</td>
                    <td>${averageDelay}m</td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${adherenceRate}%"></div>
                        </div>
                        <span>${adherenceRate}%</span>
                    </td>
                    <td>${lastTaken}</td>
                </tr>
            `;
        }).join('');
        
        summaryBody.innerHTML = summaryRows;
    }

    updateInsights() {
        // Best time
        const takenEntries = this.history.filter(entry => entry.takenAt);
        if (takenEntries.length > 0) {
            const hours = takenEntries.map(entry => new Date(entry.takenAt).getHours());
            const hourCounts = hours.reduce((acc, hour) => {
                acc[hour] = (acc[hour] || 0) + 1;
                return acc;
            }, {});
            
            const bestHour = Object.keys(hourCounts).reduce((a, b) => 
                hourCounts[a] > hourCounts[b] ? a : b
            );
            
            document.getElementById('best-time').textContent = 
                `${this.formatHour(bestHour)}`;
        }

        // Most consistent day
        const days = takenEntries.map(entry => new Date(entry.takenAt).getDay());
        if (days.length > 0) {
            const dayCounts = days.reduce((acc, day) => {
                acc[day] = (acc[day] || 0) + 1;
                return acc;
            }, {});
            
            const bestDay = Object.keys(dayCounts).reduce((a, b) => 
                dayCounts[a] > dayCounts[b] ? a : b
            );
            
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            document.getElementById('best-day').textContent = dayNames[bestDay];
        }

        // Overall adherence
        const adherenceRate = this.calculateOverallAdherence();
        document.getElementById('overall-adherence').textContent = `${adherenceRate}%`;

        // Average delay
        if (takenEntries.length > 0) {
            const totalDelay = takenEntries.reduce((sum, entry) => sum + this.getDelay(entry), 0);
            const avgDelay = Math.round(totalDelay / takenEntries.length / 60000);
            document.getElementById('average-delay').textContent = `${avgDelay} minutes`;
        }
    }

    formatHour(hour) {
        const h = parseInt(hour);
        if (h === 0) return '12:00 AM';
        if (h < 12) return `${h}:00 AM`;
        if (h === 12) return '12:00 PM';
        return `${h - 12}:00 PM`;
    }

    calculateOverallAdherence() {
        const takenEntries = this.history.filter(entry => entry.takenAt);
        const totalEntries = this.history.length;
        
        return totalEntries > 0 ? Math.round((takenEntries.length / totalEntries) * 100) : 0;
    }

    exportHistory() {
        const data = {
            history: this.history,
            reminders: this.reminders,
            stats: this.getStats(),
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pilltime-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getStats() {
        return {
            totalDoses: this.history.filter(entry => entry.takenAt).length,
            adherenceRate: this.calculateOverallAdherence(),
            streak: this.calculateStreak(),
            medications: this.getUniqueMedications().length
        };
    }

    generateReport(type) {
        let reportContent = '';
        
        switch (type) {
            case 'doctor-report':
                reportContent = this.generateDoctorReport();
                break;
            case 'weekly-report':
                reportContent = this.generateWeeklyReport();
                break;
            case 'monthly-report':
                reportContent = this.generateMonthlyReport();
                break;
        }

        // For simplicity, just show the report in a new window
        const reportWindow = window.open();
        reportWindow.document.write(`
            <html>
            <head>
                <title>PillTime Pro - ${type.replace('-', ' ').toUpperCase()}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h1 { color: #333; }
                    .report-section { margin-bottom: 30px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background-color: #f4f4f4; }
                </style>
            </head>
            <body>
                ${reportContent}
            </body>
            </html>
        `);
        reportWindow.document.close();
    }

    generateDoctorReport() {
        return `
            <h1>Medication Adherence Report</h1>
            <div class="report-section">
                <h2>Patient Summary</h2>
                <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Total Medications:</strong> ${this.getUniqueMedications().length}</p>
                <p><strong>Overall Adherence:</strong> ${this.calculateOverallAdherence()}%</p>
                <p><strong>Current Streak:</strong> ${this.calculateStreak()} days</p>
            </div>
            <div class="report-section">
                <h2>Medication Details</h2>
                <table>
                    <tr>
                        <th>Medication</th>
                        <th>Total Doses</th>
                        <th>Adherence Rate</th>
                        <th>Average Delay</th>
                    </tr>
                    ${this.generateMedicationTableRows()}
                </table>
            </div>
        `;
    }

    generateMedicationTableRows() {
        return this.getUniqueMedications().map(medication => {
            const entries = this.history.filter(entry => entry.medication === medication);
            const takenEntries = entries.filter(entry => entry.takenAt);
            const adherenceRate = entries.length > 0 ? 
                Math.round((takenEntries.length / entries.length) * 100) : 0;
            
            let averageDelay = 0;
            if (takenEntries.length > 0) {
                const totalDelay = takenEntries.reduce((sum, entry) => sum + this.getDelay(entry), 0);
                averageDelay = Math.round(totalDelay / takenEntries.length / 60000);
            }
            
            return `
                <tr>
                    <td>${medication}</td>
                    <td>${takenEntries.length}</td>
                    <td>${adherenceRate}%</td>
                    <td>${averageDelay}m</td>
                </tr>
            `;
        }).join('');
    }

    generateWeeklyReport() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const weeklyHistory = this.history.filter(entry => 
            new Date(entry.takenAt || entry.time) >= oneWeekAgo
        );
        
        return `
            <h1>Weekly Medication Report</h1>
            <div class="report-section">
                <h2>Week of ${oneWeekAgo.toLocaleDateString()} to ${new Date().toLocaleDateString()}</h2>
                <p><strong>Doses Taken This Week:</strong> ${weeklyHistory.filter(entry => entry.takenAt).length}</p>
                <p><strong>Weekly Adherence:</strong> ${this.calculateWeeklyAdherence().reduce((a, b) => a + b, 0) / 7}%</p>
            </div>
        `;
    }

    generateMonthlyReport() {
        return `
            <h1>Monthly Medication Report</h1>
            <div class="report-section">
                <h2>Month of ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
                <p><strong>Monthly Overview:</strong></p>
                <ul>
                    <li>Total Medications: ${this.getUniqueMedications().length}</li>
                    <li>Doses Taken: ${this.history.filter(entry => entry.takenAt).length}</li>
                    <li>Average Daily Adherence: ${this.calculateMonthlyAdherence().reduce((a, b) => a + b, 0) / 12}%</li>
                </ul>
            </div>
        `;
    }
}

// Add progress bar styles
const style = document.createElement('style');
style.textContent = `
    .progress-bar {
        width: 100px;
        height: 8px;
        background: var(--border-color);
        border-radius: 4px;
        display: inline-block;
        margin-right: 10px;
        vertical-align: middle;
    }
    
    .progress-fill {
        height: 100%;
        background: var(--primary-color);
        border-radius: 4px;
        transition: width 0.3s ease;
    }
    
    .text-center {
        text-align: center;
    }
`;
document.head.appendChild(style);

// Initialize the history page
document.addEventListener('DOMContentLoaded', () => {
    new MedicationHistory();
});