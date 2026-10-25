# MIOT Home Automation Web Dashboard

A responsive, industrial-grade web dashboard for remote ESP8266 IoT telemetry and actuator control. Communicates with your NodeMCU anywhere in the world through **EMQX Cloud MQTT over Secure WebSockets (WSS)**.

---

## Architecture Overview

```
[ Browser / Phone ]
   |
   | (WSS Port 8084 /mqtt)
   v
[ EMQX Cloud Broker ] <------------------ [ ESP8266 NodeMCU ]
  zadd17f0.ala.us-east-1.emqxsl.com         (TLS Port 8883)
   |                                            |
   |-- Publishes: miot/home01/command --------> | (Receives & Acts)
   |                                            |
   |<-- Publishes: miot/home01/status --------- | (Periodic JSON)
```

> **Direct Cloud Control:** The hosted website controls your hardware remotely through the EMQX Cloud broker. It **never** calls local private IP addresses (such as `10.32.56.133`), meaning you can monitor and operate your devices from any Wi-Fi or mobile cellular network.

---

## Hardware Pin Mapping Reference

| Function | Pin Name | Hardware / Module | Behavior / State |
| :--- | :--- | :--- | :--- |
| **Built-in LED** | `LED_BUILTIN` | NodeMCU On-board LED | **Active LOW** (`LOW` = ON, `HIGH` = OFF) |
| **External LED** | `D2` (`GPIO4`) | External LED circuit | **Active HIGH** (`HIGH` = ON, `LOW` = OFF) |
| **LDR Sensor** | `D5` (`GPIO14`) | Digital Light Dependent Resistor | `HIGH` = **DARK**, `LOW` = **BRIGHT** |
| **DC Motor PWM** | `D6` (`GPIO12`) | L298N Driver **ENA** | Speed range: `0` to `1023` |
| **DC Motor IN1** | `D7` (`GPIO13`) | L298N Driver **IN1** | Direction Control |
| **DC Motor IN2** | `D1` (`GPIO5`) | L298N Driver **IN2** | Direction Control |

> **Safety Warning:** Ensure external DC motors use a dedicated battery or external power source with a **common ground** connected to the ESP8266 `GND`. Never power heavy DC motors directly from the ESP8266 3.3V pin.

---

## Quick Start: Local Testing

### Option A: Using Node.js (Recommended)
From the project folder:
```powershell
npm run dev
```
or
```powershell
npx serve -l 3000
```
Then open your browser to [http://localhost:3000](http://localhost:3000).

### Option B: Using Python
If you have Python installed:
```powershell
python -m http.server 3000
```
Then open [http://localhost:3000](http://localhost:3000).

### Option C: VS Code Live Server
Right-click `index.html` in VS Code and select **Open with Live Server**.

---

## Configuring MQTT Credentials

For security, the project ships with placeholder credentials so real passwords are never accidentally checked into Git or deployed publicly.

### Method 1: Using the in-Dashboard Settings Dialog (Recommended)
1. Open the dashboard in your browser.
2. Click the **Settings** button in the top right header (or click **Configure Credentials** on the setup banner).
3. Enter your dedicated EMQX username and password.
4. Click **Save & Connect**.
5. Your credentials are saved **only inside your browser's private `localStorage`** on that device. They are not stored in any code files.

### Method 2: Editing `js/config.js` (For Private Local Use)
Open `js/config.js` and edit the placeholders:
```javascript
username: "YOUR_EMQX_USERNAME",
password: "YOUR_EMQX_PASSWORD",
```

---

## MQTT Communication Reference

### Broker Connection Parameters
- **Host:** `zadd17f0.ala.us-east-1.emqxsl.com`
- **Protocol:** `WSS` (WebSocket Secure)
- **Port:** `8084`
- **Path:** `/mqtt`
- **Client ID:** Unique randomized string (`miot-web-xxxxxxxx`)

### MQTT Topics
- **Command Topic (Publish):** `miot/home01/command`
- **Status Topic (Subscribe):** `miot/home01/status`

### Actuator Commands (QoS 1, Retain: false)
| Command String | Description |
| :--- | :--- |
| `led/on` | Turns on both Built-in LED and External LED |
| `led/off` | Turns off both LEDs |
| `mode/auto` | Switches lighting to automatic (DARK => ON, BRIGHT => OFF) |
| `mode/manual` | Disables automatic LDR lighting triggers |
| `motor/on` | Starts the DC motor with current direction and speed |
| `motor/off` | Stops the DC motor |
| `motor/forward` | Sets motor rotation to forward |
| `motor/reverse` | Sets motor rotation to reverse |
| `motor/speed/<value>` | Sets PWM speed (e.g., `motor/speed/700`, value `0` to `1023`) |
| `status/request` | Requests an immediate status report packet |

### Expected Status JSON Format
The ESP8266 periodically publishes a JSON packet to `miot/home01/status`:
```json
{
  "device": "ESP8266",
  "wifi": "CONNECTED",
  "ssid": "OnePlus Nord CE 3 Lite 5G",
  "ip": "10.32.56.133",
  "led": "ON",
  "light": "DARK",
  "mode": "AUTO",
  "motor": "ON",
  "direction": "FORWARD",
  "speed": 700
}
```
*The dashboard defensively handles uppercase, lowercase, numeric (1/0), and boolean values.*

---

## Security Best Practices & ACL Configuration

### 1. Browser Security Reality
Any credential embedded directly into public client-side JavaScript or HTML can be inspected and copied by any visitor using browser DevTools.

### 2. Creating a Dedicated Restricted EMQX User
To protect your EMQX Cloud broker:
1. Log in to your **EMQX Cloud Console**.
2. Navigate to **Access Control** &rarr; **Authentication**.
3. Create a **dedicated dashboard user** (e.g. `miot_dashboard_user`) with a strong password. Do **not** use the same credentials as your ESP8266 hardware or administrator account.
4. Navigate to **Access Control** &rarr; **Authorization (ACL)**.
5. Create an ACL policy rule for this dashboard user:
   - **Publish:** Allow ONLY to topic `miot/home01/command`
   - **Subscribe:** Allow ONLY to topic `miot/home01/status`
   - **Deny** access to all other topics (e.g. `$SYS/#`, `#`).

### 3. Production Deployment Architecture
If you plan to publish this website publicly to family or colleagues:
- Use a lightweight serverless backend or authentication proxy (such as a Next.js API route, Cloudflare Worker, or JWT-based EMQX authentication) that verifies authenticated users before granting short-lived temporary broker tokens.

---

## Deploying to Vercel

The dashboard is structured as a pure static website at the root directory with no build step required.

### Deploying via GitHub (Beginner Friendly)
1. Initialize Git and commit the workspace:
   ```powershell
   git init
   git add .
   git commit -m "Initial MIOT Home Automation Dashboard"
   ```
2. Push your project to a **private** GitHub repository.
3. Visit [vercel.com](https://vercel.com) and log in.
4. Click **Add New Project** &rarr; **Import Git Repository**.
5. Select your GitHub repository.
6. Leave **Framework Preset** as **Other** and Build Command empty.
7. Click **Deploy**.
8. Once live, open your Vercel URL, click **Settings**, and enter your restricted EMQX username and password.

### Deploying via Vercel CLI
1. Install Vercel CLI:
   ```powershell
   npm install -g vercel
   ```
2. In the project directory, run:
   ```powershell
   vercel
   ```
3. Follow the on-screen prompts to deploy.

---

## Verification & Troubleshooting Checklist

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Credentials required" banner is visible** | Username or password has placeholder text | Click **Configure Credentials** in the banner or top-right **Settings** and enter your EMQX credentials. |
| **"MQTT offline" or "Connection error"** | Incorrect WSS port, URL, or firewall blocking port 8084 | Verify that you are connecting to port `8084` with path `/mqtt`. Ensure corporate or school firewalls allow outgoing WSS traffic on port 8084. |
| **"Publish failed: Not authorized"** | EMQX ACL is rejecting the publish action | In EMQX Cloud Console &rarr; Authorization, verify that your user has permission to publish to `miot/home01/command`. |
| **MQTT connected, but Device Status says "Awaiting Status"** | ESP8266 is disconnected from Wi-Fi or broker | Check your ESP8266 Serial Monitor at 115200 baud. Verify Wi-Fi hotspot is running and connected to `zadd17f0.ala.us-east-1.emqxsl.com:8883`. |
| **Motor does not spin when commanded** | Motor power supply or L298N driver wiring issue | Verify external power source to L298N VMS pin. Check that ESP8266 GND and battery GND are joined. Ensure PWM speed is set above the motor's stall threshold (> 400). |
| **Malformed JSON in log** | Firmware Serial print or non-JSON output on status topic | Check ESP8266 firmware sketch to ensure only valid JSON formatted strings are published to `miot/home01/status`. |
