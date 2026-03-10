/**
 * Performance Monitoring Script
 * Tracks Core Web Vitals and custom performance metrics
 */

class PerformanceMonitor {
    constructor(options = {}) {
        this.options = {
            enableConsoleLogging: options.enableConsoleLogging ?? true,
            enableAnalytics: options.enableAnalytics ?? false,
            analyticsEndpoint: options.analyticsEndpoint || '/api/performance',
            sampleRate: options.sampleRate ?? 1, // 1 = 100% sampling
            ...options
        };
        
        this.metrics = {};
        this.observers = [];
        this.startTime = performance.now();
        
        this.init();
    }
    
    init() {
        // Initialize performance observers
        this.initWebVitals();
        this.initCustomMetrics();
        this.initResourceTiming();
        this.initMemoryMonitoring();
        
        // Monitor page lifecycle
        this.initPageLifecycle();
        
        // Start monitoring
        this.log('Performance monitoring initialized');
    }
    
    initWebVitals() {
        // First Contentful Paint (FCP)
        this.observePerformanceEntry('paint', (entries) => {
            entries.forEach(entry => {
                if (entry.name === 'first-contentful-paint') {
                    this.recordMetric('FCP', entry.startTime, 'ms');
                }
            });
        });
        
        // Largest Contentful Paint (LCP)
        this.observePerformanceEntry('largest-contentful-paint', (entries) => {
            const lastEntry = entries[entries.length - 1];
            this.recordMetric('LCP', lastEntry.startTime, 'ms');
        });
        
        // First Input Delay (FID)
        this.observePerformanceEntry('first-input', (entries) => {
            entries.forEach(entry => {
                this.recordMetric('FID', entry.processingStart - entry.startTime, 'ms');
            });
        });
        
        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        this.observePerformanceEntry('layout-shift', (entries) => {
            entries.forEach(entry => {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            });
            this.recordMetric('CLS', clsValue, 'score');
        });
    }
    
    initCustomMetrics() {
        // Time to Interactive (TTI) approximation
        window.addEventListener('load', () => {
            setTimeout(() => {
                const tti = performance.now();
                this.recordMetric('TTI', tti, 'ms');
            }, 100);
        });
        
        // DOM Content Loaded
        document.addEventListener('DOMContentLoaded', () => {
            this.recordMetric('DOM_READY', performance.now(), 'ms');
        });
        
        // Page Load Complete
        window.addEventListener('load', () => {
            this.recordMetric('LOAD_COMPLETE', performance.now(), 'ms');
        });
    }
    
    initResourceTiming() {
        this.observePerformanceEntry('resource', (entries) => {
            const resources = {
                scripts: [],
                stylesheets: [],
                images: [],
                fonts: [],
                other: []
            };
            
            entries.forEach(entry => {
                const resource = {
                    name: entry.name,
                    duration: entry.duration,
                    transferSize: entry.transferSize || 0,
                    encodedBodySize: entry.encodedBodySize || 0,
                    decodedBodySize: entry.decodedBodySize || 0
                };
                
                if (entry.name.includes('.js')) {
                    resources.scripts.push(resource);
                } else if (entry.name.includes('.css')) {
                    resources.stylesheets.push(resource);
                } else if (entry.name.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i)) {
                    resources.images.push(resource);
                } else if (entry.name.match(/\.(woff|woff2|ttf|otf)$/i)) {
                    resources.fonts.push(resource);
                } else {
                    resources.other.push(resource);
                }
            });
            
            this.recordMetric('RESOURCES', resources, 'object');
        });
    }
    
    initMemoryMonitoring() {
        if ('memory' in performance) {
            const recordMemory = () => {
                const memory = {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                };
                this.recordMetric('MEMORY', memory, 'bytes');
            };
            
            // Record initial memory
            recordMemory();
            
            // Record memory every 30 seconds
            setInterval(recordMemory, 30000);
        }
    }
    
    initPageLifecycle() {
        // Page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.recordMetric('PAGE_HIDDEN', performance.now(), 'ms');
                this.sendMetrics(); // Send metrics before page might be unloaded
            } else if (document.visibilityState === 'visible') {
                this.recordMetric('PAGE_VISIBLE', performance.now(), 'ms');
            }
        });
        
        // Page unload
        window.addEventListener('beforeunload', () => {
            this.recordMetric('PAGE_UNLOAD', performance.now(), 'ms');
            this.sendMetrics();
        });
    }
    
    observePerformanceEntry(type, callback) {
        try {
            const observer = new PerformanceObserver((list) => {
                callback(list.getEntries());
            });
            observer.observe({ type, buffered: true });
            this.observers.push(observer);
        } catch (error) {
            this.log(`Failed to observe ${type}:`, error);
        }
    }
    
    recordMetric(name, value, unit = '') {
        const timestamp = Date.now();
        const metric = {
            name,
            value,
            unit,
            timestamp,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.metrics[name] = metric;
        
        if (this.options.enableConsoleLogging) {
            this.log(`${name}: ${value}${unit}`);
        }
        
        // Trigger custom event
        window.dispatchEvent(new CustomEvent('performanceMetric', { detail: metric }));
    }
    
    // Custom timing methods
    startTimer(name) {
        performance.mark(`${name}-start`);
    }
    
    endTimer(name) {
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
        
        const measure = performance.getEntriesByName(name, 'measure')[0];
        if (measure) {
            this.recordMetric(name, measure.duration, 'ms');
        }
    }
    
    // Bundle size analysis
    analyzeBundleSize() {
        const resources = performance.getEntriesByType('resource');
        let totalSize = 0;
        let jsSize = 0;
        let cssSize = 0;
        let imageSize = 0;
        
        resources.forEach(resource => {
            const size = resource.transferSize || 0;
            totalSize += size;
            
            if (resource.name.includes('.js')) {
                jsSize += size;
            } else if (resource.name.includes('.css')) {
                cssSize += size;
            } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i)) {
                imageSize += size;
            }
        });
        
        const bundleAnalysis = {
            totalSize,
            jsSize,
            cssSize,
            imageSize,
            resourceCount: resources.length
        };
        
        this.recordMetric('BUNDLE_ANALYSIS', bundleAnalysis, 'bytes');
        return bundleAnalysis;
    }
    
    // Get performance recommendations
    getRecommendations() {
        const recommendations = [];
        
        // FCP recommendations
        if (this.metrics.FCP && this.metrics.FCP.value > 1800) {
            recommendations.push({
                metric: 'FCP',
                issue: 'First Contentful Paint is slow',
                recommendation: 'Optimize critical rendering path, reduce render-blocking resources'
            });
        }
        
        // LCP recommendations
        if (this.metrics.LCP && this.metrics.LCP.value > 2500) {
            recommendations.push({
                metric: 'LCP',
                issue: 'Largest Contentful Paint is slow',
                recommendation: 'Optimize largest element loading, consider image optimization and lazy loading'
            });
        }
        
        // FID recommendations
        if (this.metrics.FID && this.metrics.FID.value > 100) {
            recommendations.push({
                metric: 'FID',
                issue: 'First Input Delay is high',
                recommendation: 'Reduce JavaScript execution time, consider code splitting'
            });
        }
        
        // CLS recommendations
        if (this.metrics.CLS && this.metrics.CLS.value > 0.1) {
            recommendations.push({
                metric: 'CLS',
                issue: 'Cumulative Layout Shift is high',
                recommendation: 'Add size attributes to images, reserve space for dynamic content'
            });
        }
        
        // Bundle size recommendations
        const bundleAnalysis = this.analyzeBundleSize();
        if (bundleAnalysis.jsSize > 1024 * 1024) { // > 1MB
            recommendations.push({
                metric: 'BUNDLE_SIZE',
                issue: 'JavaScript bundle is large',
                recommendation: 'Consider code splitting, tree shaking, and removing unused dependencies'
            });
        }
        
        return recommendations;
    }
    
    // Generate performance report
    generateReport() {
        const report = {
            timestamp: Date.now(),
            url: window.location.href,
            metrics: this.metrics,
            recommendations: this.getRecommendations(),
            bundleAnalysis: this.analyzeBundleSize(),
            userAgent: navigator.userAgent,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null
        };
        
        return report;
    }
    
    // Send metrics to analytics endpoint
    sendMetrics() {
        if (!this.options.enableAnalytics || Math.random() > this.options.sampleRate) {
            return;
        }
        
        const report = this.generateReport();
        
        // Use sendBeacon for reliability
        if (navigator.sendBeacon) {
            navigator.sendBeacon(
                this.options.analyticsEndpoint,
                JSON.stringify(report)
            );
        } else {
            // Fallback to fetch
            fetch(this.options.analyticsEndpoint, {
                method: 'POST',
                body: JSON.stringify(report),
                headers: {
                    'Content-Type': 'application/json'
                },
                keepalive: true
            }).catch(error => {
                this.log('Failed to send metrics:', error);
            });
        }
    }
    
    // Cleanup
    disconnect() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }
    
    log(...args) {
        if (this.options.enableConsoleLogging) {
            console.log('[PerformanceMonitor]', ...args);
        }
    }
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.performanceMonitor = new PerformanceMonitor();
        });
    } else {
        window.performanceMonitor = new PerformanceMonitor();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
}

// Usage examples:
/*
// Custom timing
window.performanceMonitor.startTimer('api-call');
// ... make API call
window.performanceMonitor.endTimer('api-call');

// Get recommendations
const recommendations = window.performanceMonitor.getRecommendations();
console.log(recommendations);

// Generate full report
const report = window.performanceMonitor.generateReport();
console.log(report);

// Listen for metrics
window.addEventListener('performanceMetric', (event) => {
    console.log('New metric:', event.detail);
});
*/