#!/usr/bin/env python3
"""
Bundle Size Analysis Script
Analyzes project dependencies and bundle sizes for performance optimization.
"""

import os
import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional

class BundleAnalyzer:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.results = {}
    
    def analyze_python_dependencies(self) -> Dict:
        """Analyze Python dependencies from requirements.txt and installed packages."""
        results = {
            "type": "python",
            "total_size": 0,
            "packages": [],
            "large_packages": [],
            "recommendations": []
        }
        
        # Check for requirements.txt
        req_file = self.project_root / "requirements.txt"
        if req_file.exists():
            with open(req_file, 'r') as f:
                requirements = f.read().strip().split('\n')
            results["requirements_count"] = len([r for r in requirements if r.strip() and not r.startswith('#')])
        
        # Analyze installed packages
        try:
            result = subprocess.run(['pip', 'list', '--format=json'], 
                                  capture_output=True, text=True, check=True)
            packages = json.loads(result.stdout)
            
            # Get package sizes (approximation)
            large_ml_packages = {
                'tensorflow': 500,  # MB
                'torch': 800,
                'numpy': 50,
                'pandas': 100,
                'scikit-learn': 150,
                'opencv-python': 200,
                'matplotlib': 80,
                'seaborn': 20,
                'plotly': 50
            }
            
            total_size = 0
            for pkg in packages:
                name = pkg['name'].lower()
                size = large_ml_packages.get(name, 5)  # Default 5MB for unknown packages
                total_size += size
                
                pkg_info = {
                    "name": pkg['name'],
                    "version": pkg['version'],
                    "estimated_size_mb": size
                }
                results["packages"].append(pkg_info)
                
                if size > 100:
                    results["large_packages"].append(pkg_info)
            
            results["total_size"] = total_size
            
            # Recommendations
            if any(pkg['name'].lower() == 'tensorflow' for pkg in packages):
                if not any(pkg['name'].lower() == 'tensorflow-lite' for pkg in packages):
                    results["recommendations"].append(
                        "Consider using TensorFlow Lite for inference to reduce bundle size"
                    )
            
            if len(results["large_packages"]) > 3:
                results["recommendations"].append(
                    "Consider lazy loading or conditional imports for large ML libraries"
                )
                
        except subprocess.CalledProcessError:
            results["error"] = "Could not analyze Python packages. Make sure pip is available."
        
        return results
    
    def analyze_node_dependencies(self) -> Dict:
        """Analyze Node.js dependencies from package.json."""
        results = {
            "type": "node",
            "total_size": 0,
            "dependencies": [],
            "dev_dependencies": [],
            "large_dependencies": [],
            "recommendations": []
        }
        
        package_json = self.project_root / "package.json"
        if not package_json.exists():
            results["error"] = "No package.json found"
            return results
        
        with open(package_json, 'r') as f:
            package_data = json.load(f)
        
        # Analyze dependencies
        deps = package_data.get('dependencies', {})
        dev_deps = package_data.get('devDependencies', {})
        
        results["dependencies"] = list(deps.keys())
        results["dev_dependencies"] = list(dev_deps.keys())
        
        # Check for large packages
        large_packages = {
            'tensorflow': 50,  # MB (tfjs)
            '@tensorflow/tfjs': 50,
            'react': 2,
            'vue': 3,
            'angular': 10,
            'lodash': 1.5,
            'moment': 2.5,
            'chart.js': 1,
            'three': 5,
            'd3': 3
        }
        
        total_size = 0
        for dep in deps:
            size = large_packages.get(dep, 0.5)  # Default 0.5MB
            total_size += size
            if size > 2:
                results["large_dependencies"].append({
                    "name": dep,
                    "estimated_size_mb": size
                })
        
        results["total_size"] = total_size
        
        # Recommendations
        if 'lodash' in deps:
            results["recommendations"].append(
                "Consider using lodash-es or individual lodash functions to reduce bundle size"
            )
        
        if 'moment' in deps:
            results["recommendations"].append(
                "Consider replacing moment.js with date-fns or dayjs for smaller bundle size"
            )
        
        if len(results["large_dependencies"]) > 5:
            results["recommendations"].append(
                "Consider code splitting to load large dependencies only when needed"
            )
        
        return results
    
    def analyze_webpack_bundle(self) -> Dict:
        """Analyze webpack bundle if webpack config exists."""
        results = {
            "type": "webpack",
            "config_found": False,
            "recommendations": []
        }
        
        webpack_config = self.project_root / "webpack.config.js"
        if webpack_config.exists():
            results["config_found"] = True
            
            # Read webpack config for analysis
            try:
                with open(webpack_config, 'r') as f:
                    config_content = f.read()
                
                # Check for optimization settings
                if 'optimization' not in config_content:
                    results["recommendations"].append(
                        "Add optimization configuration to webpack.config.js"
                    )
                
                if 'splitChunks' not in config_content:
                    results["recommendations"].append(
                        "Enable code splitting with splitChunks configuration"
                    )
                
                if 'TerserPlugin' not in config_content:
                    results["recommendations"].append(
                        "Add TerserPlugin for JavaScript minification"
                    )
                
            except Exception as e:
                results["error"] = f"Could not analyze webpack config: {str(e)}"
        
        return results
    
    def generate_report(self) -> str:
        """Generate a comprehensive performance analysis report."""
        report = ["# Bundle Size Analysis Report\n"]
        
        # Analyze different project types
        if (self.project_root / "requirements.txt").exists() or (self.project_root / "setup.py").exists():
            python_analysis = self.analyze_python_dependencies()
            self.results["python"] = python_analysis
            
            report.append("## Python Dependencies Analysis")
            if "error" not in python_analysis:
                report.append(f"- Total estimated size: {python_analysis['total_size']:.1f} MB")
                report.append(f"- Number of packages: {len(python_analysis['packages'])}")
                report.append(f"- Large packages (>100MB): {len(python_analysis['large_packages'])}")
                
                if python_analysis["large_packages"]:
                    report.append("\n### Large Packages:")
                    for pkg in python_analysis["large_packages"]:
                        report.append(f"- {pkg['name']} ({pkg['version']}): {pkg['estimated_size_mb']} MB")
                
                if python_analysis["recommendations"]:
                    report.append("\n### Recommendations:")
                    for rec in python_analysis["recommendations"]:
                        report.append(f"- {rec}")
            else:
                report.append(f"- Error: {python_analysis['error']}")
            
            report.append("")
        
        if (self.project_root / "package.json").exists():
            node_analysis = self.analyze_node_dependencies()
            self.results["node"] = node_analysis
            
            report.append("## Node.js Dependencies Analysis")
            if "error" not in node_analysis:
                report.append(f"- Total estimated size: {node_analysis['total_size']:.1f} MB")
                report.append(f"- Dependencies: {len(node_analysis['dependencies'])}")
                report.append(f"- Dev dependencies: {len(node_analysis['dev_dependencies'])}")
                report.append(f"- Large dependencies (>2MB): {len(node_analysis['large_dependencies'])}")
                
                if node_analysis["large_dependencies"]:
                    report.append("\n### Large Dependencies:")
                    for dep in node_analysis["large_dependencies"]:
                        report.append(f"- {dep['name']}: {dep['estimated_size_mb']} MB")
                
                if node_analysis["recommendations"]:
                    report.append("\n### Recommendations:")
                    for rec in node_analysis["recommendations"]:
                        report.append(f"- {rec}")
            else:
                report.append(f"- Error: {node_analysis['error']}")
            
            report.append("")
        
        # Webpack analysis
        webpack_analysis = self.analyze_webpack_bundle()
        if webpack_analysis["config_found"]:
            self.results["webpack"] = webpack_analysis
            report.append("## Webpack Configuration Analysis")
            report.append("- Webpack configuration found")
            
            if webpack_analysis["recommendations"]:
                report.append("\n### Recommendations:")
                for rec in webpack_analysis["recommendations"]:
                    report.append(f"- {rec}")
            
            report.append("")
        
        # General recommendations
        report.append("## General Performance Recommendations")
        report.append("1. **Enable compression**: Use gzip/brotli compression on your server")
        report.append("2. **Implement caching**: Set appropriate cache headers for static assets")
        report.append("3. **Optimize images**: Use modern formats (WebP, AVIF) and appropriate sizing")
        report.append("4. **Code splitting**: Load code only when needed")
        report.append("5. **Tree shaking**: Remove unused code from your bundles")
        report.append("6. **Lazy loading**: Load non-critical resources asynchronously")
        
        return "\n".join(report)
    
    def save_report(self, filename: str = "bundle_analysis_report.md"):
        """Save the analysis report to a file."""
        report = self.generate_report()
        with open(filename, 'w') as f:
            f.write(report)
        print(f"Report saved to {filename}")
        return report

def main():
    """Main function to run the bundle analysis."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Analyze bundle sizes and dependencies")
    parser.add_argument("--path", default=".", help="Path to project root")
    parser.add_argument("--output", default="bundle_analysis_report.md", help="Output file name")
    
    args = parser.parse_args()
    
    analyzer = BundleAnalyzer(args.path)
    report = analyzer.save_report(args.output)
    print("\n" + "="*50)
    print("BUNDLE ANALYSIS COMPLETE")
    print("="*50)
    print(report)

if __name__ == "__main__":
    main()