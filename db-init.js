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

    // 2. Clear existing entries (optional, to ensure a clean slate)
    db.run("DELETE FROM admin");
    db.run("DELETE FROM students");
    db.run("DELETE FROM rooms");
    db.run("DELETE FROM complaints");
    db.run("DELETE FROM notices");

    // 3. Seed Admin
    db.run("INSERT INTO admin (username, password) VALUES ('admin', 'admin123')");

    // 4. Seed Notices
    const notices = [
        { date: '10 March', notice: 'Water maintenance between 10AM-1PM' },
        { date: '8 March', notice: 'Mess menu updated' },
        { date: '5 March', notice: 'Hostel curfew changed to 10:30PM' }
    ];
    notices.forEach(n => {
        db.run("INSERT INTO notices (date, notice) VALUES (?, ?)", [n.date, n.notice]);
    });

    // 5. Seed Students (100) and link logic
    let complaintsCount = 0;
    for (let i = 1; i <= 100; i++) {
        const name = names[Math.floor(Math.random() * names.length)] + " " + i;
        const roll_no = "ROLL" + (1000 + i);
        const username = "student" + i;
        const password = "student" + i;
        // Rooms from 101 to 150 (since roughly 2 per room)
        const room_id = 100 + Math.ceil(i / 2);
        const course = courses[Math.floor(Math.random() * courses.length)];
        const status = Math.random() > 0.9 ? 'Pending' : 'Active';
        const fee_status = Math.random() > 0.8 ? 'Pending' : 'Paid';

        db.run(`INSERT INTO students (name, username, roll_no, password, room_id, course, status, fee_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, username, roll_no, password, room_id, course, status, fee_status], function (err) {
                if (err) console.error(err);
                const studentId = this.lastID;

                // Randomly assign a complaint occasionally (e.g. ~20% of students)
                if (Math.random() > 0.8 && complaintsCount < 20) {
                    db.run("INSERT INTO complaints (student_id, title) VALUES (?, ?)", [studentId, "Maintenance Issue " + studentId]);
                    complaintsCount++;
                }
            });
    }

    // Add specifically "student" / "student123" for testing to match what script expects
    db.run(`INSERT INTO students (name, username, roll_no, password, room_id, course, status, fee_status) 
        VALUES ('Test Student', 'student', 'ROLL0000', 'student123', 203, 'BTech', 'Active', 'Paid')`, function (err) {
        if (err) console.error(err);
        db.run("INSERT INTO complaints (student_id, title) VALUES (?, ?)", [this.lastID, "AC not working"]);
        db.run("INSERT INTO complaints (student_id, title) VALUES (?, ?)", [this.lastID, "Tap leaking"]);
    });
});

console.log('Database initialization started! Wait a second for it to finish.');
