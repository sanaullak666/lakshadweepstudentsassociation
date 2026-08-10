# Lakshadweep Students Association (LSA) Membership Registration Portal

A complete, modern, responsive full-stack web portal for the **Lakshadweep Students Association (LSA)** featuring multi-step membership registration, Central Committee management, instant public verification, digital membership card generation with QR code, admin dashboard, and ₹3 payment gateway integration.

---

## 🌟 Tech Stack

* **Frontend**: HTML5, Vanilla CSS3 (Custom Design System with Lakshadweep Theme), Vanilla JavaScript (ES6+)
* **Backend**: Node.js, Express.js
* **Database**: MySQL (using `mysql2` pool with prepared statements and parameterization)
* **Payment Gateway Integration**: Razorpay (₹3.00 exact amount with backend HMAC SHA-256 signature verification and sandbox/live key support)
* **Security**: Bcrypt password hashing, Helmet headers, CORS, Rate limiting, Server-side input sanitization.

---

## 📁 Project Structure

```text
LSA/
├── public/                     # Public Frontend Assets & Pages
│   ├── index.html              # Homepage & Hero Section
│   ├── membership.html         # Multi-step Registration Form & Payment
│   ├── committee.html          # Public Central Committee Showcase Page
│   ├── verify.html             # Public Membership Verification Page
│   ├── success.html            # Post-payment Success & Digital Card Page
│   ├── css/
│   │   └── style.css           # Custom CSS Design System
│   ├── js/
│   │   ├── main.js             # Client utilities, toast alerts, mobile nav
│   │   ├── membership.js       # Registration form, order creation, payment
│   │   ├── committee.js        # Dynamic committee card fetcher
│   │   ├── verify.js           # Public membership lookup
│   │   ├── qrcode.js           # Pure JS SVG QR code generator
│   │   └── card.js             # Digital membership card render & download
│   └── assets/
│
├── admin/                      # Admin Dashboard Portal
│   ├── login.html              # Secure Admin Login Page
│   ├── dashboard.html          # System Overview & Metrics
│   ├── members.html            # Members table, filters & search
│   ├── committee.html          # Committee CRUD & ordering
│   ├── payments.html           # Payment transaction logs
│   └── js/
│       └── admin.js            # Admin authentication & dashboard logic
│
├── server/                     # Backend Logic
│   ├── config/
│   │   ├── db.js               # MySQL Connection Pool & Schema Runner
│   │   └── razorpay.js         # Razorpay SDK & Signature Verifier
│   ├── controllers/
│   │   ├── membershipController.js
│   │   ├── paymentController.js
│   │   ├── committeeController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js             # Admin authentication middleware
│   │   └── validation.js       # Input validation middleware
│   ├── routes/
│   │   ├── membershipRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── committeeRoutes.js
│   │   └── adminRoutes.js
│   └── utils/
│       └── membershipIdGenerator.js # Format: LSA-2026-XXXXX
│
├── database/
│   ├── schema.sql              # MySQL DDL script
│   └── seed.sql                # Initial Central Committee & Admin Seed
│
├── .env.example                # Sample environment configuration
├── .env                        # Active environment configuration
├── package.json
├── server.js                   # Application Entry Point
└── README.md
```

---

## 🛠️ Step-by-Step Installation & Setup

### 1. Install Node.js Dependencies

Open your terminal in the root directory and run:

```bash
npm install
```

### 2. Configure MySQL Database

1. Ensure MySQL Server (e.g. MySQL 8.x, XAMPP, or MariaDB) is running on your machine.
2. Log into MySQL shell or phpMyAdmin:
   ```bash
   mysql -u root -p
   ```
3. Create the database manually OR let the application create it automatically:
   ```sql
   CREATE DATABASE IF NOT EXISTS lsa_membership CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
4. Import the database tables and schema:
   ```bash
   mysql -u root -p lsa_membership < database/schema.sql
   ```
5. Import initial seed data (Central Committee members & default admin account):
   ```bash
   mysql -u root -p lsa_membership < database/seed.sql
   ```

*(Note: The server auto-detects MySQL and automatically initializes tables and default seeds on initial boot if they do not exist!)*

### 3. Configure `.env` Environment Variables

Copy `.env.example` to `.env` or edit `.env`:

```env
PORT=5000
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=lsa_membership

# Payment Gateway Configuration (Razorpay)
PAYMENT_KEY_ID=rzp_test_your_key_id
PAYMENT_KEY_SECRET=your_key_secret
PAYMENT_MODE=test

SESSION_SECRET=lsa_membership_super_secret_session_key_2026
ADMIN_EMAIL=lakshadweepstudentsassociation@gmail.com
ADMIN_PASSWORD=LSA@Admin2026
```

---

## 🚀 Running the Application

### Start Development Server

```bash
npm run dev
```
OR
```bash
npm start
```

Once running, access the portal in your browser:
* **Public Portal**: `http://localhost:5000`
* **Membership Registration**: `http://localhost:5000/membership.html`
* **Verify Membership**: `http://localhost:5000/verify.html`
* **Admin Portal**: `http://localhost:5000/admin/login.html`

---

## 🔐 Default Admin Account Credentials

* **Email**: `lakshadweepstudentsassociation@gmail.com`
* **Password**: `LSA@Admin2026`

*(The password is hashed using bcrypt with salt factor 10 in the database.)*

---

## 💳 Payment Gateway Setup (Razorpay)

### Testing Payments in Sandbox Mode
1. Register for a free test account at [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Go to **Settings -> API Keys** and generate **Test Keys**.
3. Place `Key ID` into `PAYMENT_KEY_ID` and `Key Secret` into `PAYMENT_KEY_SECRET` in your `.env` file.
4. When testing registration on the portal, click **[ Pay ₹3 Now ]**.
5. Use test cards/UPI provided by Razorpay Test Sandbox (or use built-in Sandbox Simulator).

### Switching to Production Mode
1. Complete KYC verification on Razorpay.
2. Generate **Live API Keys** from Razorpay Dashboard.
3. Update `.env`:
   ```env
   PAYMENT_KEY_ID=rzp_live_xxxxxxxxxxxxxx
   PAYMENT_KEY_SECRET=your_live_secret
   PAYMENT_MODE=live
   ```
4. Restart your Node.js application.

---

## 📦 Exporting Member Records

Admin users can click **[ Export Members CSV ]** in the admin panel to download an updated `.csv` spreadsheet containing:
* Membership ID (`LSA-2026-XXXXX`)
* Full Name
* Gender
* Island
* Contact Number
* Email
* Blood Group
* Payment Status (`PAID` / `PENDING`)
* Registration Date

---

## 🛡️ Security Features

* **Parameterized MySQL Queries**: Eliminates SQL Injection risks.
* **Server-side Signature Verification**: Razorpay payments are verified on the Node server using HMAC-SHA256 before activating any membership.
* **Bcrypt Password Hashing**: Passwords stored as salted bcrypt hashes.
* **Public Data Masking**: Verification API returns ONLY public details (Name, Island, Status) and hides phone numbers, emails, and sensitive info.
* **Rate Limiting**: Guards against brute force login and API spam.
