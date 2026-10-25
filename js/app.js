/**
 * MIOT Home Automation - Web Client Application
 * 
 * Provides robust remote telemetry, device monitoring, and actuator control
 * for ESP8266 via EMQX Cloud MQTT over Secure WebSockets (WSS).
 */

(function () {
  'use strict';

  // Storage key for local browser credentials
  const STORAGE_KEY = 'miot_mqtt_settings_v1';

  // State Management
  let mqttClient = null;
  let activeConfig = {};
  let deviceLastSeenAt = 0;
  let speedDebounceTimer = null;
  let watchdogTimer = null;
  let logEntries = [];
  let currentLogFilter = 'all';

  // DOM Helper
  const $ = (id) => document.getElementById(id);

  /**
   * Load active configuration from localStorage or default config
   */
  function loadConfiguration() {
    const defaults = window.DEFAULT_MQTT_CONFIG || {
      host: "zadd17f0.ala.us-east-1.emqxsl.com",
      port: 8084,
      path: "/mqtt",
      username: "REPLACE_WITH_EMQX_USERNAME",
      password: "REPLACE_WITH_EMQX_PASSWORD",
      commandTopic: "miot/home01/command",
      statusTopic: "miot/home01/status",
      clientPrefix: "miot-web-",
      heartbeatTimeoutMs: 20000,
      offlineTimeoutMs: 45000
    };

    let stored = null;
    try {
      const item = localStorage.getItem(STORAGE_KEY);
      if (item) {
        stored = JSON.parse(item);
      }
    } catch (e) {
      console.warn("Could not read localStorage for MQTT settings:", e);
    }

    activeConfig = Object.assign({}, defaults, stored || {});
  }

  /**
   * Check if username and password have been set
   */
  function hasValidCredentials() {
    return (
      activeConfig.username &&
      activeConfig.password &&
      !activeConfig.username.startsWith("REPLACE_") &&
      !activeConfig.password.startsWith("REPLACE_") &&
      activeConfig.username.trim() !== "" &&
      activeConfig.password.trim() !== ""
    );
  }

  /**
   * Log entry with categories: 'cmd', 'status', 'conn', 'err', 'info'
   */
  function logEvent(type, message) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const entry = {
      id: Date.now() + Math.random(),
      time: timeStr,
      type: type,
      message: message
    };

    logEntries.unshift(entry);
    if (logEntries.length > 100) {
      logEntries.pop();
    }

    renderLog();
  }

  /**
   * Render filtered activity log in DOM
   */
  function renderLog() {
    const logBox = $('activityLog');
    const counter = $('logCounter');
    if (!logBox) return;

    const filtered = logEntries.filter(entry => {
      if (currentLogFilter === 'all') return true;
      if (currentLogFilter === 'cmd') return entry.type === 'cmd';
      if (currentLogFilter === 'status') return entry.type === 'status';
      if (currentLogFilter === 'conn') return entry.type === 'conn' || entry.type === 'err';
      return true;
    });

    if (counter) {
      counter.textContent = `${logEntries.length} event${logEntries.length === 1 ? '' : 's'} recorded`;
    }

    if (filtered.length === 0) {
      logBox.textContent = logEntries.length === 0 
        ? "Activity log initialized. Awaiting events..." 
        : `No events matching '${currentLogFilter}' filter.`;
      return;
    }

    const html = filtered.map(item => {
      let tagClass = 'log-tag-conn';
      let tagText = 'SYS';
      if (item.type === 'cmd') {
        tagClass = 'log-tag-cmd';
        tagText = 'CMD';
      } else if (item.type === 'status') {
        tagClass = 'log-tag-status';
        tagText = 'STAT';
      } else if (item.type === 'err') {
        tagClass = 'log-tag-err';
        tagText = 'ERR';
      } else if (item.type === 'conn') {
        tagClass = 'log-tag-conn';
        tagText = 'MQTT';
      }

      return `<span class="log-line"><span class="log-time">[${item.time}]</span> <span class="${tagClass}">[${tagText}]</span> ${escapeHtml(item.message)}</span>`;
    }).join('\n');

    logBox.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Update MQTT Connection UI Indicators
   */
  function setMqttConnectionState(state, message) {
    const dot = $('connectionDot');
    const text = $('connectionText');
    const mqttVal = $('mqttStatus');

    if (dot) {
      dot.className = 'dot';
      if (state === 'connected') dot.classList.add('online');
      else if (state === 'connecting' || state === 'reconnecting') dot.classList.add('standby');
      else if (state === 'error') dot.classList.add('error');
    }

    if (text) text.textContent = message;

    if (mqttVal) {
      if (state === 'connected') {
        mqttVal.textContent = 'Connected (WSS)';
        mqttVal.style.color = 'var(--green)';
      } else if (state === 'connecting') {
        mqttVal.textContent = 'Connecting...';
        mqttVal.style.color = 'var(--amber)';
      } else if (state === 'reconnecting') {
        mqttVal.textContent = 'Reconnecting...';
        mqttVal.style.color = 'var(--amber)';
      } else {
        mqttVal.textContent = 'Disconnected';
        mqttVal.style.color = 'var(--red)';
      }
    }
  }

  /**
   * Update Pill Badge Helper
   */
  function setPill(id, text, kind) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'pill' + (kind ? ' ' + kind : '');
  }

  /**
   * Publish command string to MQTT command topic
   */
  function publishCommand(command) {
    if (!mqttClient || !mqttClient.connected) {
      logEvent('err', `Command canceled (MQTT disconnected): ${command}`);
      alert("Cannot send command: Dashboard is not connected to EMQX. Please verify broker settings or credentials.");
      return;
    }

    // Actuator commands should have QoS 1 and NOT be retained
    mqttClient.publish(activeConfig.commandTopic, command, { qos: 1, retain: false }, (error) => {
      if (error) {
        logEvent('err', `Publish failed for '${command}': ${error.message}`);
      } else {
        logEvent('cmd', `Published to ${activeConfig.commandTopic}: ${command}`);
      }
    });
  }

  /**
   * Connect to EMQX Cloud via WSS
   */
  function connectMqtt() {
    if (!window.mqtt) {
      setMqttConnectionState('error', 'MQTT.js library not loaded');
      logEvent('err', 'MQTT.js client library failed to load. Check network access.');
      return;
    }

    const hasCreds = hasValidCredentials();
    const configWarning = $('configWarning');
    if (configWarning) {
      if (hasCreds) {
        configWarning.classList.remove('show');
      } else {
        configWarning.classList.add('show');
      }
    }

    if (!hasCreds) {
      setMqttConnectionState('standby', 'Credentials required');
      logEvent('conn', 'Broker credentials not configured. Open Settings or edit config.js to begin.');
      return;
    }

    // Clean up existing client before reconnecting
    if (mqttClient) {
      try {
        mqttClient.end(true);
      } catch (e) {
        console.warn("Client close error:", e);
      }
    }

    const clientId = (activeConfig.clientPrefix || 'miot-web-') + Math.random().toString(16).slice(2, 10);
    const url = `wss://${activeConfig.host}:${activeConfig.port}${activeConfig.path}`;

    setMqttConnectionState('connecting', 'Connecting...');
    logEvent('conn', `Connecting to ${activeConfig.host}:${activeConfig.port}${activeConfig.path} (Client: ${clientId})...`);

    try {
      mqttClient = mqtt.connect(url, {
        clientId: clientId,
        username: activeConfig.username,
        password: activeConfig.password,
        clean: true,
        connectTimeout: 12000,
        reconnectPeriod: 4000,
        keepalive: 30,
        protocolVersion: 4
      });

      mqttClient.on('connect', () => {
        setMqttConnectionState('connected', 'Connected');
        logEvent('conn', `Connected successfully to EMQX broker via secure WebSockets.`);

        // Subscribe to status topic
        mqttClient.subscribe(activeConfig.statusTopic, { qos: 1 }, (err, granted) => {
          if (err) {
            logEvent('err', `Failed to subscribe to ${activeConfig.statusTopic}: ${err.message}`);
          } else {
            const qos = granted && granted[0] ? granted[0].qos : 1;
            logEvent('conn', `Subscribed to status topic: ${activeConfig.statusTopic} (QoS ${qos})`);
            
            // Request initial status packet (if supported by firmware)
            publishStatusRequest();
          }
        });
      });

      mqttClient.on('reconnect', () => {
        setMqttConnectionState('reconnecting', 'Reconnecting...');
        logEvent('conn', 'Connection lost; reconnecting to broker...');
      });

      mqttClient.on('offline', () => {
        setMqttConnectionState('error', 'Offline');
        logEvent('conn', 'MQTT client is offline.');
      });

      mqttClient.on('close', () => {
        setMqttConnectionState('error', 'Disconnected');
      });

      mqttClient.on('error', (err) => {
        setMqttConnectionState('error', 'Connection error');
        logEvent('err', `MQTT client error: ${err.message || err}`);
      });

      mqttClient.on('message', (topic, payload) => {
        const messageString = payload.toString();
        if (topic === activeConfig.statusTopic) {
          handleIncomingStatus(messageString);
        } else {
          logEvent('info', `Message on [${topic}]: ${messageString.slice(0, 100)}`);
        }
      });

    } catch (err) {
      setMqttConnectionState('error', 'Init error');
      logEvent('err', `Connection instantiation error: ${err.message}`);
    }
  }

  /**
   * Request status packet from firmware (firmware may optionally handle status/request)
   */
  function publishStatusRequest() {
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish(activeConfig.commandTopic, 'status/request', { qos: 1, retain: false });
      logEvent('cmd', `Sent status inquiry: 'status/request' to ${activeConfig.commandTopic}`);
    }
  }

  /**
   * Defensively parse and apply incoming ESP8266 status JSON
   */
  function handleIncomingStatus(rawPayload) {
    let data;
    try {
      data = JSON.parse(rawPayload);
    } catch (e) {
      logEvent('err', `Malformed status JSON payload: ${rawPayload.slice(0, 150)}`);
      return;
    }

    // Defensive check: ensure data is an object
    if (!data || typeof data !== 'object') {
      logEvent('err', `Status payload is not a valid JSON object.`);
      return;
    }

    deviceLastSeenAt = Date.now();
    updateHeartbeatUi();

    // 1. LED State
    if (data.led !== undefined) {
      const ledRaw = String(data.led).trim().toUpperCase();
      const isLedOn = (ledRaw === 'ON' || ledRaw === '1' || data.led === true);
      const displayLed = isLedOn ? 'ON' : 'OFF';

      if ($('lightingMetric')) $('lightingMetric').textContent = displayLed;
      if ($('ledStatus')) $('ledStatus').textContent = displayLed;
      setPill('ledPill', displayLed, isLedOn ? 'good' : '');

      const bulb = $('ledBulbVisual');
      if (bulb) {
        if (isLedOn) bulb.classList.add('active');
        else bulb.classList.remove('active');
      }

      const ledHeader = $('ledDisplayHeader');
      if (ledHeader) {
        ledHeader.textContent = isLedOn ? 'LEDs Active (Illuminated)' : 'LEDs Inactive (Off)';
      }
    }

    // 2. Light / LDR Environment
    if (data.light !== undefined) {
      const lightRaw = String(data.light).trim().toUpperCase();
      const isDark = (lightRaw === 'DARK' || lightRaw === 'HIGH' || lightRaw === '1');
      const isBright = (lightRaw === 'BRIGHT' || lightRaw === 'LOW' || lightRaw === '0');
      const lightText = isDark ? 'DARK' : (isBright ? 'BRIGHT' : lightRaw);

      if ($('environmentMetric')) $('environmentMetric').textContent = `Environment: ${lightText}`;
      if ($('lightStatus')) $('lightStatus').textContent = lightText;

      const visualBox = $('sensorVisualBox');
      const sensorLabel = $('sensorReadingLabel');
      if (visualBox) {
        visualBox.className = 'sensor-icon-box ' + (isDark ? 'dark-mode' : 'bright-mode');
        // Update SVG icon for dark/bright
        if (isDark) {
          visualBox.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>';
        } else {
          visualBox.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px;"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>';
        }
      }
      if (sensorLabel) {
        sensorLabel.textContent = `Environment: ${lightText}`;
      }
    }

    // 3. Control Mode (Auto / Manual)
    if (data.mode !== undefined) {
      const modeRaw = String(data.mode).trim().toUpperCase();
      const isAuto = (modeRaw === 'AUTO');
      const displayMode = isAuto ? 'AUTO' : 'MANUAL';

      if ($('modeMetric')) $('modeMetric').textContent = displayMode;
      setPill('modePill', displayMode, isAuto ? 'info' : 'warn');

      const autoSwitch = $('autoSwitch');
      if (autoSwitch) {
        autoSwitch.checked = isAuto;
      }
    }

    // 4. DC Motor State, Direction, and Speed
    let motorIsOn = false;
    if (data.motor !== undefined) {
      const motorRaw = String(data.motor).trim().toUpperCase();
      motorIsOn = (motorRaw === 'ON' || motorRaw === 'RUNNING' || motorRaw === '1' || data.motor === true);
      const displayMotor = motorIsOn ? 'RUNNING' : 'STOPPED';

      if ($('motorMetric')) $('motorMetric').textContent = displayMotor;
      if ($('motorStatus')) $('motorStatus').textContent = displayMotor;
      setPill('motorPill', displayMotor, motorIsOn ? 'good' : 'bad');

      const stateDisplay = $('motorStateDisplay');
      if (stateDisplay) {
        stateDisplay.textContent = motorIsOn ? 'Motor Running' : 'Motor Stopped';
      }
    }

    let motorDir = 'FORWARD';
    if (data.direction !== undefined) {
      motorDir = String(data.direction).trim().toUpperCase();
      if ($('directionStatus')) $('directionStatus').textContent = motorDir;
    }

    let currentSpeed = 700;
    if (data.speed !== undefined && !isNaN(Number(data.speed))) {
      currentSpeed = Math.max(0, Math.min(1023, Math.round(Number(data.speed))));
      const slider = $('speedSlider');
      const speedVal = $('speedValue');
      if (slider && document.activeElement !== slider) {
        slider.value = currentSpeed;
      }
      if (speedVal) speedVal.textContent = currentSpeed;

      const detail = $('motorDetail');
      if (detail) {
        detail.textContent = `${motorDir} @ ${currentSpeed} / 1023`;
      }
      const telemetry = $('motorSpeedTelemetry');
      if (telemetry) {
        telemetry.textContent = `${motorDir} · Speed: ${currentSpeed} / 1023`;
      }
    }

    // Update Motor Rotor Visual
    const rotor = $('motorRotorVisual');
    if (rotor) {
      rotor.className = 'motor-rotor';
      if (motorIsOn) {
        rotor.classList.add('running');
        if (motorDir.includes('REV')) {
          rotor.classList.add('reverse');
        } else {
          rotor.classList.add('forward');
        }
        // Calculate spin duration based on speed (min 0.3s, max 2.5s)
        const duration = Math.max(0.3, 2.5 - (currentSpeed / 1023) * 2.2);
        rotor.style.setProperty('--spin-duration', `${duration.toFixed(2)}s`);
      }
    }

    // 5. Wi-Fi and Network Parameters
    if (data.wifi !== undefined) {
      const wifiRaw = String(data.wifi).trim().toUpperCase();
      const isConnected = (wifiRaw === 'CONNECTED' || wifiRaw === 'ONLINE');
      if ($('wifiStatus')) $('wifiStatus').textContent = wifiRaw;
      setPill('wifiPill', wifiRaw, isConnected ? 'good' : 'bad');
    }

    if (data.ssid !== undefined && $('ssidStatus')) {
      $('ssidStatus').textContent = data.ssid || 'Not connected';
    }

    if (data.ip !== undefined && $('ipStatus')) {
      $('ipStatus').textContent = data.ip || 'Unknown';
    }

    if (data.device !== undefined && $('deviceTypeStatus')) {
      $('deviceTypeStatus').textContent = data.device;
    }

    logEvent('status', `Status update received from ${data.device || 'ESP8266'}: Motor=${data.motor || '-'}, LED=${data.led || '-'}, Mode=${data.mode || '-'}`);
  }

  /**
   * Watchdog timer: Inspect elapsed time since last status packet
   */
  function updateHeartbeatUi() {
    const devConn = $('deviceConnection');
    const lastSeen = $('lastSeen');
    const lastHeartbeat = $('lastHeartbeatStatus');
    const hbDot = $('nodeHeartbeatDot');
    const hbText = $('nodeHeartbeatText');

    if (!deviceLastSeenAt) {
      if (devConn) {
        devConn.textContent = 'Awaiting Status';
        devConn.style.color = 'var(--text-muted)';
      }
      if (lastSeen) lastSeen.textContent = 'Waiting for initial status packet';
      if (lastHeartbeat) lastHeartbeat.textContent = 'Never';
      if (hbDot) hbDot.className = 'dot';
      if (hbText) hbText.textContent = 'Offline';
      return;
    }

    const elapsed = Date.now() - deviceLastSeenAt;
    const elapsedSec = Math.floor(elapsed / 1000);
    const timeStr = new Date(deviceLastSeenAt).toLocaleTimeString();

    if (lastHeartbeat) lastHeartbeat.textContent = `${timeStr} (${elapsedSec}s ago)`;

    const heartbeatTimeout = activeConfig.heartbeatTimeoutMs || 20000;
    const offlineTimeout = activeConfig.offlineTimeoutMs || 45000;

    if (elapsed < heartbeatTimeout) {
      // Live
      if (devConn) {
        devConn.textContent = 'Online (Live)';
        devConn.style.color = 'var(--green)';
      }
      if (lastSeen) lastSeen.textContent = `Active · ${elapsedSec}s ago`;
      if (hbDot) hbDot.className = 'dot online';
      if (hbText) hbText.textContent = 'Live';
    } else if (elapsed < offlineTimeout) {
      // Standby / Stale
      if (devConn) {
        devConn.textContent = 'Standby (Delayed)';
        devConn.style.color = 'var(--amber)';
      }
      if (lastSeen) lastSeen.textContent = `No update for ${elapsedSec}s`;
      if (hbDot) hbDot.className = 'dot standby';
      if (hbText) hbText.textContent = 'Standby';
    } else {
      // Offline
      if (devConn) {
        devConn.textContent = 'Offline';
        devConn.style.color = 'var(--red)';
      }
      if (lastSeen) lastSeen.textContent = `No update since ${timeStr} (${elapsedSec}s ago)`;
      if (hbDot) hbDot.className = 'dot error';
      if (hbText) hbText.textContent = 'Offline';
    }
  }

  /**
   * Set up command button listeners
   */
  function setupCommandButtons() {
    // Buttons with data-command attribute
    document.querySelectorAll('[data-command]').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const cmd = button.getAttribute('data-command');
        if (cmd) publishCommand(cmd);
      });
    });

    // Auto/Manual Switch
    const autoSwitch = $('autoSwitch');
    if (autoSwitch) {
      autoSwitch.addEventListener('change', (e) => {
        const cmd = e.target.checked ? 'mode/auto' : 'mode/manual';
        publishCommand(cmd);
      });
    }

    // Speed Slider
    const slider = $('speedSlider');
    const speedVal = $('speedValue');
    if (slider) {
      slider.addEventListener('input', (e) => {
        if (speedVal) speedVal.textContent = e.target.value;
      });

      // Debounce publish on release/change
      slider.addEventListener('change', (e) => {
        clearTimeout(speedDebounceTimer);
        speedDebounceTimer = setTimeout(() => {
          publishCommand(`motor/speed/${e.target.value}`);
        }, 250);
      });
    }

    // Apply Speed Button
    const applySpeedBtn = $('applySpeedBtn');
    if (applySpeedBtn && slider) {
      applySpeedBtn.addEventListener('click', () => {
        publishCommand(`motor/speed/${slider.value}`);
      });
    }

    // Preset Speed Buttons
    document.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-preset');
        if (slider) slider.value = val;
        if (speedVal) speedVal.textContent = val;
        publishCommand(`motor/speed/${val}`);
      });
    });

    // Request Status Button
    const refreshBtn = $('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        publishStatusRequest();
      });
    }

    // Reconnect Button
    const reconnectBtn = $('reconnectBtn');
    if (reconnectBtn) {
      reconnectBtn.addEventListener('click', () => {
        logEvent('conn', 'Manual reconnect triggered by user.');
        connectMqtt();
      });
    }

    // Activity Log Toolbar
    const clearLogBtn = $('clearLogBtn');
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => {
        logEntries = [];
        renderLog();
      });
    }

    const copyLogBtn = $('copyLogBtn');
    if (copyLogBtn) {
      copyLogBtn.addEventListener('click', () => {
        const text = logEntries.map(e => `[${e.time}] [${e.type.toUpperCase()}] ${e.message}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
          alert("Activity log copied to clipboard.");
        }).catch(() => {
          alert("Could not copy log to clipboard.");
        });
      });
    }

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLogFilter = btn.getAttribute('data-filter') || 'all';
        renderLog();
      });
    });
  }

  /**
   * Settings Modal Management
   */
  function setupSettingsModal() {
    const modal = $('settingsModal');
    const openBtn = $('openSettingsBtn');
    const closeBtn = $('closeSettingsBtn');
    const bannerBtn = $('bannerConfigBtn');
    const form = $('settingsForm');
    const resetBtn = $('resetDefaultsBtn');
    const togglePassBtn = $('togglePasswordBtn');
    const passInput = $('cfgPassword');

    function populateForm() {
      if ($('cfgHost')) $('cfgHost').value = activeConfig.host || '';
      if ($('cfgPort')) $('cfgPort').value = activeConfig.port || 8084;
      if ($('cfgPath')) $('cfgPath').value = activeConfig.path || '/mqtt';
      if ($('cfgUsername')) {
        const u = activeConfig.username || '';
        $('cfgUsername').value = u.startsWith('REPLACE_') ? '' : u;
      }
      if (passInput) {
        const p = activeConfig.password || '';
        passInput.value = p.startsWith('REPLACE_') ? '' : p;
      }
      if ($('cfgCmdTopic')) $('cfgCmdTopic').value = activeConfig.commandTopic || '';
      if ($('cfgStatusTopic')) $('cfgStatusTopic').value = activeConfig.statusTopic || '';
    }

    function openModal() {
      populateForm();
      if (modal) {
        modal.classList.add('open');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
        const firstInput = modal.querySelector('input');
        if (firstInput) firstInput.focus();
      }
    }

    function closeModal() {
      if (modal) {
        modal.classList.remove('open');
        if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      }
    }

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (bannerBtn) bannerBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Close on backdrop click
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Toggle password visibility
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
      });
    }

    // Form submit: save settings
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        activeConfig.host = $('cfgHost').value.trim();
        activeConfig.port = Number($('cfgPort').value.trim()) || 8084;
        activeConfig.path = $('cfgPath').value.trim();
        activeConfig.username = $('cfgUsername').value.trim();
        activeConfig.password = passInput.value;
        activeConfig.commandTopic = $('cfgCmdTopic').value.trim();
        activeConfig.statusTopic = $('cfgStatusTopic').value.trim();

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(activeConfig));
          logEvent('info', 'Broker credentials saved to browser localStorage.');
        } catch (err) {
          console.warn("Error saving settings to localStorage:", err);
        }

        closeModal();
        connectMqtt();
      });
    }

    // Reset Defaults
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm("Reset connection settings to default placeholders?")) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch (_) {}
          loadConfiguration();
          populateForm();
          logEvent('info', 'Settings reset to code defaults.');
          closeModal();
          connectMqtt();
        }
      });
    }
  }

  /**
   * Application Initialization
   */
  function init() {
    loadConfiguration();
    setupCommandButtons();
    setupSettingsModal();

    // Start watchdog timer (runs every 2 seconds)
    watchdogTimer = setInterval(updateHeartbeatUi, 2000);
    updateHeartbeatUi();

    // Log startup
    logEvent('conn', 'MIOT Web Dashboard initialized.');

    // Connect to MQTT
    connectMqtt();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
