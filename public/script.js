// ========== Alert System ==========
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background-color: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        animation: slideIn 0.3s ease-in-out;
    `;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.animation = 'slideOut 0.3s ease-in-out';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

// ========== Animation Styles ==========
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ========== Dashboard Functions ==========

// Fetch and display visitor count
async function updateVisitorCount() {
    try {
        const response = await fetch('/api/visits');
        const data = await response.json();
        document.getElementById('visitCount').textContent = data.totalVisits;
    } catch (error) {
        console.error('Error fetching visitor count:', error);
        document.getElementById('visitCount').textContent = 'Error';
    }
}

// Fetch and display server uptime
async function updateUptime() {
    try {
        const response = await fetch('/api/uptime');
        const data = await response.json();
        document.getElementById('uptimeValue').textContent = data.formatted;
    } catch (error) {
        console.error('Error fetching uptime:', error);
        document.getElementById('uptimeValue').textContent = 'Error';
    }
}

// Fetch and display current time
async function updateCurrentTime() {
    try {
        const response = await fetch('/api/time');
        const data = await response.json();
        const time = new Date(data.current).toLocaleTimeString();
        document.getElementById('currentTime').textContent = time;
    } catch (error) {
        console.error('Error fetching time:', error);
        document.getElementById('currentTime').textContent = 'Error';
    }
}

// Check health status
async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        document.getElementById('healthStatus').textContent = '✅ ' + data.status;
        showAlert('Health check passed! ✅', 'success');
    } catch (error) {
        console.error('Error checking health:', error);
        document.getElementById('healthStatus').textContent = '❌ Unavailable';
        showAlert('Health check failed! ❌', 'error');
    }
}

// Fetch and display pipeline status
async function updatePipelineStatus() {
    try {
        const response = await fetch('/api/pipeline');
        const data = await response.json();
        
        const statusIcons = {
            'success': '✅',
            'passed': '✅',
            'built': '✅',
            'active': '✅'
        };
        
        const pipelineHtml = `
            <div class="pipeline-item">Jenkins: ${statusIcons[data.jenkins] || '✅'}</div>
            <div class="pipeline-item">SonarCloud: ${statusIcons[data.sonar] || '✅'}</div>
            <div class="pipeline-item">Trivy: ${statusIcons[data.trivy] || '✅'}</div>
            <div class="pipeline-item">Docker: ${statusIcons[data.docker] || '✅'}</div>
            <div class="pipeline-item">Deployment: ${statusIcons[data.deployment] || '✅'}</div>
        `;
        
        document.getElementById('pipelineStatus').innerHTML = pipelineHtml;
    } catch (error) {
        console.error('Error fetching pipeline status:', error);
    }
}

// Fetch and display random quote
async function getNewQuote() {
    try {
        const response = await fetch('/api/quote');
        const data = await response.json();
        document.getElementById('quoteText').textContent = `"${data.quote}"`;
        document.getElementById('quoteAuthor').textContent = `-- ${data.author}`;
        showAlert('New quote loaded! ✨', 'success');
    } catch (error) {
        console.error('Error fetching quote:', error);
        showAlert('Failed to load quote', 'error');
    }
}

// Update system information
async function updateSystemInfo() {
    try {
        const response = await fetch('/api/system');
        const data = await response.json();
        
        document.getElementById('sysPlatform').textContent = data.platform;
        document.getElementById('sysNodeVersion').textContent = data.nodeVersion;
        document.getElementById('sysArchitecture').textContent = data.architecture;
        document.getElementById('sysCpus').textContent = data.cpus;
        document.getElementById('sysMemory').textContent = data.memory.used + ' / ' + data.memory.total;
    } catch (error) {
        console.error('Error fetching system info:', error);
    }
}

// Update API request statistics
async function updateApiStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        document.getElementById('sysApiReqs').textContent = data.totalApiRequests;
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Refresh entire dashboard
async function refreshDashboard() {
    showAlert('Refreshing dashboard...', 'success');
    await Promise.all([
        updateVisitorCount(),
        updateUptime(),
        updateCurrentTime(),
        updatePipelineStatus(),
        updateSystemInfo(),
        updateApiStats(),
        checkHealth()
    ]);
}

// ========== Notes Functions ==========

// Fetch and display all notes
async function loadNotes() {
    try {
        const response = await fetch('/api/notes');
        const data = await response.json();
        
        const notesList = document.getElementById('notesList');
        
        if (data.notes.length === 0) {
            notesList.innerHTML = '<p class="empty-message">No notes yet. Add one to get started!</p>';
            return;
        }
        
        let notesHtml = '';
        data.notes.forEach(note => {
            notesHtml += `
                <div class="note-card">
                    <div class="note-title">${note.title}</div>
                    <div class="note-content">${note.content}</div>
                    <div class="note-footer">
                        <span class="note-time">${new Date(note.timestamp).toLocaleString()}</span>
                        <button class="btn-small btn-delete" onclick="deleteNote(${note.id})">Delete</button>
                    </div>
                </div>
            `;
        });
        
        notesList.innerHTML = notesHtml;
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

// Add a new note
async function addNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title || !content) {
        showAlert('Please fill in both title and content', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('noteTitle').value = '';
            document.getElementById('noteContent').value = '';
            showAlert('Note added successfully! 📝', 'success');
            loadNotes();
        }
    } catch (error) {
        console.error('Error adding note:', error);
        showAlert('Failed to add note', 'error');
    }
}

// Delete a note
async function deleteNote(noteId) {
    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Note deleted! 🗑️', 'success');
            loadNotes();
        }
    } catch (error) {
        console.error('Error deleting note:', error);
        showAlert('Failed to delete note', 'error');
    }
}

// ========== Feedback Functions ==========

// Submit feedback
async function submitFeedback() {
    const name = document.getElementById('feedbackName').value.trim();
    const message = document.getElementById('feedbackMessage').value.trim();
    
    if (!name || !message) {
        showAlert('Please fill in both name and message', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('feedbackName').value = '';
            document.getElementById('feedbackMessage').value = '';
            showAlert('Thank you for your feedback! 💬', 'success');
        }
    } catch (error) {
        console.error('Error submitting feedback:', error);
        showAlert('Failed to submit feedback', 'error');
    }
}

// ========== API Status Check ==========

// Check overall status
async function checkStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        showAlert(`Status: ${data.status} ✅`, 'success');
    } catch (error) {
        showAlert('Failed to fetch status ❌', 'error');
    }
}

// ========== Page Initialization ==========

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    refreshDashboard();
    loadNotes();
    
    // Refresh dashboard every 30 seconds
    setInterval(refreshDashboard, 30000);
    
    // Update time every second
    setInterval(updateCurrentTime, 1000);
    
    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

