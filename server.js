const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const port = 3000;

// PostgreSQL connection configuration
const pool = new Pool({
    user: 'postgres', // Replace with your PostgreSQL username
    host: 'localhost',
    database: 'employee_attendance',
    password: 'root', // Replace with your PostgreSQL password
    port: 5432,
});

// Middleware
app.use(cors());
app.use(express.json());

// Validate Employee ID
function validateEmployeeId(employeeId) {
    const employeeIdRegex = /^ATS0(?!000)\d{3}$/;
    return employeeIdRegex.test(employeeId);
}

// Calculate working hours
function calculateWorkingHours(inTime, outTime) {
    if (!inTime || !outTime) return 0;
    
    const [inH, inM, inS] = inTime.split(':').map(Number);
    const [outH, outM, outS] = outTime.split(':').map(Number);
    
    const inTimeMinutes = inH * 60 + inM + inS / 60;
    const outTimeMinutes = outH * 60 + outM + outS / 60;
    
    const diffMinutes = outTimeMinutes - inTimeMinutes;
    return diffMinutes / 60;
}

// Determine attendance status
function determineAttendanceStatus(hoursWorked) {
    if (hoursWorked >= 8) return 'present';
    if (hoursWorked >= 4) return 'half-day';
    return 'absent';
}

// Punch In/Out
app.post('/api/punch', async (req, res) => {
    const { employeeId } = req.body;
    
    if (!validateEmployeeId(employeeId)) {
        return res.status(400).json({ error: 'Invalid Employee ID' });
    }

    try {
        // Get the latest record for the employee
        const latestRecord = await pool.query(
            'SELECT status, timestamp FROM punch_records WHERE employee_id = $1 AND date = CURRENT_DATE ORDER BY timestamp DESC LIMIT 1',
            [employeeId]
        );

        const currentStatus = latestRecord.rows.length > 0 ? latestRecord.rows[0].status : 'out';
        const newStatus = currentStatus === 'in' ? 'out' : 'in';
        const now = new Date();
        const timestamp = now.toLocaleTimeString('en-US', { hour12: false });
        
        let hoursWorked = null;
        let attendanceStatus = null;

        if (newStatus === 'out' && latestRecord.rows.length > 0) {
            const punchInTime = latestRecord.rows[0].timestamp;
            hoursWorked = calculateWorkingHours(punchInTime, timestamp);
            attendanceStatus = determineAttendanceStatus(hoursWorked);
        }

        const result = await pool.query(
            'INSERT INTO punch_records (employee_id, status, timestamp, date, hours_worked, attendance_status) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5) RETURNING *',
            [employeeId, newStatus, timestamp, hoursWorked, attendanceStatus]
        );

        res.json({
            id: employeeId,
            status: newStatus,
            timestamp,
            date: now.toLocaleDateString(),
            hoursWorked,
            attendanceStatus
        });
    } catch (err) {
        console.error('Error processing punch:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Employee Status
app.get('/api/status/:employeeId', async (req, res) => {
    const { employeeId } = req.params;

    if (!validateEmployeeId(employeeId)) {
        return res.status(400).json({ error: 'Invalid Employee ID' });
    }

    try {
        const result = await pool.query(
            'SELECT status, timestamp FROM punch_records WHERE employee_id = $1 AND date = CURRENT_DATE ORDER BY timestamp DESC LIMIT 1',
            [employeeId]
        );

        if (result.rows.length === 0) {
            return res.json({ status: 'out', timestamp: null });
        }

        res.json({
            status: result.rows[0].status,
            timestamp: result.rows[0].timestamp
        });
    } catch (err) {
        console.error('Error fetching status:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get All Records for Admin
// Get All Records for Admin
app.get('/api/records', async (req, res) => {
    const { employeeId, date } = req.query;

    try {
        let query = `
            SELECT employee_id, status, timestamp, date, hours_worked, attendance_status 
            FROM punch_records
        `;
        const values = [];
        let conditions = [];

        if (employeeId) {
            // Validate employeeId format (optional, remove if partial matching is desired)
            if (!validateEmployeeId(employeeId) && !employeeId.match(/^\w+$/)) {
                return res.status(400).json({ error: 'Invalid Employee ID format' });
            }
            // Use ILIKE for case-insensitive partial matching
            conditions.push(`employee_id ILIKE $${values.length + 1}`);
            values.push(`%${employeeId}%`); // Add % for partial matching
        }

        if (date) {
            // Validate date format (YYYY-MM-DD)
            if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return res.status(400).json({ error: 'Invalid date format' });
            }
            conditions.push(`date = $${values.length + 1}`);
            values.push(date);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY date DESC, timestamp DESC';

        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching records:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Selected Records
app.delete('/api/records', async (req, res) => {
    const { employeeIds } = req.body;

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ error: 'No employee IDs provided' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM punch_records WHERE employee_id = ANY($1) RETURNING *',
            [employeeIds]
        );

        res.json({
            message: `${result.rowCount} record(s) deleted`,
            deletedRecords: result.rows
        });
    } catch (err) {
        console.error('Error deleting records:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});