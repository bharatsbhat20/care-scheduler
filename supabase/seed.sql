-- Seed data for development
-- Run AFTER the migration and AFTER creating test users in Supabase Auth dashboard
-- Replace UUIDs below with actual auth user IDs

-- Example: Insert test profiles (replace UUIDs with real auth.users ids)
-- insert into public.profiles (id, role, full_name, phone) values
--   ('00000000-0000-0000-0000-000000000001', 'admin', 'Admin User', '+1-555-0100'),
--   ('00000000-0000-0000-0000-000000000002', 'elder', 'Margaret Thompson', '+1-555-0101'),
--   ('00000000-0000-0000-0000-000000000003', 'caregiver', 'Jane Smith', '+1-555-0102'),
--   ('00000000-0000-0000-0000-000000000004', 'family', 'Robert Thompson', '+1-555-0103');

-- insert into public.elder_profiles (elder_id, room_unit, emergency_contact_name, emergency_contact_phone, medical_notes) values
--   ('00000000-0000-0000-0000-000000000002', 'Room 204', 'Robert Thompson', '+1-555-0103', 'Diabetes Type 2, Hypertension');

-- insert into public.caregiver_elder_assignments (caregiver_id, elder_id) values
--   ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002');

-- insert into public.family_elder_links (family_id, elder_id, relationship) values
--   ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'Son');

-- insert into public.medications (id, name, dosage, unit, instructions, created_by) values
--   ('10000000-0000-0000-0000-000000000001', 'Metformin', '500', 'mg', 'Take with meals', '00000000-0000-0000-0000-000000000003'),
--   ('10000000-0000-0000-0000-000000000002', 'Lisinopril', '10', 'mg', 'Take in the morning', '00000000-0000-0000-0000-000000000003');
