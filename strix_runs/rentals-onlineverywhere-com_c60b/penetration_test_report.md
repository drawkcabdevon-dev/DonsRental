# Security Penetration Test Report

**Generated:** 2026-08-27 19:51:44 UTC

# Executive Summary

# Executive Summary

An external security assessment of the **Online Everywhere Rentals** web application identified several significant vulnerabilities that could lead to unauthorized actions, data manipulation, and service disruption. The overall risk posture is assessed as **Elevated**.

**Key Findings**
-   **High-Impact Google Sheets Formula/Command Injection**: A critical vulnerability allowing potential data exfiltration and command execution via the `customerEmail` parameter.
-   **Broken Function Level Authorization**: Unauthenticated users can create bookings, leading to system abuse and fraudulent activities.
-   **Exposed Google API Key**: A client-side exposed API key, while seemingly restricted, poses an information disclosure risk.
-   **Missing Rate Limiting**: The absence of rate limiting on key POST endpoints (`/api/bookings`, `/api/check-availability`, `/api/check-availability-batch`) makes the application vulnerable to brute-force attacks and resource exhaustion.
-   **Business Logic Flaw**: The booking availability API allows illogical date ranges, leading to incorrect calculations.

**Business Impact**
These vulnerabilities could lead to:
-   Compromise of backend systems or sensitive data managed in Google Sheets.
-   Operational disruption and financial losses due to fraudulent bookings.
-   Reputational damage and loss of customer trust.
-   Potential for denial-of-service attacks due to lack of rate limiting.

# Methodology

# Methodology

The security assessment was conducted following the **OWASP Web Security Testing Guide (WSTG)** principles. This engagement was a **Black-box external test**, meaning the assessment was performed without prior knowledge of the application's internal structure or source code.

**Scope:** The primary target for this assessment was the web application accessible at `https://rentals.onlineverywhere.com`.

**Activities Performed:**
-   **Reconnaissance and Attack Surface Mapping**:
    -   Passive analysis for subdomain enumeration and open port scanning.
    -   Active crawling of the application using `agent-browser` and `katana` to discover endpoints, parameters, and technologies.
    -   Identification of authentication mechanisms (Google Sign-in) and inferred user roles (unauthenticated, authenticated, admin).
-   **Systematic Vulnerability Assessment**: Specialized agents were deployed to focus on critical areas:
    -   **Booking and API Vulnerabilities**: Deep dive into `POST /api/bookings` and other API endpoints for input validation, date validation, price calculation, authorization bypass (IDOR/BFLA), and potential SQL/command injection.
    -   **Rate Limiting**: Verification of rate limiting on all POST endpoints to identify susceptibility to brute-force attacks and resource exhaustion.
    -   **Data Protection**: Investigation into Google Sheets credential exposure, Google Cloud Storage (GCS) photo access, customer PII in responses, and secrets in client-side code.

# Technical Analysis

# Technical Analysis

The assessment identified several vulnerabilities across different categories, primarily stemming from insufficient input validation, inadequate authorization controls, and missing security mechanisms.

**Severity Model:** Vulnerabilities are rated based on their exploitability and potential business impact.

1.  **Google Sheets Formula/Command Injection via `customerEmail` (High - CWE-94)**:
    -   **Mechanism**: The `customerEmail` parameter in `POST /api/bookings` is not properly sanitized before being processed by a backend component interacting with Google Sheets. Submitting payloads resembling SQL injection or Google Sheets formulas (`=HYPERLINK(...)`) results in a 500 Internal Server Error, indicating a processing failure.
    -   **Root Cause**: Lack of robust server-side input validation and sanitization for data intended for external systems.

2.  **Broken Function Level Authorization: Unauthenticated Booking Creation (Medium - CWE-862)**:
    -   **Mechanism**: The `POST /api/bookings` endpoint allows unauthenticated users to create car rental bookings successfully. No authentication or authorization checks are enforced.
    -   **Root Cause**: Missing authentication and authorization controls at the API endpoint, allowing direct access to a sensitive business function.

3.  **Exposed Google API Key in Client-Side Code (Medium - CWE-200)**:
    -   **Mechanism**: A Google API key (`AIzaSyCkfPOPZXDKNn8hhgu3JrA62wIgC93d44k`) was discovered embedded within the client-side JavaScript bundle (`assets/index-FrECPCYq.js`) and observed in network requests. While currently restricted, its exposure presents an information disclosure risk.
    -   **Root Cause**: Direct embedding of sensitive credentials in publicly accessible client-side code.

4.  **Absence of Rate Limiting on POST Endpoints (Medium - CWE-770)**:
    -   **Mechanism**: Testing revealed no active rate limiting mechanisms on critical POST endpoints such as `/api/check-availability`, `/api/bookings`, and `/api/check-availability-batch`. Repeated requests could be sent without any discernible throttling or blocking.
    -   **Root Cause**: Missing implementation of rate limiting controls, making the application susceptible to brute-force attacks, denial of service, and abuse.

5.  **Business Logic Flaw: Return Date Before Pickup Date in `/api/check-availability` (Medium - CWE-20)**:
    -   **Mechanism**: The `/api/check-availability` endpoint accepts booking requests where the `returnDate` is chronologically before the `pickupDate`, yet still returns `available: true`.
    -   **Root Cause**: Inadequate server-side business logic validation for date parameters.

# Recommendations

# Recommendations

The following recommendations are provided to address the identified vulnerabilities and enhance the overall security posture of the Online Everywhere Rentals application.

**Immediate Actions (Critical & High Severity Findings)**
1.  **Implement Robust Input Validation and Sanitization**:
    -   For `Google Sheets Formula/Command Injection` (CVE-94), ensure all user-supplied data, especially the `customerEmail` field and any other fields interacting with backend systems like Google Sheets, undergoes strict server-side validation and sanitization.
    -   Explicitly escape or encode special characters. If data is intended for Google Sheets, use secure methods to write data that prevent formula parsing (e.g., using a Google Sheets API that treats input as raw text).
2.  **Enforce Authentication and Authorization on Booking Creation**:
    -   For `Broken Function Level Authorization` (CWE-862), implement robust authentication and authorization checks on the `/api/bookings` endpoint.
    -   Ensure only authenticated and authorized users (e.g., administrative staff or legitimate, logged-in customers) can create bookings. This typically involves requiring and validating an authentication token (e.g., JWT) in request headers.

**Short-Term Actions (Medium Severity Findings)**
3.  **Address Exposed Google API Key**:
    -   For `Exposed Google API Key` (CWE-200), remove the Google API key from client-side code. If a key is absolutely required client-side, consider proxying API calls through your server to obscure the key or implementing server-side authentication for relevant API calls.
    -   Ensure all API keys are restricted to the minimum necessary permissions and origins.
4.  **Implement Comprehensive Rate Limiting**:
    -   For `Absence of Rate Limiting`, implement robust rate limiting on all POST endpoints, especially `/api/bookings`, `/api/check-availability`, and `/api/check-availability-batch`.
    -   Rate limiting should return appropriate HTTP status codes (e.g., `429 Too Many Requests`) and include `Retry-After` headers to guide clients.
5.  **Correct Business Logic for Date Validation**:
    -   For `Business Logic Flaw` (CWE-20), implement server-side validation on the `/api/check-availability` and `/api/bookings` endpoints to ensure that `returnDate` is always chronologically after `pickupDate`.
    -   Return a `400 Bad Request` or a specific error message when this condition is violated.

**Retest & Validation:**
After implementing these remediations, a re-test should be performed on all identified vulnerabilities to confirm that the fixes are effective and no new issues have been introduced. This includes verifying that:
-   Input injection attempts no longer cause server errors or unexpected behavior.
-   Unauthenticated booking creation is no longer possible.
-   The Google API key is no longer exposed client-side.
-   Rate limiting is actively enforced on all specified POST endpoints.
-   Date validation properly enforces chronological order.

