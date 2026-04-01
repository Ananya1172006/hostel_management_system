const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database('database.db');

// --- Endpoints ---
app.post('/api/login', (req, res) => {
    const { username, password, type } = req.body;
    
    if (type === 'admin') {
        db.get('SELECT * FROM admin WHERE username = ? AND password = ?', [username, password], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row) {
                res.json({ success: true, user: { id: row.id, username: row.username, type: 'admin' } });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        });
    } else {
        db.get('SELECT * FROM students WHERE (username = ? OR roll_no = ?) AND password = ?', [username, username, password], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row) {
                res.json({ success: true, user: { id: row.id, name: row.name, username: row.username, roll_no: row.roll_no, room_id: row.room_id, course: row.course, fee_status: row.fee_status, type: 'student' } });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        });
    }
});

// Admin Add Student
app.post('/api/admin/students', (req, res) => {
    const { name, username, password, roll_no, room_id, course, fee_status } = req.body;
    db.run(
        `INSERT INTO students (name, username, roll_no, password, room_id, course, status, fee_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
        [name, username, roll_no, password, room_id, course, 'Active', fee_status || 'Pending'], 
        function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, studentId: this.lastID });
        }
    );
});

// Admin Dashboard stats
app.get('/api/admin/dashboard', (req, res) => {
    const stats = {};
    db.get('SELECT COUNT(*) as total_students FROM students', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.total_students = row.total_students;
        
        db.get('SELECT COUNT(DISTINCT room_id) as occupied_rooms FROM students WHERE room_id IS NOT NULL', (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.occupied_rooms = row.occupied_rooms;
            
            db.get('SELECT COUNT(*) as active_complaints FROM complaints WHERE status = "Active"', (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.active_complaints = row.active_complaints;
                
                db.all('SELECT name, room_id, course, status FROM students ORDER BY id DESC LIMIT 5', (err, rows) => {
                     if (err) return res.status(500).json({ error: err.message });
                     stats.recent_students = rows;
                     res.json(stats);
                });
            });
        });
    });
});

// Student Dashboard stats
app.get('/api/student/dashboard/:studentId', (req, res) => {
    const studentId = req.params.studentId;
    const data = {};
    
    db.get('SELECT * FROM students WHERE id = ?', [studentId], (err, student) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        
        data.student = student;
        db.get('SELECT COUNT(*) as active_complaints FROM complaints WHERE student_id = ? AND status = "Active"', [studentId], (err, row) => {
             if (err) return res.status(500).json({ error: err.message });
             data.active_complaints = row.active_complaints;
             
             db.all('SELECT * FROM notices ORDER BY id DESC LIMIT 5', (err, notices) => {
                 if (err) return res.status(500).json({ error: err.message });
                 data.notices = notices;
                 res.json(data);
             });
        });
    });
});

// Admin Get All Students
app.get('/api/admin/students', (req, res) => {
    db.all('SELECT * FROM students ORDER BY id DESC', (err, rows) => {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, students: rows});
    });
});

// Admin Update Student
app.put('/api/admin/students/:id', (req, res) => {
    const { name, username, roll_no, room_id, course, fee_status } = req.body;
    db.run(
        `UPDATE students SET name = ?, username = ?, roll_no = ?, room_id = ?, course = ?, fee_status = ? WHERE id = ?`,
        [name, username, roll_no, room_id, course, fee_status, req.params.id],
        function(err) {
            if(err) return res.status(500).json({success: false, error: err.message});
            res.json({success: true});
        }
    );
});

// Admin Delete Student
app.delete('/api/admin/students/:id', (req, res) => {
    db.run(`DELETE FROM students WHERE id = ?`, [req.params.id], function(err) {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true});
    });
});

// Student Submit Complaint
app.post('/api/complaints', (req, res) => {
    const { student_id, title } = req.body;
    db.run(`INSERT INTO complaints (student_id, title, status) VALUES (?, ?, 'Pending')`, [student_id, title], function(err) {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, complaintId: this.lastID});
    });
});

// Student Get My Complaints
app.get('/api/student/complaints/:studentId', (req, res) => {
    db.all('SELECT * FROM complaints WHERE student_id = ? ORDER BY id DESC', [req.params.studentId], (err, rows) => {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, complaints: rows});
    });
});

// Admin Get All Complaints
app.get('/api/admin/complaints', (req, res) => {
    db.all(`
        SELECT c.*, s.name as student_name, s.room_id 
        FROM complaints c 
        LEFT JOIN students s ON c.student_id = s.id 
        ORDER BY c.id DESC
    `, (err, rows) => {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, complaints: rows});
    });
});

// Admin Update Complaint Status
app.patch('/api/admin/complaints/:id', (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE complaints SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true});
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
