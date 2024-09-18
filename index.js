const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const multer = require('multer');
const path = require('path');

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Initialize Express
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Add this for parsing JSON in AJAX
app.set('view engine', 'ejs');
app.use(methodOverride('_method')); // Use method-override

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/jobsheetsDB', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir); // Directory for file uploads
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // File name with timestamp
    }
});
const upload = multer({ storage: storage });

// Jobsheet Schema
const jobsheetSchema = new mongoose.Schema({
    clientId: String,
    clientName: String,
    contactNumber: String,
    inventoryReceived: String,
    reportedIssue: String,
    clientNote: String, // Optional paragraph
    assignedTechnician: String,
    estimatedAmount: Number,
    deadline: Date,
    status: String,
    attachment: String // New field for file attachment
});

const Jobsheet = mongoose.model('Jobsheet', jobsheetSchema);

// Home route - List all jobsheets
app.get('/', async(req, res) => {
    try {
        const jobsheets = await Jobsheet.find(); // Fetch all jobsheets
        res.render('home', { jobsheets }); // Pass the jobsheets to your view
    } catch (error) {
        console.error('Error fetching jobsheets:', error);
        res.status(500).send('Server error');
    }
});

// Search jobsheets by client name or ID
app.get('/search', async(req, res) => {
    const query = req.query.q;
    try {
        const jobsheets = await Jobsheet.find({
            $or: [
                { clientName: new RegExp(query, 'i') },
                { clientId: new RegExp(query, 'i') }
            ]
        });
        res.render('home', { jobsheets });
    } catch (err) {
        console.error('Error searching jobsheets:', err);
        res.status(500).send('Server Error');
    }
});

// New jobsheet form route
app.get('/new', (req, res) => {
    res.render('new');
});

// Create a new jobsheet with file upload
app.post('/new', upload.single('attachment'), async(req, res) => {
    try {
        const newJobsheet = new Jobsheet({
            clientId: req.body.clientId,
            clientName: req.body.clientName,
            contactNumber: req.body.contactNumber,
            inventoryReceived: req.body.inventoryReceived,
            reportedIssue: req.body.reportedIssue,
            attachment: req.file ? req.file.filename : null, // Store the filename of the uploaded file
            clientNote: req.body.clientNote || '', // Handle optional field
            assignedTechnician: req.body.assignedTechnician,
            estimatedAmount: req.body.estimatedAmount,
            deadline: req.body.deadline,
            status: req.body.status
        });
        await newJobsheet.save();
        res.redirect('/');
    } catch (err) {
        console.error('Error saving new jobsheet:', err);
        res.status(500).send('Server Error');
    }
});

// View a specific jobsheet
app.get('/view/:id', async(req, res) => {
    try {
        const jobsheet = await Jobsheet.findById(req.params.id);
        res.render('view', { jobsheet });
    } catch (err) {
        console.error('Error fetching jobsheet:', err);
        res.status(500).send('Server Error');
    }
});

// Edit jobsheet form route
app.get('/edit/:id', async(req, res) => {
    try {
        const jobsheet = await Jobsheet.findById(req.params.id);
        res.render('edit', { jobsheet });
    } catch (err) {
        console.error('Error fetching jobsheet for editing:', err);
        res.status(500).send('Server Error');
    }
});

// Update a jobsheet
app.post('/edit/:id', upload.single('attachment'), async(req, res) => {
    try {
        const updatedFields = {
            clientId: req.body.clientId,
            clientName: req.body.clientName,
            contactNumber: req.body.contactNumber,
            inventoryReceived: req.body.inventoryReceived,
            reportedIssue: req.body.reportedIssue,
            clientNote: req.body.clientNote || '',
            assignedTechnician: req.body.assignedTechnician,
            estimatedAmount: req.body.estimatedAmount,
            deadline: req.body.deadline,
            status: req.body.status,
        };
        if (req.file) {
            updatedFields.attachment = req.file.filename; // Update attachment if a new file is uploaded
        }
        await Jobsheet.findByIdAndUpdate(req.params.id, updatedFields);
        res.redirect('/view/' + req.params.id);
    } catch (err) {
        console.error('Error updating jobsheet:', err);
        res.status(500).send('Server Error');
    }
});

// Delete a jobsheet via AJAX
app.delete('/delete/:id', async(req, res) => {
    try {
        await Jobsheet.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Jobsheet deleted successfully!' });
    } catch (err) {
        console.error('Error deleting jobsheet:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update client note via POST
app.post('/save-note/:id', async(req, res) => {
    try {
        const { note } = req.body; // Capture the note sent from the frontend
        if (note) {
            const jobsheet = await Jobsheet.findById(req.params.id);
            jobsheet.clientNote = note; // Update the client note in the jobsheet
            await jobsheet.save();
            res.json({
                success: true,
                message: 'Note saved successfully!',
                clientNote: jobsheet.clientNote // Return the updated note to the frontend
            });
        } else {
            res.json({ success: false, message: 'Note cannot be empty!' });
        }
    } catch (err) {
        console.error('Error saving note:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Start the server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});