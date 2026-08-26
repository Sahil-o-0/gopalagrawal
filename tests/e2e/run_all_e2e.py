"""
Master E2E Test Suite Runner Script for Fleet & Workforce Management Application.
Executes pytest over tests/e2e/, formats summary output, and returns exit code 0 or 1.
"""

import sys
import os

# Ensure backend directory and venv site-packages are in sys.path BEFORE importing pytest
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
backend_path = os.path.join(project_root, "backend")
venv_site_packages = os.path.join(backend_path, "venv", "Lib", "site-packages")

if os.path.exists(venv_site_packages) and venv_site_packages not in sys.path:
    sys.path.insert(0, venv_site_packages)
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import time
import pytest


class E2ESummaryPlugin:
    """Pytest plugin to capture test metrics and details for formatted summary."""
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.errors = 0
        self.total = 0
        self.test_details = []

    def pytest_runtest_logreport(self, report):
        if report.when == "call":
            self.total += 1
            if report.passed:
                self.passed += 1
                self.test_details.append(("PASS", report.nodeid))
            elif report.failed:
                self.failed += 1
                self.test_details.append(("FAIL", report.nodeid))
            elif report.skipped:
                self.skipped += 1
                self.test_details.append(("SKIP", report.nodeid))
        elif report.when in ("setup", "teardown") and report.failed:
            self.errors += 1
            self.total += 1
            self.test_details.append(("ERROR", report.nodeid))


def run_e2e_suite():
    os.chdir(project_root)

    print("=" * 80)
    print("           FLEET & WORKFORCE MANAGEMENT E2E MASTER TEST RUNNER          ")
    print("=" * 80)

    e2e_dir = os.path.join(project_root, "tests", "e2e")
    plugin = E2ESummaryPlugin()

    start_time = time.time()
    exit_code = pytest.main(["-v", "--tb=short", e2e_dir], plugins=[plugin])
    duration = time.time() - start_time

    print("\n" + "=" * 80)
    print("                       E2E TEST EXECUTION SUMMARY                       ")
    print("=" * 80)

    for status, nodeid in plugin.test_details:
        symbol = "[PASS]" if status == "PASS" else "[FAIL]" if status in ("FAIL", "ERROR") else "[SKIP]"
        print(f"  {symbol} {nodeid}")

    print("-" * 80)
    print(f"  Total Test Cases  : {plugin.total}")
    print(f"  Passed            : {plugin.passed}")
    print(f"  Failed            : {plugin.failed}")
    print(f"  Errors            : {plugin.errors}")
    print(f"  Skipped           : {plugin.skipped}")
    print(f"  Execution Time    : {duration:.2f} seconds")
    print("=" * 80)

    if exit_code == 0 and plugin.failed == 0 and plugin.errors == 0:
        print("  SUITE RESULT: PASSED (Exit Code: 0)")
        print("=" * 80)
        sys.exit(0)
    else:
        print(f"  SUITE RESULT: FAILED (Exit Code: {exit_code or 1})")
        print("=" * 80)
        sys.exit(exit_code if exit_code != 0 else 1)


if __name__ == "__main__":
    run_e2e_suite()
