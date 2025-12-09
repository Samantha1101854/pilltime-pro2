class PillTimePro {
    constructor() {
        this.reminders = JSON.parse(localStorage.getItem('pilltime-reminders') || '[]');
        this.history = JSON.parse(localStorage.getItem('pilltime-history') || '[]');
        this.currentTheme = localStorage.getItem('pilltime-theme') || 'light';
        this.currentAlert = null;
        this.init();
    }

    init() {
        this.setupTheme();
        this.loadReminders();
        this.setupEventListeners();
        this.updateStats();
        this.startTimers();
        this.setupCurrentTime();
        this.updateNotificationCount();
        this.checkForPastDueReminders();
    }

    setupTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
        const themeSwitch = document.getElementById('theme-switch');
        if (!themeSwitch) return;
        
        const icon = themeSwitch.querySelector('i');
        const text = themeSwitch.querySelector('span');
        
        if (this.currentTheme === 'dark') {
            icon.className = 'fas fa-sun';
            text.textContent = 'Light Mode';
        }

        themeSwitch.addEventListener('click', () => {
            this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', this.currentTheme);
            localStorage.setItem('pilltime-theme', this.currentTheme);
            
            if (this.currentTheme === 'dark') {
                icon.className = 'fas fa-sun';
                text.textContent = 'Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                text.textContent = 'Dark Mode';
            }
        });
    }

    loadReminders() {
        const tbody = document.getElementById('reminders-body');
        const noReminders = document.getElementById('no-reminders');
        
        if (!tbody) return;
        
        if (this.reminders.length === 0) {
            tbody.innerHTML = '';
            if (noReminders) noReminders.style.display = 'block';
            return;
        }

        if (noReminders) noReminders.style.display = 'none';
        tbody.innerHTML = this.reminders.map((reminder, index) => this.createReminderRow(reminder, index)).join('');
        
        this.updateTodaySchedule();
    }

    createReminderRow(reminder, index) {
        const now = new Date();
        const scheduled = new Date(reminder.time);
        const timeDiff = scheduled - now;
        
        let countdown = 'Now';
        let status = 'pending';
        
        if (timeDiff > 0) {
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            countdown = `${hours}h ${minutes}m`;
        } else if (timeDiff < -1800000) {
            status = 'missed';
        }

        return `
            <tr data-id="${reminder.id}">
                <td>
                    <div class="medication-info">
                        <strong>${reminder.medication}</strong>
                        ${reminder.dosage ? `<div class="muted">${reminder.dosage}${reminder.dosageUnit || ''}</div>` : ''}
                    </div>
                </td>
                <td>${this.formatTime(scheduled)}</td>
                <td>
                    <span class="countdown" data-time="${reminder.time}">${countdown}</span>
                </td>
                <td>
                    <span class="schedule-status status-${status}">
                        ${status === 'pending' ? 'Pending' : status === 'missed' ? 'Missed' : 'Taken'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-success btn-sm" onclick="pillTime.markAsTaken('${reminder.id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="pillTime.snoozeReminder('${reminder.id}')">
                            <i class="fas fa-clock"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="pillTime.deleteReminder('${reminder.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    updateTodaySchedule() {
        const todaySchedule = document.getElementById('today-schedule');
        if (!todaySchedule) return;
        
        const today = new Date().toDateString();
        
        const todayReminders = this.reminders.filter(reminder => {
            const reminderDate = new Date(reminder.time).toDateString();
            return reminderDate === today;
        }).sort((a, b) => new Date(a.time) - new Date(b.time));
        
        if (todayReminders.length === 0) {
            todaySchedule.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-check"></i>
                    <p>No medications scheduled for today</p>
                </div>
            `;
            return;
        }

        todaySchedule.innerHTML = todayReminders.map(reminder => {
            const scheduled = new Date(reminder.time);
            const now = new Date();
            const status = scheduled < now ? 'taken' : 'pending';
            
            return `
                <div class="schedule-item">
                    <div class="schedule-time">${this.formatTime(scheduled)}</div>
                    <div class="schedule-medication">
                        <strong>${reminder.medication}</strong>
                        ${reminder.dosage ? `<div class="muted">${reminder.dosage}${reminder.dosageUnit || ''}</div>` : ''}
                    </div>
                    <div class="schedule-status status-${status}">
                        ${status === 'taken' ? 'Taken' : 'Upcoming'}
                    </div>
                </div>
            `;
        }).join('');
    }

    updateStats() {
        const today = new Date().toDateString();
        const takenToday = this.history.filter(entry => 
            entry.action === 'taken' && new Date(entry.takenAt).toDateString() === today
        ).length;

        document.getElementById('active-reminders-count').textContent = this.reminders.length;
        document.getElementById('taken-today').textContent = takenToday;
        
        // Calculate compliance rate
        const totalTaken = this.history.filter(entry => entry.action === 'taken').length;
        const totalScheduled = this.reminders.length * 30; // Estimated
        const complianceRate = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 100;
        document.getElementById('compliance-rate').textContent = `${Math.min(complianceRate, 100)}%`;

        // Calculate streak
        const streak = this.calculateStreak();
        document.getElementById('streak-days').textContent = streak;
    }

    calculateStreak() {
        if (this.history.length === 0) return 0;
        
        const takenEntries = this.history
            .filter(entry => entry.action === 'taken')
            .map(entry => new Date(entry.takenAt).toDateString());
        
        if (takenEntries.length === 0) return 0;
        
        const uniqueDays = [...new Set(takenEntries)].sort().reverse();
        let streak = 0;
        let currentDate = new Date();
        
        for (let i = 0; i < uniqueDays.length; i++) {
            const entryDate = new Date(uniqueDays[i]);
            if (entryDate.toDateString() === currentDate.toDateString()) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        return streak;
    }

    setupEventListeners() {
        // Clear All Button
        const clearAllBtn = document.getElementById('clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all reminders?')) {
                    this.reminders = [];
                    localStorage.setItem('pilltime-reminders', JSON.stringify(this.reminders));
                    this.loadReminders();
                    this.updateStats();
                    this.updateNotificationCount();
                }
            });
        }

        // Enable Notifications
        const requestNotifBtn = document.getElementById('request-notif');
        if (requestNotifBtn) {
            requestNotifBtn.addEventListener('click', () => {
                if ('Notification' in window) {
                    if (Notification.permission === 'default') {
                        Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                                alert('Notifications enabled!');
                            }
                        });
                    } else if (Notification.permission === 'denied') {
                        alert('Notifications are blocked. Please enable them in browser settings.');
                    } else {
                        alert('Notifications are already enabled.');
                    }
                } else {
                    alert('This browser does not support notifications.');
                }
            });
        }

        // Export Data
        const exportBtn = document.getElementById('export-data');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // Alert popup buttons
        const closeAlertBtn = document.querySelector('.close-alert');
        if (closeAlertBtn) {
            closeAlertBtn.addEventListener('click', () => {
                this.hideAlert();
            });
        }

        const confirmTakenBtn = document.getElementById('confirm-taken');
        if (confirmTakenBtn) {
            confirmTakenBtn.addEventListener('click', () => {
                if (this.currentAlert) {
                    this.markAsTaken(this.currentAlert.id);
                }
                this.hideAlert();
            });
        }

        const snoozeAlertBtn = document.getElementById('snooze-alert');
        if (snoozeAlertBtn) {
            snoozeAlertBtn.addEventListener('click', () => {
                if (this.currentAlert) {
                    this.snoozeReminder(this.currentAlert.id);
                }
                this.hideAlert();
            });
        }
    }

    startTimers() {
        // Update countdowns every minute
        setInterval(() => {
            this.updateCountdowns();
            this.checkAlerts();
        }, 60000);

        // Update countdowns immediately
        this.updateCountdowns();
        
        // Check for alerts immediately
        this.checkAlerts();
    }

    updateCountdowns() {
        document.querySelectorAll('.countdown').forEach(element => {
            const scheduledTime = new Date(element.dataset.time);
            const now = new Date();
            const timeDiff = scheduledTime - now;
            
            if (timeDiff <= 0) {
                element.textContent = 'Now';
                element.style.color = 'var(--danger-color)';
                element.style.fontWeight = '600';
            } else {
                const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                element.textContent = `${hours}h ${minutes}m`;
                element.style.color = '';
                element.style.fontWeight = '';
            }
        });
    }

    checkAlerts() {
        const now = new Date();
        
        this.reminders.forEach((reminder) => {
            const scheduledTime = new Date(reminder.time);
            const timeDiff = scheduledTime - now;
            
            // Show alert if within 1 minute of scheduled time
            if (timeDiff <= 60000 && timeDiff > -300000) { // Within 5 minutes after
                const alertShown = localStorage.getItem(`alert-${reminder.id}`);
                if (!alertShown) {
                    this.showAlert(reminder);
                    localStorage.setItem(`alert-${reminder.id}`, 'true');
                }
            }
        });
    }

    checkForPastDueReminders() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        this.reminders.forEach(reminder => {
            const scheduled = new Date(reminder.time);
            if (scheduled < oneHourAgo && scheduled > now) {
                // Mark as missed
                this.addToHistory(reminder, 'missed');
            }
        });
    }

    showAlert(reminder) {
        const alert = document.getElementById('medicine-alert');
        const audio = document.getElementById('reminder-audio');
        
        if (!alert || !audio) return;
        
        document.getElementById('alert-medication-name').textContent = reminder.medication;
        document.getElementById('alert-medication-time').textContent = 
            `Scheduled for ${this.formatTime(new Date(reminder.time))}`;
        
        this.currentAlert = reminder;
        alert.style.display = 'flex';
        
        // Try to play audio
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio play failed:', e));
        
        // Request notification permission if needed
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('PillTime Pro - Medication Reminder', {
                body: `Time to take: ${reminder.medication}`,
                icon: 'https://img.icons8.com/color/96/000000/pill.png'
            });
        }
    }

    hideAlert() {
        const alert = document.getElementById('medicine-alert');
        const audio = document.getElementById('reminder-audio');
        
        if (alert) alert.style.display = 'none';
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        this.currentAlert = null;
    }

    markAsTaken(reminderId) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (!reminder) return;

        // Add to history
        this.addToHistory(reminder, 'taken');

        // Remove from reminders if it's a one-time reminder
        if (reminder.recurrence === 'once') {
            this.reminders = this.reminders.filter(r => r.id !== reminderId);
        } else {
            // For recurring reminders, update to next occurrence
            const nextTime = this.calculateNextOccurrence(reminder);
            reminder.time = nextTime.toISOString();
            reminder.lastTaken = new Date().toISOString();
        }

        // Save changes
        localStorage.setItem('pilltime-reminders', JSON.stringify(this.reminders));
        
        // Update UI
        this.loadReminders();
        this.updateStats();
        this.updateNotificationCount();
        this.hideAlert();
        
        // Clear alert flag
        localStorage.removeItem(`alert-${reminderId}`);
    }

    calculateNextOccurrence(reminder) {
        const now = new Date();
        const scheduled = new Date(reminder.time);
        
        if (reminder.recurrence === 'daily') {
            // Add 24 hours
            scheduled.setDate(scheduled.getDate() + 1);
        } else if (reminder.recurrence === 'weekly') {
            // Add 7 days
            scheduled.setDate(scheduled.getDate() + 7);
        }
        
        // If the next occurrence is in the past, keep adding until it's in the future
        while (scheduled <= now) {
            if (reminder.recurrence === 'daily') {
                scheduled.setDate(scheduled.getDate() + 1);
            } else if (reminder.recurrence === 'weekly') {
                scheduled.setDate(scheduled.getDate() + 7);
            }
        }
        
        return scheduled;
    }

    addToHistory(reminder, action) {
        const historyEntry = {
            id: Date.now().toString(),
            reminderId: reminder.id,
            medication: reminder.medication,
            dosage: reminder.dosage ? `${reminder.dosage}${reminder.dosageUnit || ''}` : null,
            action: action,
            takenAt: new Date().toISOString(),
            scheduledTime: reminder.time,
            notes: reminder.notes || null
        };

        this.history.push(historyEntry);
        localStorage.setItem('pilltime-history', JSON.stringify(this.history));
    }

    snoozeReminder(reminderId) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (!reminder) return;

        // Add 5 minutes to the scheduled time
        const newTime = new Date(new Date(reminder.time).getTime() + 5 * 60000);
        reminder.time = newTime.toISOString();
        
        localStorage.setItem('pilltime-reminders', JSON.stringify(this.reminders));
        this.loadReminders();
        this.hideAlert();
        
        // Clear alert flag so it can trigger again
        localStorage.removeItem(`alert-${reminderId}`);
    }

    deleteReminder(reminderId) {
        if (confirm('Delete this reminder?')) {
            this.reminders = this.reminders.filter(r => r.id !== reminderId);
            localStorage.setItem('pilltime-reminders', JSON.stringify(this.reminders));
            this.loadReminders();
            this.updateStats();
            this.updateNotificationCount();
            
            // Clear alert flag
            localStorage.removeItem(`alert-${reminderId}`);
        }
    }

    exportData() {
        const data = {
            reminders: this.reminders,
            history: this.history,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pilltime-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    setupCurrentTime() {
        const timeElement = document.getElementById('current-time');
        if (!timeElement) return;
        
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
            timeElement.textContent = timeString;
        };

        updateTime();
        setInterval(updateTime, 1000);
    }

    updateNotificationCount() {
        const notificationCount = document.getElementById('notification-count');
        if (notificationCount) {
            notificationCount.textContent = this.reminders.length;
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    }

    // Public method to add reminder from add page
    addReminder(reminderData) {
        const reminder = {
            id: Date.now().toString(),
            ...reminderData,
            createdAt: new Date().toISOString(),
            status: 'active'
        };

        this.reminders.push(reminder);
        localStorage.setItem('pilltime-reminders', JSON.stringify(this.reminders));
        
        // Add to history as created
        this.addToHistory(reminder, 'created');
        
        this.updateNotificationCount();
        
        return reminder;
    }
}

// Initialize the application
const pillTime = new PillTimePro();

// Make it globally available
window.pillTime = pillTime;