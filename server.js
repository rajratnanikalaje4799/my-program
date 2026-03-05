const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 4000;

// Configure your data path here - can be network path or local path
// Example network path: "\\\\10.57.254.99\\DepotData"
// Example local path: "C:\\DepotData"
const DATA_FOLDER = process.env.DATA_PATH || "./data";

// Main data file path - stores all data in single JSON
const DATA_PATH = path.join(DATA_FOLDER, "credentials.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_FOLDER)) {
  fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

// Initialize default data structure
function initializeData() {
  if (!fs.existsSync(DATA_PATH)) {
    const defaultData = {
      currentUser: null,
      password: "admin123",
      users: [
        {
          id: 'admin_001',
          username: 'admin',
          password: 'admin123',
          fullName: 'Administrator',
          role: 'admin',
          permissions: [
            'dashboard', 'routeMaster', 'driverMaster', 'vehicleMaster',
            'submitLogsheet', 'breakdownAnalysis', 'tyreMaster', 'reports', 'adminPanel'
          ],
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLogin: null
        }
      ],
      logsheets: [],
      routes: [],
      drivers: [],
      vehicles: [],
      breakdowns: [],
      tyres: [],
      tyreAssignments: [],
      tyreIncidents: [],
      settings: {
        lastBackup: null
      }
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData, null, 2));
    console.log("Default data file created at:", DATA_PATH);
  }
}

initializeData();

// Helper functions to read/write data
function readData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf8');
      return JSON.parse(raw);
    }
    return null;
  } catch (error) {
    console.error("Error reading data:", error);
    return null;
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error("Error writing data:", error);
    return false;
  }
}

// ========== CORS - ALLOW ALL ORIGINS (IMPORTANT FOR CLIENT PCs) ==========
app.use(cors({
  origin: '*',  // Allow ALL origins (any IP, any port)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: false
}));

// Handle preflight OPTIONS requests for all routes
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.sendStatus(200);
});

// Add CORS headers to EVERY response
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  next();
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// ==================== CORE API ROUTES (Your structure) ====================

// Fetch live data
app.get("/data", (req, res) => {
  try {
    const data = readData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Update password
app.post("/updatePassword", (req, res) => {
  try {
    const data = readData();
    data.password = req.body.password;
    writeData(data);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Login
app.post("/login", (req, res) => {
  try {
    const data = readData();
    const { username, password } = req.body;
    
    // Find user in users array
    const user = data.users.find(u => 
      u.username === username && 
      u.password === password &&
      u.isActive
    );
    
    if (user) {
      // Update last login
      user.lastLogin = new Date().toISOString();
      data.currentUser = username;
      writeData(data);
      
      // Return user without password
      const { password: _, ...safeUser } = user;
      res.json({ ok: true, user: safeUser });
    } else {
      res.json({ ok: false, error: "Invalid username or password" });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Logout
app.post("/logout", (req, res) => {
  try {
    const data = readData();
    data.currentUser = null;
    writeData(data);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== USERS ROUTES ====================

app.get("/users", (req, res) => {
  try {
    const data = readData();
    const safeUsers = data.users.map(({ password, ...user }) => user);
    res.json({ ok: true, data: safeUsers });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/users", (req, res) => {
  try {
    const data = readData();
    const newUser = {
      ...req.body,
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    
    if (data.users.some(u => u.username === newUser.username)) {
      return res.json({ ok: false, error: "Username already exists" });
    }
    
    data.users.push(newUser);
    writeData(data);
    
    const { password, ...safeUser } = newUser;
    res.json({ ok: true, data: safeUser });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/users/:id", (req, res) => {
  try {
    const data = readData();
    const index = data.users.findIndex(u => u.id === req.params.id);
    
    if (index === -1) {
      return res.json({ ok: false, error: "User not found" });
    }
    
    data.users[index] = { ...data.users[index], ...req.body };
    writeData(data);
    
    const { password, ...safeUser } = data.users[index];
    res.json({ ok: true, data: safeUser });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete("/users/:id", (req, res) => {
  try {
    const data = readData();
    const user = data.users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.json({ ok: false, error: "User not found" });
    }
    
    if (user.username === 'admin') {
      return res.json({ ok: false, error: "Cannot delete main admin" });
    }
    
    data.users = data.users.filter(u => u.id !== req.params.id);
    writeData(data);
    
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/users/saveAll", (req, res) => {
  try {
    const data = readData();
    data.users = req.body.data || [];
    writeData(data);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== GENERIC CRUD ROUTES ====================

function createRoutes(endpoint, dataKey) {
  // Get all
  app.get(`/${endpoint}`, (req, res) => {
    try {
      const data = readData();
      res.json({ ok: true, data: data[dataKey] || [] });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Get by ID
  app.get(`/${endpoint}/:id`, (req, res) => {
    try {
      const data = readData();
      const item = (data[dataKey] || []).find(d => d.id === req.params.id);
      if (item) {
        res.json({ ok: true, data: item });
      } else {
        res.json({ ok: false, error: "Not found" });
      }
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Create
  app.post(`/${endpoint}`, (req, res) => {
    try {
      const data = readData();
      if (!data[dataKey]) data[dataKey] = [];
      
      const newItem = {
        ...req.body,
        id: req.body.id || `${endpoint}_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      
      data[dataKey].push(newItem);
      writeData(data);
      res.json({ ok: true, data: newItem });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Update
  app.put(`/${endpoint}/:id`, (req, res) => {
    try {
      const data = readData();
      if (!data[dataKey]) data[dataKey] = [];
      
      const index = data[dataKey].findIndex(d => d.id === req.params.id);
      
      if (index === -1) {
        return res.json({ ok: false, error: "Not found" });
      }
      
      data[dataKey][index] = { ...data[dataKey][index], ...req.body, updatedAt: new Date().toISOString() };
      writeData(data);
      res.json({ ok: true, data: data[dataKey][index] });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Delete
  app.delete(`/${endpoint}/:id`, (req, res) => {
    try {
      const data = readData();
      if (!data[dataKey]) data[dataKey] = [];
      
      data[dataKey] = data[dataKey].filter(d => d.id !== req.params.id);
      writeData(data);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Save All (replace all data)
  app.post(`/${endpoint}/saveAll`, (req, res) => {
    try {
      const data = readData();
      data[dataKey] = req.body.data || [];
      writeData(data);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}

// Create routes for all data types
createRoutes('logsheets', 'logsheets');
createRoutes('routes', 'routes');
createRoutes('drivers', 'drivers');
createRoutes('vehicles', 'vehicles');
createRoutes('breakdowns', 'breakdowns');
createRoutes('tyres', 'tyres');
createRoutes('tyre-assignments', 'tyreAssignments');
createRoutes('tyre-incidents', 'tyreIncidents');

// ==================== BACKUP ROUTES ====================

// Export all data
app.get("/backup/export", (req, res) => {
  try {
    const data = readData();
    const backup = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      data: {
        users: data.users || [],
        logsheets: data.logsheets || [],
        routes: data.routes || [],
        drivers: data.drivers || [],
        vehicles: data.vehicles || [],
        breakdowns: data.breakdowns || [],
        tyres: data.tyres || [],
        tyreAssignments: data.tyreAssignments || [],
        tyreIncidents: data.tyreIncidents || []
      }
    };
    
    // Update last backup time
    data.settings = data.settings || {};
    data.settings.lastBackup = new Date().toISOString();
    writeData(data);
    
    res.json({ ok: true, data: backup });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Import data
app.post("/backup/import", (req, res) => {
  try {
    const { data: importData, options } = req.body;
    const { replaceExisting, importItems } = options || { replaceExisting: false, importItems: {} };
    
    const currentData = readData();
    
    const dataMapping = {
      users: 'users',
      logsheets: 'logsheets',
      routes: 'routes',
      drivers: 'drivers',
      vehicles: 'vehicles',
      breakdowns: 'breakdowns',
      tyres: 'tyres',
      tyreAssignments: 'tyreAssignments',
      tyreIncidents: 'tyreIncidents'
    };
    
    Object.entries(dataMapping).forEach(([key, dataKey]) => {
      if (importItems[key] && importData[key]) {
        if (replaceExisting) {
          currentData[dataKey] = importData[key];
        } else {
          const existing = currentData[dataKey] || [];
          const merged = [...existing];
          importData[key].forEach(item => {
            if (!merged.some(e => e.id === item.id)) {
              merged.push(item);
            }
          });
          currentData[dataKey] = merged;
        }
      }
    });
    
    writeData(currentData);
    res.json({ ok: true, message: "Data imported successfully" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Clear all data
app.post("/backup/clear", (req, res) => {
  try {
    const data = readData();
    data.logsheets = [];
    data.routes = [];
    data.drivers = [];
    data.vehicles = [];
    data.breakdowns = [];
    data.tyres = [];
    data.tyreAssignments = [];
    data.tyreIncidents = [];
    writeData(data);
    
    res.json({ ok: true, message: "All data cleared" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get storage stats
app.get("/backup/stats", (req, res) => {
  try {
    const data = readData();
    const stats = {
      users: (data.users || []).length,
      logsheets: (data.logsheets || []).length,
      routes: (data.routes || []).length,
      drivers: (data.drivers || []).length,
      vehicles: (data.vehicles || []).length,
      breakdowns: (data.breakdowns || []).length,
      tyres: (data.tyres || []).length,
      tyreAssignments: (data.tyreAssignments || []).length,
      tyreIncidents: (data.tyreIncidents || []).length,
      lastBackup: (data.settings || {}).lastBackup
    };
    
    // Calculate total size
    let totalSize = 0;
    if (fs.existsSync(DATA_PATH)) {
      totalSize = fs.statSync(DATA_PATH).size;
    }
    stats.totalSizeKB = (totalSize / 1024).toFixed(2);
    
    res.json({ ok: true, data: stats });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get settings
app.get("/settings", (req, res) => {
  try {
    const data = readData();
    res.json({ ok: true, data: data.settings || {} });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==================== HEALTH CHECK (For Testing Connection) ====================

app.get("/", (req, res) => {
  res.json({ 
    ok: true, 
    message: "Depot Management Server is running!",
    serverTime: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    ok: true, 
    status: "healthy",
    serverTime: new Date().toISOString()
  });
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, pong: true });
});

// ==================== SERVER START ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         DEPOT MANAGEMENT SYSTEM - SERVER                  ║
║         City Life Line Travels Pvt. Ltd.                  ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on:                                       ║
║    - Local:   http://localhost:${PORT}                       ║
║    - Network: http://10.57.254.99:${PORT}                    ║
║                                                           ║
║  Data stored at: ${DATA_PATH.padEnd(36)}║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /data           - Fetch all data                  ║
║    POST /login          - User login                      ║
║    POST /logout         - User logout                     ║
║    POST /updatePassword - Update password                 ║
║    GET  /backup/export  - Export all data                 ║
║    POST /backup/import  - Import data                     ║
║                                                           ║
║  Default login: admin / admin123                          ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
