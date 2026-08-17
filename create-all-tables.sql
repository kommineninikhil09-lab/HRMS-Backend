-- Phase 1 Tables
CREATE TABLE IF NOT EXISTS business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  parent_business_unit_id UUID REFERENCES business_units(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CONSTRAINT uq_business_units_org_code UNIQUE(organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_business_units_org ON business_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_business_units_parent ON business_units(parent_business_unit_id);
CREATE INDEX IF NOT EXISTS idx_business_units_status ON business_units(status);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  timezone VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CONSTRAINT uq_locations_org_code UNIQUE(organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  business_unit_id UUID REFERENCES business_units(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  parent_department_id UUID REFERENCES departments(id),
  head_employee_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CONSTRAINT uq_departments_org_code UNIQUE(organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_bu ON departments(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_department_id);
CREATE INDEX IF NOT EXISTS idx_departments_head ON departments(head_employee_id);
CREATE INDEX IF NOT EXISTS idx_departments_status ON departments(status);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(100) NOT NULL,
  rank_order INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CONSTRAINT uq_grades_org_name UNIQUE(organization_id, name)
);
CREATE INDEX IF NOT EXISTS idx_grades_org ON grades(organization_id);
CREATE INDEX IF NOT EXISTS idx_grades_status ON grades(status);

CREATE TABLE IF NOT EXISTS designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  grade_id UUID REFERENCES grades(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CONSTRAINT uq_designations_org_code UNIQUE(organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_designations_org ON designations(organization_id);
CREATE INDEX IF NOT EXISTS idx_designations_grade ON designations(grade_id);
CREATE INDEX IF NOT EXISTS idx_designations_status ON designations(status);

CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  business_unit_id UUID REFERENCES business_units(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CONSTRAINT uq_cost_centers_org_code UNIQUE(organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_cost_centers_org ON cost_centers(organization_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_bu ON cost_centers(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_status ON cost_centers(status);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  department_id UUID REFERENCES departments(id),
  name VARCHAR(255) NOT NULL,
  lead_employee_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_dept ON teams(department_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead ON teams(lead_employee_id);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  employee_code VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  work_email VARCHAR(255),
  personal_email VARCHAR(255),
  phone VARCHAR(20),
  dob DATE,
  gender VARCHAR(20),
  department_id UUID REFERENCES departments(id),
  team_id UUID REFERENCES teams(id),
  location_id UUID REFERENCES locations(id),
  designation_id UUID REFERENCES designations(id),
  grade_id UUID REFERENCES grades(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  business_unit_id UUID REFERENCES business_units(id),
  manager_id UUID REFERENCES employees(id),
  employment_type VARCHAR(50),
  date_of_joining DATE NOT NULL,
  date_of_exit DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CONSTRAINT uq_employees_org_code UNIQUE(organization_id, employee_code),
  CONSTRAINT uq_employees_org_email UNIQUE(organization_id, work_email)
);
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_designation ON employees(designation_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

CREATE TABLE IF NOT EXISTS employment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  event_type VARCHAR(50) NOT NULL,
  effective_date DATE NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employment_history_org ON employment_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_employment_history_emp ON employment_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_employment_history_type ON employment_history(event_type);
CREATE INDEX IF NOT EXISTS idx_employment_history_date ON employment_history(effective_date);

CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  document_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
  content_type VARCHAR(100),
  size_bytes INTEGER,
  uploaded_by UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employee_documents_org ON employee_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_emp ON employee_documents(employee_id);

CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  employee_id UUID NOT NULL UNIQUE REFERENCES employees(id),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  marital_status VARCHAR(50),
  blood_group VARCHAR(10),
  bank_account_number VARCHAR(50),
  bank_name VARCHAR(255),
  bank_ifsc_code VARCHAR(20),
  bank_routing_number VARCHAR(20),
  base_salary NUMERIC(14,2),
  salary_currency VARCHAR(3) DEFAULT 'USD',
  pay_frequency VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_org ON employee_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_emp ON employee_profiles(employee_id);

-- Attendance & Leave Tables
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  attendance_date DATE NOT NULL,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'absent',
  notes TEXT,
  marked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_attendance_employee_date UNIQUE(organization_id, employee_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_org ON attendance(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_emp ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  annual_allocation INTEGER NOT NULL DEFAULT 0,
  carry_forward_limit INTEGER DEFAULT 0,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_leave_types_org_code UNIQUE(organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_leave_types_org ON leave_types(organization_id);

CREATE TABLE IF NOT EXISTS leave_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  financial_year VARCHAR(9) NOT NULL,
  opening_balance NUMERIC(8,2) NOT NULL DEFAULT 0,
  allocated NUMERIC(8,2) NOT NULL DEFAULT 0,
  used NUMERIC(8,2) NOT NULL DEFAULT 0,
  pending NUMERIC(8,2) NOT NULL DEFAULT 0,
  carry_forward NUMERIC(8,2) NOT NULL DEFAULT 0,
  lapsed NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_leave_balance UNIQUE(organization_id, employee_id, leave_type_id, financial_year)
);
CREATE INDEX IF NOT EXISTS idx_leave_balance_org ON leave_balance(organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_balance_emp ON leave_balance(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balance_type ON leave_balance(leave_type_id);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days NUMERIC(8,2) NOT NULL,
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  approver_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_org ON leave_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_start ON leave_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approver ON leave_requests(approver_id);

CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  holiday_date DATE NOT NULL,
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_holidays UNIQUE(organization_id, holiday_date)
);
CREATE INDEX IF NOT EXISTS idx_holidays_org ON holidays(organization_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
