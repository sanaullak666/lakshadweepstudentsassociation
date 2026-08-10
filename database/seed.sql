-- Lakshadweep Students Association (LSA) Seed Data

USE lsa_membership;

-- Seed Central Committee Members (Positions 1 to 9)
INSERT INTO central_committee (name, designation, display_order, is_active) VALUES
('Mohammed Safwan', 'President', 1, 1),
('Sanaulla K', 'General Secretary', 2, 1),
('Abdul Hameed', 'Treasurer', 3, 1),
('Publicity Chairman', 'Publicity Board Chairman', 4, 1),
('Aysha Dilna', 'Vice President 1', 5, 1),
('Vice President 2', 'Vice President 2', 6, 1),
('Rafeeq K P', 'Joint Secretary 1', 7, 1),
('Joint Secretary 2', 'Joint Secretary 2', 8, 1),
('Joint Secretary 3', 'Joint Secretary 3', 9, 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Default Admin Account (Email: lakshadweepstudentsassociation@gmail.com)
INSERT INTO admins (email, password_hash, full_name, role) VALUES
('lakshadweepstudentsassociation@gmail.com', '$2a$10$C8.68fLq66rQW92LwXgZg.H1U8y.E1n7nO993YyU2P8n1H1L7O/S2', 'LSA Administrator', 'super_admin')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);
