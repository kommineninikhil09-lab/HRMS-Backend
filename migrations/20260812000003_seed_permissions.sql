-- Seed default permissions (idempotent)
INSERT INTO permissions (code, description, module) VALUES
('user.read', 'Read users', 'user'),
('user.create', 'Create users', 'user'),
('user.update', 'Update users', 'user'),
('user.delete', 'Delete users', 'user'),
('role.read', 'Read roles', 'role'),
('role.create', 'Create roles', 'role'),
('role.update', 'Update roles', 'role'),
('role.delete', 'Delete roles', 'role'),
('permission.read', 'Read permissions', 'permission'),
('organization.read', 'Read organizations', 'organization'),
('organization.update', 'Update organizations', 'organization'),
('employee.read', 'Read employees', 'employee'),
('employee.create', 'Create employees', 'employee'),
('employee.update', 'Update employees', 'employee'),
('employee.delete', 'Delete employees', 'employee'),
('salary.read', 'Read salary information', 'salary'),
('salary.update', 'Update salary information', 'salary'),
('audit.read', 'Read audit logs', 'audit')
ON CONFLICT (code) DO NOTHING;
