================================================================================
PROJECT NAME
================================================================================
Rakt-Setu


================================================================================
PROBLEM WE ARE SOLVING
================================================================================
During medical emergencies and routine healthcare operations, blood procurement
suffers from critical bottlenecks:

1. Information Asymmetry and Lack of Real-Time Visibility:
   Hospitals and patients cannot easily identify which regional blood bank has
   compatible, unexpired blood units available in real time.

2. Inventory Race Conditions and Double-Allocation:
   Fragmented systems allow concurrent requisitions to claim the same physical
   blood unit, leading to critical delays at the point of care.

3. Disconnected Donor Coordination:
   Blood donation drives and individual donor appointments lack real-time
   synchronization with hospital demand, causing mismatched blood type supplies
   and wastage of perishable blood products.

Rakt-Setu solves this by providing a unified, real-time coordination platform
connecting Donors, Hospitals, and Blood Banks with centralized inventory tracking,
atomic reservation guarantees, and emergency requisition workflows.


================================================================================
ARCHITECTURE
================================================================================
Rakt-Setu follows a 3-tier, database-first architecture:

1. Client Presentation Layer (Frontend)
   - Interface: Responsive role-specific portals (Donor, Hospital, Blood Bank).
   - Technologies: HTML5, CSS3, Vanilla JavaScript (ES6+).
   - Client Security and Routing: Centralized API client (api.js), role-based
     UI guards (guard.js), and zero-trust local storage where all persistent
     business state is retrieved from authoritative server APIs.

2. Application and API Layer (Backend)
   - Runtime and Framework: Node.js with Express.js RESTful API architecture.
   - Access Control and Security:
     * Authentication: HttpOnly, Secure, SameSite JWT session cookies.
     * Authorization: Role-Based Access Control (RBAC) middleware for DONOR,
       HOSPITAL_STAFF, and ADMIN roles.
     * Hardening: Helmet (strict Content Security Policy without unsafe-eval),
       rate limiting, CORS protection, custom-header CSRF validation, and
       single-use scoped tokens for private document access.
     * Concurrency and Integrity: Transaction helper enforcing ACID multi-
       document transactions on MongoDB for blood reservation, dispatch,
       cancellation, and fulfillment.

3. Authoritative Data Layer (Database)
   - Database: MongoDB managed through Mongoose ODM.
   - Core Data Models:
     * User: Account credentials, roles, profile, and facility association.
     * BloodUnit: Individual barcoded units, blood group, component type,
       expiry date, status (Available, Reserved, Dispatched, Discarded), and
       facility location.
     * Request: Emergency requisitions, required units, fulfillment status, and
       requesting hospital.
     * Donation and Appointment: Donor eligibility, scheduled slots, and
       completed donation logs.
     * Document: Metadata, mime-type verification, and secure file references.
     * Hospital: Registered healthcare facilities and contact profiles.
