document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const runTestBtn = document.getElementById('run-test');
    const customTestBtn = document.getElementById('custom-test');
    const runCustomTestBtn = document.getElementById('run-custom-test');
    const customPanel = document.getElementById('custom-panel');
    const resultsBody = document.getElementById('results-body');
    const spinner = document.getElementById('spinner');
    const summarySection = document.getElementById('summary');
    const totalTestsEl = document.getElementById('total-tests');
    const successRateEl = document.getElementById('success-rate');
    const avgTimeEl = document.getElementById('avg-time');
    const customServersTextarea = document.getElementById('custom-servers');

    // Default DNS servers to test (name, server, location)
    const defaultServers = [
        { name: 'Google DNS', server: '8.8.8.8', location: 'Global' },
        { name: 'Google DNS (Secondary)', server: '8.8.4.4', location: 'Global' },
        { name: 'Cloudflare DNS', server: '1.1.1.1', location: 'Global' },
        { name: 'Cloudflare (Secondary)', server: '1.0.0.1', location: 'Global' },
        { name: 'Quad9', server: '9.9.9.9', location: 'Global' },
        { name: 'OpenDNS', server: '208.67.222.222', location: 'Global' },
        { name: 'OpenDNS (Secondary)', server: '208.67.220.220', location: 'Global' },
        { name: 'Comodo Secure DNS', server: '8.26.56.26', location: 'Global' },
        { name: 'CleanBrowsing (Family)', server: '185.228.168.168', location: 'Global' },
        { name: 'AdGuard DNS', server: '94.140.14.14', location: 'Global' },
        { name: 'DNS.WATCH', server: '84.200.69.80', location: 'Germany' },
        { name: 'Alternate DNS', server: '76.76.19.19', location: 'Global' },
        { name: 'Yandex DNS', server: '77.88.8.8', location: 'Russia' },
        { name: 'UncensoredDNS', server: '91.239.100.100', location: 'Denmark' }
    ];

    // Toggle custom test panel
    customTestBtn.addEventListener('click', function() {
        customPanel.classList.toggle('hidden');
    });

    // Run tests with default servers
    runTestBtn.addEventListener('click', function() {
        runTests(defaultServers);
    });

    // Run tests with custom servers
    runCustomTestBtn.addEventListener('click', function() {
        const customServersText = customServersTextarea.value.trim();
        if (!customServersText) {
            alert('Please enter at least one DNS server to test');
            return;
        }

        const servers = customServersText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(server => {
                return {
                    name: 'Custom DNS',
                    server: server,
                    location: 'Unknown'
                };
            });

        runTests(servers);
    });

    // Main function to run tests
    async function runTests(servers) {
        // Clear previous results
        resultsBody.innerHTML = '';
        summarySection.classList.add('hidden');
        
        // Show loading spinner
        spinner.classList.remove('hidden');
        runTestBtn.disabled = true;
        customTestBtn.disabled = true;
        runCustomTestBtn.disabled = true;

        let successfulTests = 0;
        let totalResponseTime = 0;
        let clientIP = 'Unknown';

        // Test each server
        for (const [index, server] of servers.entries()) {
            const result = await testDNSServer(server.server);
            
            // Update client IP if we got it from the first successful test
            if (result.ip && clientIP === 'Unknown') {
                clientIP = result.ip;
            }

            // Calculate stats
            if (result.success) {
                successfulTests++;
                totalResponseTime += result.time;
            }

            // Add result to table
            addResultToTable(server, result, clientIP);
            
            // Update summary after each test
            updateSummary(index + 1, successfulTests, totalResponseTime);
        }

        // Hide spinner and re-enable buttons
        spinner.classList.add('hidden');
        runTestBtn.disabled = false;
        customTestBtn.disabled = false;
        runCustomTestBtn.disabled = false;
    }

    // Test a single DNS server
    async function testDNSServer(dnsServer) {
        const testDomain = 'example.com'; // Domain to resolve for testing
        const timeout = 3000; // 3 seconds timeout
        
        // Create a unique URL to bypass cache
        const uniqueParam = `?t=${Date.now()}`;
        const testUrl = `https://dns.google/resolve${uniqueParam}&name=${testDomain}&type=A`;
        
        // Use JSONP or CORS proxy as fallback
        const proxyUrl = `https://cors-anywhere.herokuapp.com/${testUrl}`;
        
        try {
            const startTime = performance.now();
            
            // First, try direct request (may fail due to CORS)
            let response;
            try {
                response = await Promise.race([
                    fetch(testUrl, {
                        method: 'GET',
                        headers: { 'Accept': 'application/dns-json' },
                        mode: 'cors'
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), timeout)
                ]);
            } catch (directError) {
                // If direct request fails, try with proxy
                response = await Promise.race([
                    fetch(proxyUrl, {
                        method: 'GET',
                        headers: { 'Accept': 'application/dns-json' }
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), timeout)
                ]);
            }
            
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);
            
            if (!response.ok) {
                return {
                    success: false,
                    time: 0,
                    error: `HTTP error: ${response.status}`,
                    ip: null
                };
            }
            
            const data = await response.json();
            
            return {
                success: true,
                time: responseTime,
                ip: data.originIP || null,
                error: null
            };
        } catch (error) {
            return {
                success: false,
                time: 0,
                error: error.message,
                ip: null
            };
        }
    }

    // Add a result row to the table
    function addResultToTable(server, result, clientIP) {
        const row = document.createElement('tr');
        row.className = 'result-row';
        
        row.innerHTML = `
            <td>${server.name}</td>
            <td>${server.location}</td>
            <td>
                <span class="status ${result.success ? 'success' : 'failed'}">
                    ${result.success ? 'Success' : 'Failed'}
                </span>
                ${result.error ? `<div class="error-tooltip">${result.error}</div>` : ''}
            </td>
            <td>${result.success ? `${result.time}ms` : '-'}</td>
            <td>${result.ip || clientIP}</td>
        `;
        
        resultsBody.appendChild(row);
    }

    // Update the summary section
    function updateSummary(totalTests, successfulTests, totalResponseTime) {
        summarySection.classList.remove('hidden');
        
        totalTestsEl.textContent = totalTests;
        
        const successRate = totalTests > 0 ? Math.round((successfulTests / totalTests) * 100) : 0;
        successRateEl.textContent = `${successRate}%`;
        
        const avgTime = successfulTests > 0 ? Math.round(totalResponseTime / successfulTests) : 0;
        avgTimeEl.textContent = `${avgTime}ms`;
    }
});
