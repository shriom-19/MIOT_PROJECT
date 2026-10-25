#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>

// =====================================================
// 1. WIFI NETWORK CONFIGURATION
// =====================================================

struct WiFiNetwork {
  const char* ssid;
  const char* password;
};

WiFiNetwork networks[] = {
  {"OnePlus Nord CE 3 Lite 5G", "5G82610992"},
  {"moto g(40) fusion_8568", "tanayshinde"},
  {"OnePlus", "huanabi0"},
  {"Swarup", "96572030"}
};

const int NETWORK_COUNT =
  sizeof(networks) / sizeof(networks[0]);

ESP8266WebServer server(80);

// =====================================================
// 2. EMQX CLOUD MQTT CONFIGURATION
// =====================================================

const char* MQTT_HOST =
  "zadd17f0.ala.us-east-1.emqxsl.com";

const uint16_t MQTT_PORT = 8883;

// REPLACE WITH YOUR ACTUAL EMQX CREDENTIALS
const char* MQTT_USERNAME = "MIOT";
const char* MQTT_PASSWORD = "MIOTMINIPROJECT";

// MQTT topics
const char* MQTT_COMMAND_TOPIC =
  "miot/home01/command";

const char* MQTT_STATUS_TOPIC =
  "miot/home01/status";

// =====================================================
// 3. EMQX CA CERTIFICATE
// =====================================================

// Paste the complete CA certificate downloaded for
// your EMQX deployment. Keep both certificate markers.

static const char CA_CERT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----
)EOF";

// Keep the certificate object alive globally.
BearSSL::X509List caCertificate(CA_CERT);

BearSSL::WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);

unsigned long lastWiFiAttempt = 0;
unsigned long lastMqttAttempt = 0;
unsigned long lastStatusPublish = 0;

const unsigned long WIFI_RETRY_INTERVAL = 30000;
const unsigned long MQTT_RETRY_INTERVAL = 5000;
const unsigned long STATUS_PUBLISH_INTERVAL = 2000;

// =====================================================
// 4. PIN CONFIGURATION
// =====================================================

const int BUILTIN_LED_PIN = LED_BUILTIN;
const int EXTERNAL_LED_PIN = D2;
const int LDR_PIN = D5;

// L298N motor driver
const int MOTOR_ENA = D6;
const int MOTOR_IN1 = D7;
const int MOTOR_IN2 = D1;

// =====================================================
// 5. DEVICE STATES
// =====================================================

bool ledOn = false;
bool autoMode = false;

bool motorOn = false;
bool motorReverse = false;

int motorSpeed = 700;

String lightStatus = "UNKNOWN";

// =====================================================
// 6. FUNCTION DECLARATIONS
// =====================================================

bool connectToWiFi();
bool synchronizeClock();
bool connectMQTT();

void mqttCallback(
  char* topic,
  byte* payload,
  unsigned int length
);

void setLeds(bool state);
void stopMotor();
void runMotor();
void setMotorSpeed(int value);

String getLightStatus();
String makeStatusJson();

void publishStatus();
void configureRoutes();
void handleStatus();

// =====================================================
// 7. WIFI CONNECTION
// =====================================================

bool connectToWiFi() {

  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  for (int i = 0; i < NETWORK_COUNT; i++) {

    Serial.println();
    Serial.print("Trying hotspot: ");
    Serial.println(networks[i].ssid);

    WiFi.disconnect();
    delay(300);

    WiFi.begin(
      networks[i].ssid,
      networks[i].password
    );

    unsigned long startTime = millis();

    while (
      WiFi.status() != WL_CONNECTED &&
      millis() - startTime < 12000
    ) {
      delay(250);
      Serial.print(".");
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {

      Serial.println("Wi-Fi connected!");

      Serial.print("Connected hotspot: ");
      Serial.println(WiFi.SSID());

      Serial.print("IP address: ");
      Serial.println(WiFi.localIP());

      Serial.println("Dashboard is ready.");

      return true;
    }

    Serial.println(
      "Connection failed. Trying next hotspot..."
    );
  }

  Serial.println(
    "No saved hotspot is currently available."
  );

  return false;
}

// =====================================================
// 8. LED CONTROL
// =====================================================

void setLeds(bool state) {

  ledOn = state;

  // Built-in LED is active LOW.
  digitalWrite(
    BUILTIN_LED_PIN,
    state ? LOW : HIGH
  );

  // External LED is active HIGH.
  digitalWrite(
    EXTERNAL_LED_PIN,
    state ? HIGH : LOW
  );
}

// =====================================================
// 9. MOTOR CONTROL
// =====================================================

void stopMotor() {

  motorOn = false;

  analogWrite(MOTOR_ENA, 0);

  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
}

void runMotor() {

  if (!motorOn || motorSpeed == 0) {

    analogWrite(MOTOR_ENA, 0);
    return;
  }

  if (motorReverse) {

    digitalWrite(MOTOR_IN1, LOW);
    digitalWrite(MOTOR_IN2, HIGH);

  } else {

    digitalWrite(MOTOR_IN1, HIGH);
    digitalWrite(MOTOR_IN2, LOW);
  }

  analogWrite(MOTOR_ENA, motorSpeed);
}

void setMotorSpeed(int value) {

  motorSpeed = constrain(value, 0, 1023);

  if (motorOn) {
    runMotor();
  }
}

// =====================================================
// 10. LDR SENSOR
// =====================================================

String getLightStatus() {

  int sensorValue = digitalRead(LDR_PIN);

  // Based on your tested LDR module:
  // HIGH = DARK
  // LOW  = BRIGHT

  return sensorValue == HIGH ? "DARK" : "BRIGHT";
}

// =====================================================
// 11. BUILD DEVICE STATUS JSON
// =====================================================

String makeStatusJson() {

  String json = "{";

  json += "\"device\":\"esp8266-home01\",";

  json += "\"wifi\":";
  json += (
    WiFi.status() == WL_CONNECTED
    ? "true"
    : "false"
  );

  json += ",\"ssid\":\"";

  if (WiFi.status() == WL_CONNECTED) {
    json += WiFi.SSID();
  } else {
    json += "Not connected";
  }

  json += "\"";

  json += ",\"ip\":\"";
  json += WiFi.localIP().toString();
  json += "\"";

  json += ",\"led\":";
  json += ledOn ? "true" : "false";

  json += ",\"light\":\"";
  json += lightStatus;
  json += "\"";

  json += ",\"mode\":\"";
  json += autoMode ? "AUTO" : "MANUAL";
  json += "\"";

  json += ",\"motor\":";
  json += motorOn ? "true" : "false";

  json += ",\"direction\":\"";
  json += motorReverse ? "REVERSE" : "FORWARD";
  json += "\"";

  json += ",\"speed\":";
  json += String(motorSpeed);

  json += "}";

  return json;
}

// =====================================================
// 12. PUBLISH STATUS TO EMQX
// =====================================================

void publishStatus() {

  if (!mqttClient.connected()) {
    return;
  }

  String payload = makeStatusJson();

  bool published = mqttClient.publish(
    MQTT_STATUS_TOPIC,
    payload.c_str(),
    true
  );

  if (published) {
    lastStatusPublish = millis();
  } else {
    Serial.println("MQTT status publish failed.");
  }
}

// =====================================================
// 13. MQTT COMMAND CALLBACK
// =====================================================

void mqttCallback(
  char* topic,
  byte* payload,
  unsigned int length
) {

  String command;

  for (unsigned int i = 0; i < length; i++) {
    command += (char)payload[i];
  }

  command.trim();

  Serial.println();
  Serial.println("========== MQTT COMMAND ==========");

  Serial.print("Topic: ");
  Serial.println(topic);

  Serial.print("Command: ");
  Serial.println(command);

  // -----------------------------------------------
  // LED COMMANDS
  // -----------------------------------------------

  if (command == "led/on" || command == "/on") {

    autoMode = false;
    setLeds(true);

  } else if (
    command == "led/off" ||
    command == "/off"
  ) {

    autoMode = false;
    setLeds(false);

  }

  // -----------------------------------------------
  // LIGHT SENSOR MODES
  // -----------------------------------------------

  else if (
    command == "mode/auto" ||
    command == "/auto"
  ) {

    autoMode = true;

  } else if (
    command == "mode/manual" ||
    command == "/manual"
  ) {

    autoMode = false;

  }

  // -----------------------------------------------
  // MOTOR COMMANDS
  // -----------------------------------------------

  else if (
    command == "motor/on" ||
    command == "/motor/on"
  ) {

    motorOn = true;
    runMotor();

  } else if (
    command == "motor/off" ||
    command == "/motor/off"
  ) {

    stopMotor();

  } else if (
    command == "motor/forward" ||
    command == "/motor/forward"
  ) {

    motorReverse = false;

    if (motorOn) {
      runMotor();
    }

  } else if (
    command == "motor/reverse" ||
    command == "/motor/reverse"
  ) {

    motorReverse = true;

    if (motorOn) {
      runMotor();
    }

  }

  // -----------------------------------------------
  // MOTOR SPEED
  // -----------------------------------------------

  else if (command.startsWith("motor/speed/")) {

    String valueString =
      command.substring(strlen("motor/speed/"));

    setMotorSpeed(valueString.toInt());

  } else if (
    command.startsWith("/motor/speed?value=")
  ) {

    String valueString =
      command.substring(strlen("/motor/speed?value="));

    setMotorSpeed(valueString.toInt());

  } else {

    Serial.println("Unknown command ignored.");
  }

  // Publish updated device status.
  publishStatus();

  Serial.println("==================================");
}

// =====================================================
// 14. SYNCHRONIZE CLOCK FOR TLS
// =====================================================

bool synchronizeClock() {

  configTime(
    0,
    0,
    "pool.ntp.org",
    "time.nist.gov"
  );

  Serial.print("Synchronizing clock");

  unsigned long startTime = millis();

  while (
    time(nullptr) < 1700000000 &&
    millis() - startTime < 30000
  ) {

    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (time(nullptr) < 1700000000) {

    Serial.println("Clock synchronization failed.");

    return false;
  }

  Serial.println("Clock synchronized successfully.");

  return true;
}

// =====================================================
// 15. CONNECT TO EMQX CLOUD
// =====================================================

bool connectMQTT() {

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  // Certificate verification is enabled.
  secureClient.setTrustAnchors(&caCertificate);
  secureClient.setTimeout(15000);

  mqttClient.setServer(
    MQTT_HOST,
    MQTT_PORT
  );

  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(15);

  String clientId =
    "miot-esp8266-" +
    String(ESP.getChipId(), HEX);

  Serial.println();
  Serial.print("Connecting to EMQX Cloud... ");

  bool connected = mqttClient.connect(
    clientId.c_str(),
    MQTT_USERNAME,
    MQTT_PASSWORD
  );

  if (!connected) {

    Serial.print("FAILED. MQTT state: ");
    Serial.println(mqttClient.state());

    char errorBuffer[160] = {0};

    if (
      secureClient.getLastSSLError(
        errorBuffer,
        sizeof(errorBuffer)
      )
    ) {

      Serial.print("TLS error: ");
      Serial.println(errorBuffer);
    }

    return false;
  }

  Serial.println("CONNECTED");

  bool subscribed = mqttClient.subscribe(
    MQTT_COMMAND_TOPIC,
    1
  );

  Serial.print("Command subscription: ");
  Serial.println(
    subscribed ? "SUCCESS" : "FAILED"
  );

  if (!subscribed) {
    mqttClient.disconnect();
    return false;
  }

  publishStatus();

  return true;
}

// =====================================================
// 16. LOCAL DASHBOARD HTML
// =====================================================

const char DASHBOARD_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
>

<title>ESP8266 Home Automation</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 20px;
  font-family: Arial, Helvetica, sans-serif;
  background: #101827;
  color: #f1f5f9;
}

.container {
  max-width: 900px;
  margin: auto;
}

h1 {
  text-align: center;
  color: #60a5fa;
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  color: #94a3b8;
  margin-bottom: 28px;
}

.grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.card {
  background: #1e293b;
  padding: 20px;
  border-radius: 14px;
  border: 1px solid #334155;
}

.card h2 {
  margin-top: 0;
  font-size: 20px;
  color: #e2e8f0;
}

.status {
  color: #93c5fd;
  font-weight: bold;
  overflow-wrap: anywhere;
}

button {
  border: none;
  padding: 12px 14px;
  margin: 5px 2px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  color: white;
  background: #2563eb;
}

button:hover {
  opacity: 0.85;
}

button.off {
  background: #475569;
}

button.stop {
  background: #dc2626;
}

button.auto {
  background: #059669;
}

input[type=range] {
  width: 100%;
  margin: 12px 0;
  cursor: pointer;
}

.footer {
  text-align: center;
  margin-top: 25px;
  color: #94a3b8;
  font-size: 13px;
}

hr {
  border: 0;
  border-top: 1px solid #334155;
  margin: 16px 0;
}

@media (max-width: 480px) {

  body {
    padding: 12px;
  }

  .card {
    padding: 16px;
  }

  button {
    padding: 12px 10px;
  }
}

</style>
</head>

<body>

<div class="container">

<h1>Home Automation</h1>

<p class="subtitle">
ESP8266 Smart Control Dashboard
</p>

<div class="grid">

  <div class="card">

    <h2>LED Control</h2>

    <p>
      Status:
      <span id="ledStatus" class="status">Loading...</span>
    </p>

    <button onclick="sendCommand('/on')">
      LED ON
    </button>

    <button
      class="off"
      onclick="sendCommand('/off')"
    >
      LED OFF
    </button>

  </div>

  <div class="card">

    <h2>Light Sensor</h2>

    <p>
      Environment:
      <span id="lightStatus" class="status">
        Loading...
      </span>
    </p>

    <p>
      Mode:
      <span id="modeStatus" class="status">
        Loading...
      </span>
    </p>

    <hr>

    <button
      class="auto"
      onclick="sendCommand('/auto')"
    >
      AUTO MODE
    </button>

    <button
      class="off"
      onclick="sendCommand('/manual')"
    >
      MANUAL MODE
    </button>

  </div>

  <div class="card">

    <h2>DC Motor</h2>

    <p>
      Status:
      <span id="motorStatus" class="status">
        Loading...
      </span>
    </p>

    <p>
      Direction:
      <span id="directionStatus" class="status">
        FORWARD
      </span>
    </p>

    <button onclick="sendCommand('/motor/on')">
      MOTOR ON
    </button>

    <button
      class="stop"
      onclick="sendCommand('/motor/off')"
    >
      MOTOR STOP
    </button>

    <hr>

    <button
      class="off"
      onclick="sendCommand('/motor/forward')"
    >
      FORWARD
    </button>

    <button
      class="off"
      onclick="sendCommand('/motor/reverse')"
    >
      REVERSE
    </button>

    <hr>

    <p>
      Motor Speed:
      <span id="speedValue">700</span>/1023
    </p>

    <input
      type="range"
      id="speedSlider"
      min="0"
      max="1023"
      value="700"
      oninput="
        document.getElementById('speedValue').innerText=this.value
      "
      onchange="
        sendCommand('/motor/speed?value='+this.value)
      "
    >

  </div>

  <div class="card">

    <h2>Device Information</h2>

    <p>
      Wi-Fi:
      <span id="wifiStatus" class="status">
        Loading...
      </span>
    </p>

    <p>
      Hotspot:
      <span id="hotspotStatus" class="status">
        Loading...
      </span>
    </p>

    <p>
      IP Address:
      <span id="ipStatus" class="status">
        Loading...
      </span>
    </p>

    <p>
      Controller:
      <span class="status">ESP8266 NodeMCU</span>
    </p>

  </div>

</div>

<p class="footer">
ESP8266 Home Automation System
</p>

</div>

<script>

async function sendCommand(path) {

  try {

    const response = await fetch(path, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Request failed');
    }

    await updateStatus();

  } catch (error) {

    alert(
      'Cannot reach ESP8266. Check the Wi-Fi connection.'
    );
  }
}

async function updateStatus() {

  try {

    const response = await fetch('/status', {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Status request failed');
    }

    const data = await response.json();

    document.getElementById('ledStatus').innerText =
      data.led ? 'ON' : 'OFF';

    document.getElementById('lightStatus').innerText =
      data.light;

    document.getElementById('modeStatus').innerText =
      data.mode;

    document.getElementById('motorStatus').innerText =
      data.motor ? 'ON' : 'OFF';

    document.getElementById('directionStatus').innerText =
      data.direction;

    document.getElementById('speedValue').innerText =
      data.speed;

    document.getElementById('speedSlider').value =
      data.speed;

    document.getElementById('wifiStatus').innerText =
      data.wifi ? 'CONNECTED' : 'DISCONNECTED';

    document.getElementById('hotspotStatus').innerText =
      data.ssid;

    document.getElementById('ipStatus').innerText =
      data.ip;

  } catch (error) {

    console.log('Status update failed:', error);
  }
}

updateStatus();

setInterval(updateStatus, 2000);

</script>

</body>
</html>
)rawliteral";

// =====================================================
// 17. LOCAL STATUS API
// =====================================================

void handleStatus() {

  String json = makeStatusJson();

  server.sendHeader(
    "Cache-Control",
    "no-store"
  );

  server.send(
    200,
    "application/json",
    json
  );
}

// =====================================================
// 18. LOCAL WEB SERVER ROUTES
// =====================================================

void configureRoutes() {

  server.on("/", HTTP_GET, []() {

    server.sendHeader(
      "Cache-Control",
      "no-cache"
    );

    server.send_P(
      200,
      "text/html; charset=UTF-8",
      DASHBOARD_HTML
    );
  });

  server.on("/on", HTTP_GET, []() {

    autoMode = false;
    setLeds(true);

    publishStatus();

    server.send(
      200,
      "text/plain",
      "LEDs ON"
    );
  });

  server.on("/off", HTTP_GET, []() {

    autoMode = false;
    setLeds(false);

    publishStatus();

    server.send(
      200,
      "text/plain",
      "LEDs OFF"
    );
  });

  server.on("/auto", HTTP_GET, []() {

    autoMode = true;

    publishStatus();

    server.send(
      200,
      "text/plain",
      "AUTO MODE"
    );
  });

  server.on("/manual", HTTP_GET, []() {

    autoMode = false;

    publishStatus();

    server.send(
      200,
      "text/plain",
      "MANUAL MODE"
    );
  });

  server.on("/motor/on", HTTP_GET, []() {

    motorOn = true;
    runMotor();

    publishStatus();

    server.send(
      200,
      "text/plain",
      "MOTOR ON"
    );
  });

  server.on("/motor/off", HTTP_GET, []() {

    stopMotor();

    publishStatus();

    server.send(
      200,
      "text/plain",
      "MOTOR STOPPED"
    );
  });

  server.on("/motor/forward", HTTP_GET, []() {

    motorReverse = false;

    if (motorOn) {
      runMotor();
    }

    publishStatus();

    server.send(
      200,
      "text/plain",
      "FORWARD"
    );
  });

  server.on("/motor/reverse", HTTP_GET, []() {

    motorReverse = true;

    if (motorOn) {
      runMotor();
    }

    publishStatus();

    server.send(
      200,
      "text/plain",
      "REVERSE"
    );
  });

  server.on("/motor/speed", HTTP_GET, []() {

    if (server.hasArg("value")) {

      setMotorSpeed(
        server.arg("value").toInt()
      );
    }

    publishStatus();

    server.send(
      200,
      "text/plain",
      "SPEED UPDATED"
    );
  });

  server.on("/status", HTTP_GET, handleStatus);

  server.onNotFound([]() {

    server.send(
      404,
      "text/plain",
      "Not found"
    );
  });
}

// =====================================================
// 19. SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(500);

  Serial.println();
  Serial.println("====================================");
  Serial.println("ESP8266 HOME AUTOMATION + MQTT");
  Serial.println("====================================");

  // Configure hardware pins.
  pinMode(BUILTIN_LED_PIN, OUTPUT);
  pinMode(EXTERNAL_LED_PIN, OUTPUT);
  pinMode(LDR_PIN, INPUT);

  pinMode(MOTOR_ENA, OUTPUT);
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);

  // Configure PWM.
  analogWriteRange(1023);
  analogWriteFreq(1000);

  // Safe initial output states.
  setLeds(false);
  stopMotor();

  // Start the local HTTP dashboard.
  configureRoutes();
  server.begin();

  Serial.println("Local HTTP server started.");

  // Connect to one of the saved Wi-Fi networks.
  bool wifiConnected = connectToWiFi();

  lastWiFiAttempt = millis();

  if (wifiConnected) {

    // Synchronize time before TLS verification.
    if (synchronizeClock()) {

      // Configure MQTT TLS verification.
      secureClient.setTrustAnchors(&caCertificate);

      mqttClient.setServer(
        MQTT_HOST,
        MQTT_PORT
      );

      mqttClient.setCallback(mqttCallback);
      mqttClient.setBufferSize(512);
      mqttClient.setKeepAlive(30);
      mqttClient.setSocketTimeout(15);

      if (connectMQTT()) {

        Serial.println("MQTT initialization successful.");

      } else {

        Serial.println(
          "MQTT unavailable. Local dashboard remains available."
        );
      }

    } else {

      Serial.println(
        "Time synchronization failed. MQTT TLS is not connected."
      );
    }
  }

  Serial.println();
  Serial.println("Setup complete.");
}

// =====================================================
// 20. MAIN LOOP
// =====================================================

void loop() {

  // Process local dashboard requests.
  server.handleClient();

  // Update LDR status.
  lightStatus = getLightStatus();

  // Automatic lighting:
  // DARK = LEDs ON
  // BRIGHT = LEDs OFF

  if (autoMode) {

    bool isDark =
      (digitalRead(LDR_PIN) == HIGH);

    bool desiredLedState = isDark;

    if (ledOn != desiredLedState) {

      setLeds(desiredLedState);

      publishStatus();
    }
  }

  // ---------------------------------------------------
  // WIFI RECONNECTION
  // ---------------------------------------------------

  if (
    WiFi.status() != WL_CONNECTED &&
    millis() - lastWiFiAttempt >= WIFI_RETRY_INTERVAL
  ) {

    lastWiFiAttempt = millis();

    Serial.println(
      "Wi-Fi disconnected. Retrying saved networks..."
    );

    connectToWiFi();
  }

  // ---------------------------------------------------
  // MQTT CONNECTION MANAGEMENT
  // ---------------------------------------------------

  if (WiFi.status() == WL_CONNECTED) {

    if (!mqttClient.connected()) {

      if (
        millis() - lastMqttAttempt >= MQTT_RETRY_INTERVAL
      ) {

        lastMqttAttempt = millis();

        // Ensure the clock is valid before TLS connection.
        if (time(nullptr) < 1700000000) {

          synchronizeClock();
        }

        if (time(nullptr) >= 1700000000) {

          connectMQTT();
        }
      }

    } else {

      // Process incoming MQTT commands.
      mqttClient.loop();

      // Publish status periodically.
      if (
        millis() - lastStatusPublish >=
        STATUS_PUBLISH_INTERVAL
      ) {

        publishStatus();
      }
    }
  }

  delay(10);
}