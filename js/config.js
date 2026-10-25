/**
 * MIOT Home Automation - Configuration
 * 
 * Default non-secret broker settings and topics for EMQX Cloud MQTT.
 * 
 * SECURITY ADVISORY:
 * 1. DO NOT commit real passwords or administrator credentials into source control.
 * 2. Any credentials in client-side JavaScript can be viewed by website visitors.
 * 3. Use the in-dashboard "Settings" button to enter credentials securely into your
 *    browser's private localStorage without altering source files.
 * 4. In EMQX Cloud, create a restricted client account with ACL rules:
 *      - Publish ONLY to: miot/home01/command
 *      - Subscribe ONLY to: miot/home01/status
 */

const DEFAULT_MQTT_CONFIG = {
  // EMQX Cloud Public WSS Hostname
  host: "zadd17f0.ala.us-east-1.emqxsl.com",

  // Secure WebSocket (WSS) Port for Web Browsers
  port: 8084,

  // WSS Path
  path: "/mqtt",

  // Configured broker credentials (can also be overridden in browser Settings modal)
  username: "MIOT",
  password: "MIOTMINIPROJECT",

  // MQTT Topics
  commandTopic: "miot/home01/command",
  statusTopic: "miot/home01/status",

  // Client ID prefix (random hex suffix appended per browser session)
  clientPrefix: "miot-web-",

  // Device heartbeat watchdog timeout (milliseconds)
  // Firmware publishes status periodically; if no status received in 20s, mark as stale/waiting
  heartbeatTimeoutMs: 20000,
  offlineTimeoutMs: 45000
};

// Export to window object for browser access
window.DEFAULT_MQTT_CONFIG = DEFAULT_MQTT_CONFIG;
