// AQI Dashboard with Real-time Weather API Integration
// Using OpenWeatherMap Weather API

const API_KEY = 'd44feca1ed95f86be52c9bec274ec95e'  ; 
// Replace with your actual API key
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';
const AIR_POLLUTION_API_URL = 'https://api.openweathermap.org/data/2.5/air_pollution';

// City coordinates
const cityCoordinates = {
    delhi: { lat: 28.6139, lon: 77.2090, name: 'Delhi' },
    mumbai: { lat: 19.0760, lon: 72.8777, name: 'Mumbai' },
    bangalore: { lat: 12.9716, lon: 77.5946, name: 'Bangalore' },
    kolkata: { lat: 22.5726, lon: 88.3639, name: 'Kolkata' },
    chennai: { lat: 13.0827, lon: 80.2707, name: 'Chennai' },
    lucknow: { lat: 26.85, lon: 80.95, name: 'Lucknow' }
};

let currentCity = 'lucknow';
let aqiTrendChart, pollutantsChart, forecastChart;
let historicalData = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    loadAQIData();
    
    // Event listeners
    document.getElementById('citySelect').addEventListener('change', function(e) {
        currentCity = e.target.value;
        loadAQIData();
    });
    
    document.getElementById('refreshBtn').addEventListener('click', function() {
        loadAQIData();
    });
    
    document.getElementById('closeAlert').addEventListener('click', function() {
        document.getElementById('alertBanner').classList.add('hidden');
    });
    
    // Auto-refresh every 10 minutes
    setInterval(loadAQIData, 600000);
});

// Fetch real-time AQI and Weather data
async function loadAQIData() {
    const coords = cityCoordinates[currentCity];
    
    try {
        showLoading(true);
        
        // Fetch weather data
        const weatherResponse = await fetch(
            `${WEATHER_API_URL}?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}&units=metric`
        );
        
        if (!weatherResponse.ok) {
            throw new Error('Failed to fetch weather data');
        }
        
        const weatherData = await weatherResponse.json();
        
        // Fetch air pollution data
        const airPollutionResponse = await fetch(
            `${AIR_POLLUTION_API_URL}?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}`
        );
        
        const airPollutionData = await airPollutionResponse.json();
        
        // Fetch forecast data
        const forecastResponse = await fetch(
            `${AIR_POLLUTION_API_URL}/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${API_KEY}`
        );
        
        const forecastData = await forecastResponse.json();
        
        // Update dashboard with real data
        updateCurrentAQI(airPollutionData, weatherData);
        updatePollutants(airPollutionData);
        updatePredictions(forecastData);
        updateCharts(forecastData);
        
        // Store historical data
        storeHistoricalData(airPollutionData);
        
        showLoading(false);
        updateLastUpdated();
        showNotification(`✅ Data updated for ${coords.name}`, 'success');
        
    } catch (error) {
        console.error('Error fetching AQI data:', error);
        showNotification('⚠️ Failed to fetch data. Using demo data.', 'error');
        showLoading(false);
        
        // Fallback to demo data if API fails
        loadDemoData();
    }
}

// Update current AQI display
function updateCurrentAQI(airData, weatherData) {
    const aqiValue = convertToUSAQI(airData.list[0]);
    
    document.getElementById('aqiValue').textContent = aqiValue;
    
    const category = getAQICategory(aqiValue);
    const categoryElement = document.getElementById('aqiCategory');
    categoryElement.textContent = category.label;
    categoryElement.className = `aqi-category ${category.class}`;
    
    // Update card background color
    const aqiCard = document.querySelector('.current-aqi');
    aqiCard.style.borderLeft = `5px solid ${category.color}`;
    
    // Show alert if AQI is unhealthy
    if (aqiValue > 150) {
        showAlert(aqiValue, category);
    } else {
        document.getElementById('alertBanner').classList.add('hidden');
    }
}

// Update pollutants data
function updatePollutants(airData) {
    const components = airData.list[0].components;
    
    document.getElementById('pm25Value').textContent = (components.pm2_5 || 0).toFixed(1) + ' µg/m³';
    document.getElementById('pm10Value').textContent = (components.pm10 || 0).toFixed(1) + ' µg/m³';
    document.getElementById('no2Value').textContent = (components.no2 || 0).toFixed(1) + ' µg/m³';
    document.getElementById('o3Value').textContent = (components.o3 || 0).toFixed(1) + ' µg/m³';
    document.getElementById('so2Value').textContent = (components.so2 || 0).toFixed(1) + ' µg/m³';
    document.getElementById('coValue').textContent = ((components.co || 0) / 1000).toFixed(2) + ' mg/m³';
}

// Update predictions
function updatePredictions(forecastData) {
    const forecast = forecastData.list;
    
    if (!forecast || forecast.length === 0) {
        document.getElementById('tomorrowAQI').textContent = '--';
        document.getElementById('avg24hAQI').textContent = '--';
        return;
    }
    
    // Tomorrow's AQI (24 hours ahead - approximately 24th item in hourly forecast)
    if (forecast.length > 24) {
        const tomorrowAQI = convertToUSAQI(forecast[24]);
        document.getElementById('tomorrowAQI').textContent = tomorrowAQI;
    } else if (forecast.length > 0) {
        const tomorrowAQI = convertToUSAQI(forecast[forecast.length - 1]);
        document.getElementById('tomorrowAQI').textContent = tomorrowAQI;
    }
    
    // 24-hour average
    const next24Hours = forecast.slice(0, Math.min(24, forecast.length));
    const avgAQI = Math.round(
        next24Hours.reduce((sum, item) => sum + convertToUSAQI(item), 0) / next24Hours.length
    );
    document.getElementById('avg24hAQI').textContent = avgAQI;
}

// Convert pollutant data to US AQI scale
function convertToUSAQI(data) {
    const pm25 = data.components.pm2_5 || 0;
    const pm10 = data.components.pm10 || 0;
    
    // US AQI calculation based on PM2.5 (primary pollutant in India)
    let aqi;
    if (pm25 <= 12.0) {
        aqi = (50 / 12.0) * pm25;
    } else if (pm25 <= 35.4) {
        aqi = 50 + ((100 - 50) / (35.4 - 12.0)) * (pm25 - 12.0);
    } else if (pm25 <= 55.4) {
        aqi = 100 + ((150 - 100) / (55.4 - 35.4)) * (pm25 - 35.4);
    } else if (pm25 <= 150.4) {
        aqi = 150 + ((200 - 150) / (150.4 - 55.4)) * (pm25 - 55.4);
    } else if (pm25 <= 250.4) {
        aqi = 200 + ((300 - 200) / (250.4 - 150.4)) * (pm25 - 150.4);
    } else if (pm25 <= 350.4) {
        aqi = 300 + ((400 - 300) / (350.4 - 250.4)) * (pm25 - 250.4);
    } else if (pm25 <= 500.4) {
        aqi = 400 + ((500 - 400) / (500.4 - 350.4)) * (pm25 - 350.4);
    } else {
        aqi = 500;
    }
    
    return Math.round(Math.max(0, Math.min(500, aqi)));
}

// Get AQI category
function getAQICategory(aqi) {
    if (aqi <= 50) {
        return { label: 'Good', class: 'good', color: '#00e400' };
    } else if (aqi <= 100) {
        return { label: 'Moderate', class: 'moderate', color: '#ffff00' };
    } else if (aqi <= 150) {
        return { label: 'Unhealthy for Sensitive Groups', class: 'unhealthy-sensitive', color: '#ff7e00' };
    } else if (aqi <= 200) {
        return { label: 'Unhealthy', class: 'unhealthy', color: '#ff0000' };
    } else if (aqi <= 300) {
        return { label: 'Very Unhealthy', class: 'very-unhealthy', color: '#8f3f97' };
    } else {
        return { label: 'Hazardous', class: 'hazardous', color: '#7e0023' };
    }
}

// Show alert banner
function showAlert(aqi, category) {
    const alertBanner = document.getElementById('alertBanner');
    const alertMessage = document.getElementById('alertMessage');
    const alertIcon = document.getElementById('alertIcon');
    
    alertBanner.classList.remove('hidden');
    alertBanner.className = `alert-banner ${category.class}`;
    
    if (aqi > 300) {
        alertIcon.textContent = '☠️';
        alertMessage.textContent = 'HAZARDOUS AIR QUALITY! Stay indoors and avoid all outdoor activities.';
    } else if (aqi > 200) {
        alertIcon.textContent = '⚠️';
        alertMessage.textContent = 'Very Unhealthy Air! Everyone should avoid outdoor activities.';
    } else if (aqi > 150) {
        alertIcon.textContent = '⚠️';
        alertMessage.textContent = 'Unhealthy Air Quality! Sensitive groups should limit outdoor exposure.';
    }
}

// Store historical data for trend chart
function storeHistoricalData(airData) {
    const aqi = convertToUSAQI(airData.list[0]);
    const timestamp = new Date();
    
    historicalData.push({ timestamp, aqi });
    
    // Keep only last 7 days of data
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    historicalData = historicalData.filter(item => item.timestamp > sevenDaysAgo);
}

// Initialize charts
function initializeCharts() {
    // AQI Trend Chart
    const trendCtx = document.getElementById('aqiTrendChart').getContext('2d');
    aqiTrendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'AQI',
                data: [],
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'AQI Value'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });
    
    // Pollutants Chart
    const pollutantsCtx = document.getElementById('pollutantsChart').getContext('2d');
    pollutantsChart = new Chart(pollutantsCtx, {
        type: 'doughnut',
        data: {
            labels: ['PM2.5', 'PM10', 'NO₂', 'O₃', 'SO₂', 'CO'],
            datasets: [{
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed.toFixed(1) + ' µg/m³';
                        }
                    }
                }
            }
        }
    });
    
    // Forecast Chart
    const forecastCtx = document.getElementById('forecastChart').getContext('2d');
    forecastChart = new Chart(forecastCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Predicted AQI',
                data: [],
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'AQI Value'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time (Hours)'
                    }
                }
            }
        }
    });
}

// Update charts with real data
function updateCharts(forecastData) {
    const forecast = forecastData.list || [];
    
    // Update trend chart with historical data
    if (historicalData.length > 0) {
        const trendLabels = historicalData.map(item => 
            item.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        );
        const trendData = historicalData.map(item => item.aqi);
        
        aqiTrendChart.data.labels = trendLabels;
        aqiTrendChart.data.datasets[0].data = trendData;
    } else {
        // Generate demo trend data for first load
        const demoLabels = [];
        const demoData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            demoLabels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            demoData.push(Math.floor(80 + Math.random() * 80));
        }
        aqiTrendChart.data.labels = demoLabels;
        aqiTrendChart.data.datasets[0].data = demoData;
    }
    aqiTrendChart.update();
    
    // Update pollutants chart
    if (forecast.length > 0) {
        const currentPollutants = forecast[0].components;
        pollutantsChart.data.datasets[0].data = [
            currentPollutants.pm2_5 || 0,
            currentPollutants.pm10 || 0,
            currentPollutants.no2 || 0,
            currentPollutants.o3 || 0,
            currentPollutants.so2 || 0,
            (currentPollutants.co || 0) / 1000
        ];
        pollutantsChart.update();
    }
    
    // Update forecast chart (next 24 hours)
    if (forecast.length > 0) {
        const forecastLabels = [];
        const forecastDataPoints = [];
        
        const hoursToShow = Math.min(24, forecast.length);
        for (let i = 0; i < hoursToShow; i++) {
            const date = new Date(forecast[i].dt * 1000);
            forecastLabels.push(date.getHours() + ':00');
            forecastDataPoints.push(convertToUSAQI(forecast[i]));
        }
        
        forecastChart.data.labels = forecastLabels;
        forecastChart.data.datasets[0].data = forecastDataPoints;
        
        // Color bars based on AQI level
        forecastChart.data.datasets[0].backgroundColor = forecastDataPoints.map(aqi => {
            const category = getAQICategory(aqi);
            return category.color + '99';
        });
        
        forecastChart.update();
    }
}

// Fallback demo data if API fails
function loadDemoData() {
    const baseAQI = 120 + Math.random() * 80;
    
    document.getElementById('aqiValue').textContent = Math.round(baseAQI);
    
    const category = getAQICategory(baseAQI);
    const categoryElement = document.getElementById('aqiCategory');
    categoryElement.textContent = category.label;
    categoryElement.className = `aqi-category ${category.class}`;
    
    // Demo pollutants
    document.getElementById('pm25Value').textContent = (baseAQI * 0.6).toFixed(1) + ' µg/m³';
    document.getElementById('pm10Value').textContent = (baseAQI * 0.8).toFixed(1) + ' µg/m³';
    document.getElementById('no2Value').textContent = (baseAQI * 0.3).toFixed(1) + ' µg/m³';
    document.getElementById('o3Value').textContent = (baseAQI * 0.4).toFixed(1) + ' µg/m³';
    document.getElementById('so2Value').textContent = (baseAQI * 0.2).toFixed(1) + ' µg/m³';
    document.getElementById('coValue').textContent = (baseAQI * 0.01).toFixed(2) + ' mg/m³';
    
    // Demo predictions
    document.getElementById('tomorrowAQI').textContent = Math.round(baseAQI + (Math.random() - 0.5) * 20);
    document.getElementById('avg24hAQI').textContent = Math.round(baseAQI);
    
    // Update demo charts
    const demoLabels = [];
    const demoData = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        demoLabels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        demoData.push(Math.floor(80 + Math.random() * 80));
    }
    
    aqiTrendChart.data.labels = demoLabels;
    aqiTrendChart.data.datasets[0].data = demoData;
    aqiTrendChart.update();
    
    updateLastUpdated();
}

// Utility functions
function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdated').textContent = timeString;
}

function showLoading(show) {
    const refreshBtn = document.getElementById('refreshBtn');
    if (show) {
        refreshBtn.textContent = '⏳ Loading...';
        refreshBtn.disabled = true;
    } else {
        refreshBtn.textContent = '🔄 Refresh Data';
        refreshBtn.disabled = false;
    }
}

function showNotification(message, type) {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Create a simple toast notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);
