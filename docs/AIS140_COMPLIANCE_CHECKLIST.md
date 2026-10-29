# AIS-140 Fitment Certificate Compliance Checklist
**State Transport Department & MoRTH Statutory Alignment Guide**

This checklist details the regulatory fields that **must be verified against the state transport department portal (e.g., Vahan 4.0, Suraksha Mitra, TS-iPASS, Karnataka KMVD, Delhi VTS, etc.)** and the current testing agency certificates before deploying this certificate template to live production.

---

## 1. Statutory Approval & Device Identification Fields
| Field Name | Description | Verification Source | Requirement & Rules |
| :--- | :--- | :--- | :--- |
| **TAC / Type Approval No.** | Type Approval Certificate number granted by testing agency | Physical TAC Certificate / Vahan backend | Must match the TAC issued by ARAI/ICAT/CIRT/VRDE. Format varies by agency (e.g., `CA...`, `AL...`). |
| **Testing Agency** | Test agency that issued the COP (Conformity of Production) | TAC Document | Must be one of the accredited MoRTH agencies: **ARAI** (Pune), **ICAT** (Manesar), **CIRT** (Pune), or **VRDE** (Ahmednagar). |
| **AIS-140 Certificate No.** | Extension certificate specifically certifying AIS-140 compliance | Agency COP / AIS-140 Test Report | Test agency report number including amendment date. |
| **Device Model & Make** | Exact commercial brand and hardware model | Vahan Device Master | Must match verbatim with the registered model name in Vahan (case-sensitive). |
| **Firmware Version** | Active firmware build flashed onto the VLTD | Agency Test Report / Device CLI | The firmware installed on the vehicle must match the certified firmware version in the test report. |
| **Tamper-Seal Serial No.** | Number on the tamper-evident barcode seal placed on the enclosure | Physical seal installed | Must be recorded in the state backend portal to detect physical casing breach. |

---

## 2. Telematics & Dual-Profile eSIM Fields
| Field Name | Description | Verification Source | Requirement & Rules |
| :--- | :--- | :--- | :--- |
| **Primary SIM MSISDN** | Telematics M2M SIM cellular mobile number | Telecom Service Provider (TSP) | Dedicated M2M / IoT data SIM. Voice calls are disabled except emergency SOS routing. |
| **SIM ICCID** | 19 or 20 digit unique integrated circuit card identifier | SIM physical body / AT command (`AT+CCID`) | Mandatorily registered on state transport servers for Vahan SIM linking. |
| **Network Operator / APN** | Cellular carrier and secure APN profile | TSP agreement (e.g. Airtel IoT, Jio M2M, Vi Business) | Must specify private enterprise APN used for secure backend tunneling. |
| **Secondary SIM** | Dual-eSIM or fallback telecom profile | Device specifications | State mandates vary: some states require dual carrier eSIMs; others accept single embedded eSIM. Set to `"Not used"` if single eSIM. |

---

## 3. Vehicle & Registration Authority Fields
| Field Name | Description | Verification Source | Requirement & Rules |
| :--- | :--- | :--- | :--- |
| **Registration Plate No.** | Vehicle registration number | Form 23 / RC (Registration Certificate) | Clean uppercase without special characters (e.g., `TS07UJ1278`). |
| **Chassis Number (VIN)** | 17-character Vehicle Identification Number | Vehicle chassis plate / Vahan RC | Full 17 characters; must match Vahan database exactly. |
| **Engine Number** | Vehicle engine serial number | Engine stamping / RC | Complete number as recorded on RC. |
| **Vehicle Class** | Category under Motor Vehicles Act | RC Document | E.g., `HGV (Heavy Goods Vehicle)`, `Maxi Cab`, `School Bus`, `Educational Institution Bus`, `Stage Carriage`. |
| **RTO Authority** | Registering Authority name & code | State RTO office | E.g., `RTO Hyderabad Central (TS-09)`, `RTO Bangalore Central (KA-01)`. |

---

## 4. Pre-Commissioning Functional Checklist
The following 6 functional tests must pass before the certificate is signed and issued:
1. **GPS Positioning Fix**: Verified 3D fix with minimum 4+ satellites tracked (HDOP < 2.0).
2. **GSM / GPRS Connectivity**: Carrier handshake established (CSQ signal strength > 14).
3. **Main Power & Internal Battery**: Main DC input (9V–36V) validated; internal battery backup functioning when main power disconnected.
4. **Ignition Detection**: Binary state accurately transitions between Ignition ON and Ignition OFF.
5. **Emergency Button (SOS / Panic Button)**: Pressing any connected SOS button successfully generates an emergency alert packet with buzzer/LED feedback.
6. **Backend Server Delivery**: Telematics packets verified as acknowledged by the state backend emergency response support system (ERSS / 112) and FuelTracks server.

---

## 5. Signatures, Dealers & Legal Undertaking
1. **Fitment Center / Dealer Code**: Every authorized fitment center is issued a unique Center Code by the state transport department.
2. **Technician ID**: The trained technician who performed the wiring, ignition tap, and tamper-seal must provide their registration ID.
3. **Owner Undertaking**: The undertaking statement must be signed by the actual vehicle owner or authorized corporate fleet representative. Marked as `[Subject to Legal Review]` for your legal counsel to confirm wording against the state's Specific Conditions of Contract.
4. **Digital Verification QR Code**: Must resolve directly to the live verification endpoint (`https://www.fueltracks.in/verify/<certificate-no>`) displaying real-time status: **VALID**, **EXPIRED**, or **SUSPENDED**.
