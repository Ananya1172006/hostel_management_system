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
        // Roll number validation
        const rollNo = username; // Assuming username field in form maps to roll_no
        if (!/^[1-3][1-5][1-4](?:0[1-9]|[1-7][0-9]|80)$/.test(rollNo)) {
            if (/^4\d*/.test(rollNo)) {
                return res.status(401).json({ success: false, message: '4th-year students are not allowed to access the portal.' });
            }
            return res.status(401).json({ success: false, message: 'Invalid format. Use <year(1-3)><dept(1-5)><class(1-4)><roll(01-80)>' });
        }
        
        const expectedPassword = 'pass' + rollNo;
        if (password !== expectedPassword) {
            return res.status(401).json({ success: false, message: 'Invalid password format.' });
        }

        db.get('SELECT * FROM students WHERE roll_no = ? AND password = ?', [rollNo, password], (err, row) => {
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
    
    // Check room capacity (max 2)
    if (room_id) {
        db.get('SELECT COUNT(*) as count FROM students WHERE room_id = ? AND status = "Active"', [room_id], (err, row) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (row.count >= 2) {
                return res.status(400).json({ success: false, error: 'Room is already full! Maximum capacity is 2.' });
            }
            insertStudent();
        });
    } else {
        insertStudent();
    }

    function insertStudent() {
        db.run(
            `INSERT INTO students (name, username, roll_no, password, room_id, course, status, fee_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
            [name, username, roll_no, password, room_id, course, 'Active', fee_status || 'Pending'], 
            function(err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, studentId: this.lastID });
            }
        );
    }
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
    const studentId = req.params.id;

    // Check room capacity (max 2), excluding this student
    if (room_id) {
        db.get('SELECT COUNT(*) as count FROM students WHERE room_id = ? AND status = "Active" AND id != ?', [room_id, studentId], (err, row) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (row.count >= 2) {
                return res.status(400).json({ success: false, error: 'Room is already full! Maximum capacity is 2.' });
            }
            updateStudent();
        });
    } else {
        updateStudent();
    }

    function updateStudent() {
        db.run(
            `UPDATE students SET name = ?, username = ?, roll_no = ?, room_id = ?, course = ?, fee_status = ? WHERE id = ?`,
            [name, username, roll_no, room_id, course, fee_status, studentId],
            function(err) {
                if(err) return res.status(500).json({success: false, error: err.message});
                res.json({success: true});
            }
        );
    }
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

// Admin Get Attendance
app.get('/api/admin/attendance', (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, error: 'Date is required' });

    db.all(`
        SELECT s.id, s.name, s.roll_no, s.room_id, a.status 
        FROM students s 
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
        WHERE s.status = 'Active'
        ORDER BY s.roll_no
    `, [date], (err, rows) => {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, attendance: rows});
    });
});

// Admin Mark Attendance
app.post('/api/admin/attendance', (req, res) => {
    const { date, student_id, status } = req.body;
    if (!date || !student_id || !status) return res.status(400).json({ success: false, error: 'Missing parameters' });

    db.get('SELECT id FROM attendance WHERE date = ? AND student_id = ?', [date, student_id], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (row) {
            db.run('UPDATE attendance SET status = ? WHERE id = ?', [status, row.id], function(err) {
                if(err) return res.status(500).json({success: false, error: err.message});
                res.json({success: true});
            });
        } else {
            db.run('INSERT INTO attendance (date, student_id, status) VALUES (?, ?, ?)', [date, student_id, status], function(err) {
                if(err) return res.status(500).json({success: false, error: err.message});
                res.json({success: true});
            });
        }
    });
});

// Admin Update Fee Status
app.patch('/api/admin/fees/:studentId', (req, res) => {
    const { fee_status } = req.body;
    db.run(`UPDATE students SET fee_status = ? WHERE id = ?`, [fee_status, req.params.studentId], function(err) {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true});
    });
});


// --- NEW FEATURES: Notices ---
app.get('/api/admin/notices', (req, res) => {
    db.all('SELECT * FROM notices ORDER BY id DESC', (err, rows) => {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, notices: rows});
    });
});

app.post('/api/admin/notices', (req, res) => {
    const { date, notice } = req.body;
    db.run(`INSERT INTO notices (date, notice) VALUES (?, ?)`, [date, notice], function(err) {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, noticeId: this.lastID});
    });
});

app.delete('/api/admin/notices/:id', (req, res) => {
    db.run(`DELETE FROM notices WHERE id = ?`, [req.params.id], function(err) {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true});
    });
});

// --- NEW FEATURES: Rooms ---
app.get('/api/admin/rooms-availability', (req, res) => {
    db.all(`
        SELECT r.id as room_id, r.capacity, COUNT(s.id) as occupants
        FROM rooms r
        LEFT JOIN students s ON r.id = s.room_id AND s.status = 'Active'
        GROUP BY r.id
        ORDER BY r.id ASC
    `, (err, rows) => {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, rooms: rows});
    });
});

// --- NEW FEATURES: Leave Requests ---
app.post('/api/student/leave', (req, res) => {
    const { student_id, start_date, end_date, reason } = req.body;
    db.run(`INSERT INTO leave_requests (student_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)`, 
        [student_id, start_date, end_date, reason], function(err) {
            if(err) return res.status(500).json({success: false, error: err.message});
            res.json({success: true, leaveId: this.lastID});
        }
    );
});

app.get('/api/student/leave/:studentId', (req, res) => {
    db.all('SELECT * FROM leave_requests WHERE student_id = ? ORDER BY id DESC', [req.params.studentId], (err, rows) => {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, leaves: rows});
    });
});

app.get('/api/admin/leave', (req, res) => {
    db.all(`
        SELECT l.*, s.name as student_name, s.roll_no, s.room_id 
        FROM leave_requests l 
        LEFT JOIN students s ON l.student_id = s.id 
        ORDER BY l.id DESC
    `, (err, rows) => {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true, leaves: rows});
    });
});

app.patch('/api/admin/leave/:id', (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE leave_requests SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if(err) return res.status(500).json({success: false, error: err.message});
        res.json({success: true});
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
