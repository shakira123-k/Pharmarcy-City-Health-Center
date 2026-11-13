
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());


const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pharmacy_city_db'
});

app.post('/api/vitals', (req, res) => {
    const { patient_id, blood_pressure, heart_rate, temperature, blood_glucose } = req.body;

    const query = `INSERT INTO vital_logs (patient_id, blood_pressure, heart_rate, temperature, blood_glucose) VALUES (?, ?, ?, ?, ?)`;
    
    db.query(query, [patient_id, blood_pressure, heart_rate, temperature, blood_glucose], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        
        if (heart_rate > 100 || heart_rate < 60 || temperature > 38.0) {
            const alertMsg = `Critical threshold breached for Patient ID ${patient_id}: HR=${heart_rate}, Temp=${temperature}`;
            const alertQuery = `INSERT INTO clinical_alerts (patient_id, alert_message, severity_level) VALUES (?, ?, 'Critical')`;
            
            db.query(alertQuery, [patient_id, alertMsg], (alertErr) => {
                if (alertErr) console.error("Failed to log alert:", alertErr);
            });
        }

        res.status(201).json({ message: 'Vitals saved successfully', log_id: result.insertId });
    });
});


app.listen(3000, () => {
    console.log('Pharmacy City Health backend server running on port 3000');
});