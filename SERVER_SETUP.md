# Depot Management System - Server Setup Guide

## 🔴 WHY DATA NOT FETCHING ON CLIENT PC? - SOLUTIONS

### Common Issues & How to Fix:

---

## ❌ Issue 1: Windows Firewall Blocking Port 4000

**Symptom:** Client PC shows "Connection refused" or timeout, data doesn't load

**Solution:** Open Windows Firewall on SERVER PC and allow port 4000:

### Steps to Allow Port 4000 in Windows Firewall:

1. Press `Win + R`, type `wf.msc`, press Enter
2. Click **"Inbound Rules"** on the left
3. Click **"New Rule..."** on the right
4. Select **"Port"** → Next
5. Select **"TCP"** and enter **"4000"** → Next
6. Select **"Allow the connection"** → Next
7. Check all profiles (Domain, Private, Public) → Next
8. Name it **"Depot Server Port 4000"** → Finish

### OR Run This Command (Run CMD as Administrator on Server PC):
```cmd
netsh advfirewall firewall add rule name="Depot Server Port 4000" dir=in action=allow protocol=TCP localport=4000
```

---

## ❌ Issue 2: Wrong IP Address in Frontend

**Symptom:** Frontend trying to connect to wrong server IP

**Solution:** Update the API URL in `src/utils/api.ts` (Line 3):

```typescript
// Change this to YOUR Server PC IP
const API_BASE_URL = 'http://YOUR_SERVER_IP:4000';
```

Example:
```typescript
const API_BASE_URL = 'http://10.57.254.99:4000';
```

### How to Find Your Server PC IP Address:
Open CMD on Server PC and run:
```cmd
ipconfig
```
Look for **"IPv4 Address"** under your network adapter (e.g., `10.57.254.99` or `192.168.1.100`)

After changing the IP, rebuild the frontend:
```cmd
npm run build
```

---

## ❌ Issue 3: Server Not Listening on Network Interface

**Symptom:** Server works on localhost but not from other PCs

**Solution:** ✅ Already fixed! Server now binds to `0.0.0.0` which means ALL network interfaces

Make sure server.js has this at the end:
```javascript
app.listen(PORT, '0.0.0.0', () => { ... })
```

---

## ❌ Issue 4: CORS Blocking Requests

**Symptom:** Browser console shows "Access-Control-Allow-Origin" error

**Solution:** ✅ Already fixed! Server now allows ALL origins with proper CORS headers.

---

## ✅ Complete Setup Steps (Do This in Order):

### On SERVER PC:

1. **Install Node.js** from https://nodejs.org (LTS version)

2. **Create folder:**
```cmd
mkdir C:\DepotServer
```

3. **Copy files to C:\DepotServer:**
   - `server.js`
   - `server-package.json` (rename to `package.json`)

4. **Install dependencies:**
```cmd
cd C:\DepotServer
npm install
```

5. **Open Firewall Port (Run CMD as Administrator):**
```cmd
netsh advfirewall firewall add rule name="Depot Server Port 4000" dir=in action=allow protocol=TCP localport=4000
```

6. **Find your Server IP:**
```cmd
ipconfig
```
Note down the IPv4 Address (e.g., `10.57.254.99`)

7. **Start server:**
```cmd
npm start
```

You should see:
```
╔═══════════════════════════════════════════════════════════╗
║         DEPOT MANAGEMENT SYSTEM - SERVER                  ║
║         City Life Line Travels Pvt. Ltd.                  ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on:                                       ║
║    - Local:   http://localhost:4000                       ║
║    - Network: http://10.57.254.99:4000                    ║
╚═══════════════════════════════════════════════════════════╝
```

### On FRONTEND (before building):

8. **Update API URL** in `src/utils/api.ts` (Line 3):
```typescript
const API_BASE_URL = 'http://10.57.254.99:4000';
```

9. **Rebuild frontend:**
```cmd
npm run build
```

10. **Copy `dist/index.html`** to your web server or open directly

---

## 🧪 How to Test Connection:

### From Client PC, open browser and go to:
```
http://10.57.254.99:4000/ping
```

If server is running correctly, you'll see:
```json
{"ok":true,"pong":true}
```

If you see error or timeout, check:
1. Firewall is open on Server PC
2. Server is running (`npm start`)
3. IP address is correct

---

## 📊 Server Status in App

The app now shows **server connection status** at the bottom of the sidebar:

- 🟢 **"Server Connected"** = Working correctly, data stored on server
- 🔴 **"Offline Mode"** = Cannot reach server, using local browser storage

If you see "Offline Mode":
1. Check if server is running
2. Check firewall
3. Check IP address
4. Click refresh icon to retry connection

---

## 🔄 Run Server as Windows Service (Auto-start)

To keep server running even after logout:

```cmd
npm install -g pm2
pm2 start C:\DepotServer\server.js --name "depot-server"
pm2 save
pm2 startup
```

---

## 📁 Data Storage

All data is stored in a single JSON file on the server:
```
C:\DepotServer\data\credentials.json
```

This file contains:
- Users
- Logsheets
- Routes
- Drivers
- Vehicles
- Breakdowns
- Tyres
- Assignments
- Incidents
- Settings

### To Backup:
Simply copy `credentials.json` to a safe location.

### Or use Admin Panel:
Admin Panel → Data Backup → Download Complete Backup

---

## 📞 Quick Reference

| Setting | Value |
|---------|-------|
| Server Port | 4000 |
| Default Username | admin |
| Default Password | admin123 |
| Data File | C:\DepotServer\data\credentials.json |
| API URL | http://YOUR_SERVER_IP:4000 |

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /ping | Health check |
| GET | /health | Server status |
| GET | /data | Get all data |
| POST | /login | User login |
| POST | /logout | User logout |
| GET | /users | Get all users |
| POST | /users | Create user |
| GET | /logsheets | Get all logsheets |
| POST | /logsheets | Create logsheet |
| GET | /backup/export | Export all data |
| POST | /backup/import | Import data |

---

City Life Line Travels Pvt. Ltd.
