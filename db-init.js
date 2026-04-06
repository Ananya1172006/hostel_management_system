const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

const names = ["Rahul Sharma", "Anita Singh", "Karan Patel", "Neha Gupta", "Vikram Singh", "Priya Verma", "Amit Kumar", "Sneha Joshi", "Rohit Desai", "Pooja Reddy"];
const courses = ["BTech", "BBA", "BSc", "BCom", "MCA", "MBA"];

db.serialize(() => {
    // 1. Create tables
    db.run(`CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY,
        capacity INTEGER DEFAULT 2
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        roll_no TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        room_id INTEGER,
        course TEXT,
        status TEXT DEFAULT 'Active',
        fee_status TEXT DEFAULT 'Paid'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        title TEXT,
        status TEXT DEFAULT 'Active',
        FOREIGN KEY(student_id) REFERENCES students(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        notice TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        student_id INTEGER,
        status TEXT,
        FOREIGN KEY(student_id) REFERENCES students(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        start_date TEXT,
        end_date TEXT,
        reason TEXT,
        status TEXT DEFAULT 'Pending',
        FOREIGN KEY(student_id) REFERENCES students(id)
    )`);

    // 2. Clear existing entries (optional, to ensure a clean slate)
    db.run("DELETE FROM admin");
    db.run("DELETE FROM students");
    db.run("DELETE FROM rooms");
    db.run("DELETE FROM complaints");
    db.run("DELETE FROM notices");
    db.run("DELETE FROM attendance");
    db.run("DELETE FROM leave_requests");

    // 3. Seed Rooms (101-158)
    for (let r = 101; r <= 158; r++) {
        db.run("INSERT INTO rooms (id, capacity) VALUES (?, 2)", [r]);
    }

    // 4. Seed Admin
    db.run("INSERT INTO admin (username, password) VALUES ('admin', 'admin123')");

    // 5. Seed Notices
    const notices = [
        { date: '10 March', notice: 'Water maintenance between 10AM-1PM' },
        { date: '8 March', notice: 'Mess menu updated' },
        { date: '5 March', notice: 'Hostel curfew changed to 10:30PM' }
    ];
    notices.forEach(n => {
        db.run("INSERT INTO notices (date, notice) VALUES (?, ?)", [n.date, n.notice]);
    });

    // 6. Test Student (Roll No: 21106, Room: 101)
    db.run(`INSERT INTO students (name, username, roll_no, password, room_id, course, status, fee_status) 
        VALUES ('Test Student', '21106', '21106', 'pass21106', 101, 'BTech', 'Active', 'Paid')`, function (err) {
        if (err) console.error(err);
        // Removed pre-seeded complaints as requested
    });
});

console.log('Database initialization started! Wait a second for it to finish.');
