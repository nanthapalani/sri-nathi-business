export const renderDonutChart = (canvasId, labels, data, colors) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();
    new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right' } } }
    });
};

export const renderBarChart = (canvasId, labels, data, labelName) => {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: labelName || 'Dataset',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // horizontal bar chart
            responsive: true,
            maintainAspectRatio: false
        }
    });
};
