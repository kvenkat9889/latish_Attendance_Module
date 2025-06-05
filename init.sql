CREATE TABLE IF NOT EXISTS punch_records (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(80) NOT NULL,
    status VARCHAR(80) NOT NULL,
    timestamp TIME NOT NULL,
    date DATE NOT NULL,
    hours_worked NUMERIC,
    attendance_status VARCHAR(90)
);
