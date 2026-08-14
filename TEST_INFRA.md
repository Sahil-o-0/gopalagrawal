# E2E Test Infra: Fleet & Workforce Management React Native/Expo Application

## Test Philosophy
- Opaque-box, requirement-driven testing based strictly on `ORIGINAL_REQUEST.md` and `PROJECT.md`.
- No reliance on non-public internal implementation details.
- Methodology: Category-Partition (Tier 1) + Boundary Value Analysis (Tier 2) + Pairwise Interaction (Tier 3) + Real-World Workload Testing (Tier 4).

## Feature Inventory & Test Matrix
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|--------|:------:|:------:|:------:|:------:|
| 1 | Site Context & Global Site Selection | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Site-Wise Database Filtering & Schemas | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 3 | Site Management API & Router | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 4 | Backend Endpoint Site-Filtering | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 5 | Home Screen & Big Navigation Cards | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 6 | Modular Standalone Feature Screens | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 7 | Error Alert Cards & Query Fallbacks | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 8 | Mock Data Removal & Dynamic Populating | ORIGINAL_REQUEST §R1, §R2 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Location**: `tests/e2e/`
- **Runner**: `python -m pytest tests/e2e/` or `python tests/e2e/run_all_e2e.py`
- **Pass/Fail Semantics**: Exit code 0 indicates all test assertions passed. Non-zero exit code indicates test failures.
- **Directory Layout**:
  - `tests/e2e/conftest.py`: Shared fixtures (API client, test database connection, auth tokens, site setup).
  - `tests/e2e/tier1_feature_coverage/`: 40 happy-path feature coverage test cases.
  - `tests/e2e/tier2_boundary_corner/`: 40 boundary value and edge case test cases.
  - `tests/e2e/tier3_pairwise_cross_feature/`: 8 pairwise feature interaction test cases.
  - `tests/e2e/tier4_real_world_scenarios/`: 5 end-to-end multi-site workflow scenarios.
  - `tests/e2e/run_all_e2e.py`: Master test suite runner script.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Multi-Site Onboarding & Partitioned Operational Flow | F1, F2, F3, F4, F5, F6, F8 | High |
| 2 | Site Switching & Dynamic Filtering Integrity | F1, F2, F4, F5, F6, F8 | Medium |
| 3 | Backend Service Disruption & Error Recovery Flow | F1, F4, F6, F7 | Medium |
| 4 | Concurrent Multi-Site Attendance, Advance & EMI Logging | F2, F3, F4, F6, F8 | High |
| 5 | Invalid Data / Offline Fallback & Card Navigation State | F1, F5, F6, F7, F8 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (40 total)
- Tier 2: ≥5 per feature (40 total)
- Tier 3: Pairwise interactions covering major feature pairs (8 total)
- Tier 4: ≥5 realistic application scenarios (5 total)
- **Total Suite Minimum**: 93 E2E Test Cases
