-- Phase 1 Seed Data for all entities
-- Run this after migrations

DO $$
DECLARE
  org_id UUID;
  bu_id UUID;
  loc_id UUID;
  dept_id UUID;
  grade_id UUID;
  desig_id UUID;
  team_id UUID;
  emp_id UUID;
BEGIN
  -- Get dev organization
  SELECT id INTO org_id FROM organizations WHERE slug = 'dev-org';

  -- Business Units
  INSERT INTO business_units (organization_id, name, code, status)
  VALUES (org_id, 'Engineering', 'ENG', 'active') RETURNING id INTO bu_id;

  INSERT INTO business_units (organization_id, name, code, status)
  VALUES (org_id, 'Human Resources', 'HR', 'active');

  INSERT INTO business_units (organization_id, name, code, status)
  VALUES (org_id, 'Finance', 'FIN', 'active');

  -- Locations
  INSERT INTO locations (organization_id, name, code, city, country, timezone, status)
  VALUES (org_id, 'Bangalore HQ', 'BNG001', 'Bangalore', 'India', 'Asia/Kolkata', 'active') RETURNING id INTO loc_id;

  INSERT INTO locations (organization_id, name, code, city, country, timezone, status)
  VALUES (org_id, 'Delhi Office', 'DEL001', 'Delhi', 'India', 'Asia/Kolkata', 'active');

  -- Departments
  INSERT INTO departments (organization_id, business_unit_id, name, code, status)
  VALUES (org_id, bu_id, 'Backend Team', 'DEPT001', 'active') RETURNING id INTO dept_id;

  INSERT INTO departments (organization_id, business_unit_id, name, code, status)
  VALUES (org_id, bu_id, 'Frontend Team', 'DEPT002', 'active');

  -- Grades
  INSERT INTO grades (organization_id, name, rank_order, status)
  VALUES (org_id, 'Executive', 1, 'active') RETURNING id INTO grade_id;

  INSERT INTO grades (organization_id, name, rank_order, status)
  VALUES (org_id, 'Senior Manager', 2, 'active');

  INSERT INTO grades (organization_id, name, rank_order, status)
  VALUES (org_id, 'Manager', 3, 'active');

  INSERT INTO grades (organization_id, name, rank_order, status)
  VALUES (org_id, 'Senior Developer', 4, 'active');

  INSERT INTO grades (organization_id, name, rank_order, status)
  VALUES (org_id, 'Developer', 5, 'active');

  -- Designations
  INSERT INTO designations (organization_id, grade_id, title, code, status)
  VALUES (org_id, grade_id, 'CTO', 'CTO001', 'active') RETURNING id INTO desig_id;

  INSERT INTO designations (organization_id, grade_id, title, code, status)
  VALUES (org_id, grade_id, 'VP Engineering', 'VPENG001', 'active');

  -- Teams
  INSERT INTO teams (organization_id, department_id, name, code, status)
  VALUES (org_id, dept_id, 'Backend Devs', 'TEAM001', 'active') RETURNING id INTO team_id;

  -- Employees (Sample Data)
  INSERT INTO employees (
    organization_id, employee_code, first_name, last_name, work_email,
    department_id, location_id, designation_id, manager_id, date_of_joining, status
  ) VALUES (
    org_id, 'EMP001', 'John', 'Smith', 'john.smith@dev-org.local',
    dept_id, loc_id, desig_id, NULL, NOW()::date, 'active'
  ) RETURNING id INTO emp_id;

  INSERT INTO employees (
    organization_id, employee_code, first_name, last_name, work_email,
    department_id, location_id, date_of_joining, status, manager_id
  ) VALUES (
    org_id, 'EMP002', 'Jane', 'Doe', 'jane.doe@dev-org.local',
    dept_id, loc_id, NOW()::date, 'active', emp_id
  );

  INSERT INTO employees (
    organization_id, employee_code, first_name, last_name, work_email,
    department_id, location_id, date_of_joining, status, manager_id
  ) VALUES (
    org_id, 'EMP003', 'Bob', 'Johnson', 'bob.johnson@dev-org.local',
    dept_id, loc_id, NOW()::date, 'active', emp_id
  );

  RAISE NOTICE 'Phase 1 seed data created successfully';
END $$;
