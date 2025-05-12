CREATE DATABASE employee_attendance;

CREATE TABLE punch_records (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(7) NOT NULL,
    status VARCHAR(3) NOT NULL CHECK (status IN ('in', 'out')),
    timestamp VARCHAR(20) NOT NULL,
    date VARCHAR(20) NOT NULL,
    hours_worked FLOAT,
    attendance_status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_id_date ON punch_records (employee_id, date);
