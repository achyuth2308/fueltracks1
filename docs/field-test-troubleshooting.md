# Field Test Troubleshooting Runbook

  SYMPTOM: New device shows offline, no live location on frontend

  STEP 1: Check totalConnectionAttempts for the expected port via
  GET /health. If it's 0 and has been 0 for several minutes while
  the device is powered on and moving:
    → The OS-level TCP handshake is not completing. This is a
      network issue (MTU/MSS, carrier NAT, security group), NOT
      an application bug. Do not modify parser code. Escalate to
      infra checklist (MSS clamping, security group rule, APN
      config on device SIM).

  STEP 2: If totalConnectionAttempts > 0 but successful packet
  count is 0, check logs for "Disallowed packet header" or
  "Unexpected byte ... scanning forward" warnings on OTHER
  protocol ports (BSTPL/AIS140) around the same timestamp.
    → If found, the device is sending the correct protocol but to
      the WRONG port. This is a device SMS-configuration issue —
      re-send the IP/port config command to the device, and
      confirm the device's SMS reply acknowledges the change. Do
      not modify server code.

  STEP 3: If totalConnectionAttempts > 0 on the CORRECT port and
  packets are arriving but failing to parse, THEN it is a genuine
  parser bug — capture the raw tcpdump hex, compare against the
  spec's worked examples, and file a normal bug report against the
  parser.

  Useful debugging commands:
    sudo tcpdump -i any port <PORT> -nn -A
    pm2 flush <service-name>
    pm2 logs <service-name> --lines 0
    curl GET /health (per service)
