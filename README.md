# ⚡ MIOT Home Automation Web Dashboard

<div align="center">
  <img src="https://img.shields.io/badge/ESP8266-NodeMCU-00C7B7?style=for-the-badge&logo=arduino&logoColor=white" alt="ESP8266" />
  <img src="https://img.shields.io/badge/MQTT-EMQX%20Cloud-FF6B6B?style=for-the-badge" alt="MQTT" />
  <img src="https://img.shields.io/badge/Vercel-Deploy-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Status-Online%20Dashboard-34D399?style=for-the-badge" alt="Status" />
</div>

A responsive, industrial-grade web dashboard for remote ESP8266 IoT telemetry and actuator control. It connects your NodeMCU to the cloud through EMQX Cloud MQTT over Secure WebSockets, giving you live control over LEDs, lighting automation, and DC motor behavior from any browser.

> Smart, safe, and cloud-ready monitoring for a home automation prototype built around MQTT, real-time status telemetry, and remote control.

---

## 🌐 Live Architecture

<div align="center">
  <svg width="980" height="260" viewBox="0 0 980 260" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MIOT architecture diagram with animated data flow">
    <defs>
      <linearGradient id="connectGlow" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="#7dd3fc"/>
        <stop offset="50%" stop-color="#22d3ee"/>
        <stop offset="100%" stop-color="#a78bfa"/>
      </linearGradient>
      <linearGradient id="nodeGlow" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="100%" stop-color="#10b981"/>
      </linearGradient>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <rect x="20" y="30" width="180" height="80" rx="18" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
    <text x="110" y="68" text-anchor="middle" fill="#e2e8f0" font-size="20" font-family="Arial, sans-serif" font-weight="700">Browser</text>
    <text x="110" y="92" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="Arial, sans-serif">Phone / Laptop</text>

    <rect x="390" y="30" width="200" height="80" rx="18" fill="#111827" stroke="#a78bfa" stroke-width="2"/>
    <text x="490" y="68" text-anchor="middle" fill="#e2e8f0" font-size="20" font-family="Arial, sans-serif" font-weight="700">EMQX Cloud</text>
    <text x="490" y="92" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="Arial, sans-serif">MQTT Broker</text>

    <rect x="720" y="30" width="220" height="80" rx="18" fill="#052e2b" stroke="#34d399" stroke-width="2"/>
    <text x="830" y="68" text-anchor="middle" fill="#ecfeff" font-size="20" font-family="Arial, sans-serif" font-weight="700">ESP8266</text>
    <text x="830" y="92" text-anchor="middle" fill="#bbf7d0" font-size="14" font-family="Arial, sans-serif">NodeMCU + Sensors</text>

    <path d="M200 70 H390" stroke="url(#connectGlow)" stroke-width="4" stroke-linecap="round" marker-end="url(#arrowHead)" filter="url(#softGlow)">
      <animate attributeName="stroke-dasharray" values="0 1000; 1000 0; 0 1000" dur="2.2s" repeatCount="indefinite"/>
    </path>
    <path d="M590 70 H720" stroke="url(#connectGlow)" stroke-width="4" stroke-linecap="round" marker-end="url(#arrowHead)" filter="url(#softGlow)">
      <animate attributeName="stroke-dasharray" values="0 1000; 1000 0; 0 1000" dur="2.2s" begin="0.6s" repeatCount="indefinite"/>
    </path>

    <defs>
      <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#7dd3fc"/>
      </marker>
    </defs>

    <circle cx="250" cy="170" r="18" fill="#22d3ee" opacity="0.9" filter="url(#softGlow)">
      <animate attributeName="r" values="12;18;12" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="490" cy="170" r="18" fill="#a78bfa" opacity="0.9" filter="url(#softGlow)">
      <animate attributeName="r" values="12;18;12" dur="1.8s" begin="0.4s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" begin="0.4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="820" cy="170" r="18" fill="#34d399" opacity="0.9" filter="url(#softGlow)">
      <animate attributeName="r" values="12;18;12" dur="1.8s" begin="0.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" begin="0.8s" repeatCount="indefinite"/>
    </circle>

    <path d="M250 140 L250 190" stroke="#67e8f9" stroke-width="3" stroke-linecap="round"/>
    <path d="M490 140 L490 190" stroke="#c4b5fd" stroke-width="3" stroke-linecap="round"/>
    <path d="M820 140 L820 190" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round"/>

    <text x="250" y="225" text-anchor="middle" fill="#e2e8f0" font-size="16" font-family="Arial, sans-serif">Command</text>
    <text x="490" y="225" text-anchor="middle" fill="#e2e8f0" font-size="16" font-family="Arial, sans-serif">Broker</text>
    <text x="820" y="225" text-anchor="middle" fill="#e2e8f0" font-size="16" font-family="Arial, sans-serif">Status</text>
  </svg>
</div>

### 🔄 Communication flow

```text
[ Browser / Phone ] --WSS:8084--> [ EMQX Cloud Broker ] --MQTT/TLS:8883--> [ ESP8266 NodeMCU ]
      |                                     |                                      |
      |                                     |                                      +--> Built-in LED
      |                                     |                                      +--> External LED
      |                                     |                                      +--> LDR Sensor
      |                                     |                                      +--> DC Motor
      +-------------------------------------<------------------------------------<-- Status JSON stream
```

> Direct cloud control: the hosted dashboard communicates through EMQX Cloud and does not rely on any local private IP access.

---

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| 🔌 Remote control | Publish commands from the web dashboard to the broker and onto the ESP8266 |
| 💡 Automated lighting | LDR-driven light and dark detection switches lighting automatically |
| 🏎️ Motor control | Direction, start/stop, and PWM speed control via MQTT commands |
| 📡 Real-time telemetry | Device state updates are streamed back to the dashboard in JSON |
| ☁️ Cloud-first design | Browser dashboard runs on Vercel while the NodeMCU handles local hardware tasks |
| 🛡️ Security-minded setup | Uses restricted MQTT credentials and avoids hardcoded secrets in public code |

---

## 🧩 Hardware Pin Mapping Reference

| Function | Pin Name | Hardware / Module | Behavior / State |
| :--- | :--- | :--- | :--- |
| **Built-in LED** | `LED_BUILTIN` | NodeMCU On-board LED | **Active LOW** (`LOW` = ON, `HIGH` = OFF) |
| **External LED** | `D2` (`GPIO4`) | External LED circuit | **Active HIGH** (`HIGH` = ON, `LOW` = OFF) |
| **LDR Sensor** | `D5` (`GPIO14`) | Digital Light Dependent Resistor | `HIGH` = **DARK**, `LOW` = **BRIGHT** |
| **DC Motor PWM** | `D6` (`GPIO12`) | L298N Driver **ENA** | Speed range: `0` to `1023` |
| **DC Motor IN1** | `D7` (`GPIO13)` | L298N Driver **IN1** | Direction control |
| **DC Motor IN2** | `D1` (`GPIO5`) | L298N Driver **IN2** | Direction control |

> ⚠️ Safety warning: ensure external DC motors use a dedicated battery or external power source with a common ground connected to the ESP8266 `GND`.

---

## ⚙️ MQTT Communication Reference

### Broker connection parameters

- **Host:** `zadd17f0.ala.us-east-1.emqxsl.com`
- **Protocol:** `WSS` (WebSocket Secure)
- **Port:** `8084`
- **Path:** `/mqtt`
- **Client ID:** Unique randomized string (`miot-web-xxxxxxxx`)

### MQTT topics

- **Command topic (publish):** `miot/home01/command`
- **Status topic (subscribe):** `miot/home01/status`

### Actuator commands

| Command String | Description |
| :--- | :--- |
| `led/on` | Turns on both built-in and external LEDs |
| `led/off` | Turns off both LEDs |
| `mode/auto` | Switches to automatic mode |
| `mode/manual` | Disables automatic LDR-based control |
| `motor/on` | Starts the DC motor |
| `motor/off` | Stops the motor |
| `motor/forward` | Sets motor direction to forward |
| `motor/reverse` | Sets motor direction to reverse |
| `motor/speed/<value>` | Sets PWM speed (`0` to `1023`) |
| `status/request` | Requests an immediate status packet |

### Example status payload

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

---

## 🛠️ Quick Start

### Option A: Local browser testing

```powershell
npm run dev
```

or

```powershell
npx serve -l 3000
```

Then open your browser to <http://localhost:3000>.

### Option B: Python server

```bash
python -m http.server 3000
```

Then open <http://localhost:3000>.

### Option C: VS Code Live Server

Right-click `index.html` in VS Code and select **Open with Live Server**.

---

## 🔐 Configuring MQTT Credentials

For security, the project ships with placeholder credentials so real secrets are never accidentally committed or deployed publicly.

### Recommended method: use the dashboard settings dialog

1. Open the dashboard in your browser.
2. Click **Settings**.
3. Enter your EMQX username and password.
4. Click **Save & Connect**.
5. Credentials are stored only in the browser's private `localStorage`.

### Private local configuration

Open `js/config.js` and edit:

```javascript
username: "YOUR_EMQX_USERNAME",
password: "YOUR_EMQX_PASSWORD",
```

---

## 🧪 Verification and Troubleshooting

| Symptom | Likely Cause | Suggested Fix |
| :--- | :--- | :--- |
| **Credentials required** banner | Placeholder values in browser storage | Re-enter valid MQTT credentials |
| **MQTT offline / connection error** | Wrong WSS port or firewall issue | Verify port `8084` and `/mqtt` path |
| **Publish failed: Not authorized** | ACL is blocking command topic | Confirm ACL allows `miot/home01/command` |
| **Status stays “Awaiting Status”** | ESP8266 is disconnected from Wi-Fi or broker | Check serial logs and network connectivity |
| **Motor does not spin** | Motor supply or ground issue | Verify shared ground and L298N power input |
| **Malformed JSON in log** | Firmware prints non-JSON text | Ensure only valid JSON is published |

---

## 🧱 Project Structure

```text
MIOT_PROJECT/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── config.js
│   └── mqtt.js
├── assets/
│   └── images/
├── README.md
├── .gitignore
└── package.json
```

> The exact project layout may vary, but the core idea remains the same: a browser-based control dashboard connected to EMQX over WebSockets.

---

## 🚢 Deploying to Vercel

The dashboard is structured as a static website, which makes Vercel deployment simple.

### Beginner-friendly steps

1. Push the project to a private GitHub repository.
2. Open [vercel.com](https://vercel.com).
3. Select **Add New Project** > **Import Git Repository**.
4. Choose your repository.
5. Leave the framework setting as **Other** and keep the build command empty.
6. Click **Deploy**.
7. Open the deployment URL and configure MQTT credentials in the dashboard.

---

## 🧯 Security Best Practices

- Keep MQTT credentials out of public source code.
- Use a dedicated broker account for the dashboard.
- Restrict publish permissions to `miot/home01/command`.
- Restrict subscribe permissions to `miot/home01/status`.
- Avoid putting admin credentials into browser-side JavaScript.
- Prefer a backend or short-lived auth flow for public deployments.

---

## 🧠 Why this project matters

This system demonstrates how a browser UI can safely and cleanly control hardware through MQTT. It combines cloud messaging, hardware automation, and real-time telemetry into a practical, teachable IoT application using ESP8266 and EMQX Cloud.

---

## 📜 License

Add the project's chosen license here before distributing the source code publicly.

---

## 👨‍💻 Author

**Project:** MIOT Home Automation System  
**Controller:** ESP8266 NodeMCU  
**Messaging:** MQTT with EMQX Cloud  
**Dashboard:** Web-based interface hosted on Vercel

---

<div align="center">
  <img src="https://img.shields.io/badge/Designed%20for-IoT%20Automation-8B5CF6?style=for-the-badge" alt="Design" />
  <img src="https://img.shields.io/badge/Cloud%20Control-Remote%20MQTT-06B6D4?style=for-the-badge" alt="Cloud Control" />
</div>
