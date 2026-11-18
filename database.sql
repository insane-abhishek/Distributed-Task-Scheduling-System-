-- ==========================================================
-- Course Project: Distributed Task Scheduling System
-- Database Name: task_scheduler
-- Technologies: MySQL, Node.js, Express.js
-- ==========================================================

-- 1. Create the database
CREATE DATABASE IF NOT EXISTS task_scheduler;
USE task_scheduler;

-- 2. Create Members Table
-- Stores team members who can be assigned distributed tasks
CREATE TABLE IF NOT EXISTS members (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE
);

-- 3. Create Tasks Table
-- Stores tasks with scheduling parameters and assignments
-- Uses foreign key constraint connecting assigned_to with member_id
CREATE TABLE IF NOT EXISTS tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    assigned_to INT,
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    deadline DATE,
    status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
    FOREIGN KEY (assigned_to) REFERENCES members(member_id) ON DELETE SET NULL
);

-- 4. Insert Initial Sample Data for Team Members
INSERT INTO members (name, email) VALUES
('Abhishek Raj', 'abhishek.raj@example.edu'),
('Ajna K J', 'ajna.kj@example.edu'),
('Anshuman Raj', 'anshuman.raj@example.edu');

-- 5. Insert Initial Sample Data for Tasks
INSERT INTO tasks (title, assigned_to, priority, deadline, status) VALUES
('Design Database ER Diagram', 1, 'High', '2026-11-05', 'Completed'),
('Implement REST API Endpoints', 2, 'High', '2026-11-08', 'In Progress'),
('Create Frontend Navigation & Forms', 3, 'Medium', '2026-11-10', 'Pending'),
('Perform Unit Testing on Task Scheduling', 1, 'Low', '2026-11-12', 'Pending'),
('Prepare Viva Presentation Slides', 2, 'Medium', '2026-11-15', 'Pending');

