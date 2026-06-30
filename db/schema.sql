-- =====================================================================
-- Committee Management System - Database Schema
-- Database: PostgreSQL (Neon)
-- Single-committee savings/chit-fund management app
-- =====================================================================

-- ---------- ENUM Types ----------
CREATE TYPE user_role        AS ENUM ('superadmin', 'admin', 'subadmin', 'manager');
CREATE TYPE committee_role   AS ENUM ('president', 'secretary', 'treasurer', 'member');
CREATE TYPE payment_status   AS ENUM ('paid', 'partial', 'unpaid', 'late');
CREATE TYPE loan_status      AS ENUM ('active', 'closed', 'foreclosed');
CREATE TYPE loan_payment_type AS ENUM ('emi', 'interest_only', 'partial', 'foreclosure');

-- =====================================================================
-- 1. COMMITTEE SETTINGS  (single row - app level config)
-- =====================================================================
CREATE TABLE committee_settings (
    id                     SERIAL PRIMARY KEY,
    name                   VARCHAR(255) NOT NULL,
    description            TEXT,
    monthly_instalment     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    default_interest_rate  NUMERIC(5, 2)  NOT NULL DEFAULT 2.00,  -- monthly %
    late_fine_per_day      NUMERIC(10, 2) DEFAULT 0,
    late_fine_per_month    NUMERIC(10, 2) DEFAULT 0,
    grace_period_days      INTEGER DEFAULT 0,
    payment_due_day        INTEGER DEFAULT 5,                     -- day of month payment is due
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 2. USERS  (login / app-management roles)
-- =====================================================================
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,                            -- bcrypt hash
    phone       VARCHAR(20),
    role        user_role NOT NULL DEFAULT 'manager',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 3. MEMBERS  (committee members with committee roles)
-- =====================================================================
CREATE TABLE members (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    email           VARCHAR(255),
    address         TEXT,
    committee_role  committee_role NOT NULL DEFAULT 'member',
    join_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 4. INSTALMENTS  (monthly regular contributions)
-- =====================================================================
CREATE TABLE instalments (
    id           SERIAL PRIMARY KEY,
    member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount       NUMERIC(12, 2) NOT NULL,
    paid_amount  NUMERIC(12, 2) DEFAULT 0,
    due_date     DATE NOT NULL,
    paid_date    DATE,
    status       payment_status DEFAULT 'unpaid',
    late_fine    NUMERIC(10, 2) DEFAULT 0,
    month        INTEGER NOT NULL,    -- 1-12
    year         INTEGER NOT NULL,
    remarks      TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (member_id, month, year)
);

-- =====================================================================
-- 5. LOANS
-- =====================================================================
CREATE TABLE loans (
    id                    SERIAL PRIMARY KEY,
    member_id             INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    principal_amount      NUMERIC(12, 2) NOT NULL,
    remaining_principal   NUMERIC(12, 2) NOT NULL,
    interest_rate         NUMERIC(5, 2)  NOT NULL,               -- monthly % (reducing balance)
    monthly_payment_amount NUMERIC(12, 2) NOT NULL,              -- fixed amount set at loan creation
    tenure_months         INTEGER,                                -- NULL = open-ended
    start_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date              DATE,                                   -- projected close date (fixed tenure)
    status                loan_status DEFAULT 'active',
    total_interest_paid   NUMERIC(12, 2) DEFAULT 0,
    total_principal_paid  NUMERIC(12, 2) DEFAULT 0,
    closed_date           DATE,
    remarks               TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 6. LOAN PAYMENTS  (EMI / interest-only / partial / foreclosure)
-- =====================================================================
CREATE TABLE loan_payments (
    id                        SERIAL PRIMARY KEY,
    loan_id                   INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    member_id                 INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    payment_amount            NUMERIC(12, 2) NOT NULL,
    principal_component       NUMERIC(12, 2) DEFAULT 0,
    interest_component        NUMERIC(12, 2) DEFAULT 0,
    remaining_principal_after NUMERIC(12, 2) NOT NULL,
    payment_type              loan_payment_type NOT NULL,
    payment_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    month                     INTEGER NOT NULL,
    year                      INTEGER NOT NULL,
    remarks                   TEXT,
    created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 7. LOAN INTEREST LOG  (monthly interest accrual & compounding)
-- =====================================================================
CREATE TABLE loan_interest_log (
    id                 SERIAL PRIMARY KEY,
    loan_id            INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    principal_at_start NUMERIC(12, 2) NOT NULL,
    interest_amount    NUMERIC(12, 2) NOT NULL,
    is_compounded      BOOLEAN DEFAULT FALSE,                    -- TRUE if unpaid interest added to principal
    month              INTEGER NOT NULL,
    year               INTEGER NOT NULL,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 8. FUND TRANSACTIONS  (total available fund tracker)
-- =====================================================================
CREATE TABLE fund_transactions (
    id                SERIAL PRIMARY KEY,
    transaction_type  VARCHAR(50) NOT NULL,   -- instalment_received | loan_disbursed | loan_payment_received | fine_received
    amount            NUMERIC(12, 2) NOT NULL,
    reference_id      INTEGER,
    description       TEXT,
    transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- INDEXES
-- =====================================================================
CREATE INDEX idx_instalments_member       ON instalments(member_id);
CREATE INDEX idx_instalments_month_year    ON instalments(month, year);
CREATE INDEX idx_instalments_status        ON instalments(status);
CREATE INDEX idx_loans_member              ON loans(member_id);
CREATE INDEX idx_loans_status              ON loans(status);
CREATE INDEX idx_loan_payments_loan        ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_member      ON loan_payments(member_id);
CREATE INDEX idx_loan_interest_log_loan    ON loan_interest_log(loan_id);
CREATE INDEX idx_fund_transactions_date    ON fund_transactions(transaction_date);
CREATE INDEX idx_fund_transactions_type    ON fund_transactions(transaction_type);

-- =====================================================================
-- SEED DATA
-- =====================================================================
-- Default committee settings
INSERT INTO committee_settings
    (name, description, monthly_instalment, default_interest_rate, late_fine_per_day, grace_period_days, payment_due_day)
VALUES
    ('My Committee', 'Committee Management System', 1000.00, 2.00, 50.00, 5, 5);

-- NOTE: A default super-admin is created by the backend seed script (scripts/seed.js)
--       so the password is properly bcrypt-hashed. Do not insert a plaintext password here.
