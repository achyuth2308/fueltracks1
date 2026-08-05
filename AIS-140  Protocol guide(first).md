## AIS 140 VOLTY PROTOCOL GUIDE

## 1 Introduction

This document explains communication protocol between the GPS device and the Server. This document defines specifics for communication such as communication packet formats, periodicity and data type of the information. This also gives you brief understanding of all the information which is sent by the device to the server.

## 2 Communication Pattern

There will be 2 modes of communication which device will send the information. A.GPRS B. SMS

## 2.1 GPRS

Device will communicate as per AIS-140 standard using GPRS. During the stored condition the device will communicate in LIFO manner along with live data. i.e. When the device starts sending the stored data, it will send live data starts sending from latest stored data.

## 2.2 SMS

In case of emergency state, (i.e. on pressing of Alert button), the device will shift to the SMS mode in case GPRS connectivity is not available. In such case, the device will send the Alert message and tracking data through SMS mode. Since SMS has the limitation of sending only 160 characters, so the tracking data to be sent in one SMS will have fields - IMEI, Latitude, Direction, Longitude, Direction, location fix, speed, Cell ID, LAC (Location Area Code), Date and Time as per emergency alert .

## 3. Communication Servers

## 3.1 Primary (Government server)

The primary server will be government server details which will be defined by the government authority. This server will receive normal tracking packets, alerts packets (i.e Emergency,power down etc).

## 3.2 Secondary (Emergency Server)

Emergency server will be the sever to which will be hosted by emergency services, and the IP/Domain details will be defined by emergency service. This server will receive only the emergency packets to it. Emergency server will send the stop emergency mode command to device once the emergency is attended.

## 4. Communication Protocol

## 4.1 Data Frame Format

Table below contains the listing of fields that the vehicle tracking devices would be required to send to the Backend Control Centre. The first 3 fields (Start character, Header for VLT with Emergency Buttons and Vendor ID this will fixed in position as well as
format (Header part of frame). Rest all other fields are required to be present in the location data sent by the devices to the backend, but can be in any sequence or with any separator between fields. The data value can in American Standard Code for Information Interchange (ASCII) format. Device will transmit the Login message whenever it establishes (re-establishes after disconnection) its connectivity with Server with the specified fields. Login Message will carry following information:

- \$Device Name –Vehicle number on which the device is installed.

- \$IMEI –15 Digit IMEI number.

- \$Firmware – Version of the firmware used in the hardware.

- \$Protocol -Version of the frame format protocol.

- \$Last Valid Location – Last location info saved at the device.


| IMEI | Identified of the sending unit. 15 digit standard unique IMEI no. | 123456789012345 |
| --- | --- | --- |
| Vehicle Reg. No | Mapped registration number | vehicle DL1PC9821 |
| GPS Fix | 1 = GPS fix OR 0 = GPS invalid | 1 |
| Date | Date value as per GPS date time per GPS date time (DDMMYYYY) | 220714 |
| Time | Time value as per GPS date time in UTC format (hhmmss) | 050656 |
| Latitude | Latitude value in decimal degrees (not less than 6 places) | 28.758963 |
| Latitude Dir | Latitude Direction. Example N=North, S= South | N |
| Longitude | Longitude value in decimal degrees (not less than 6 places). | 77.6277844 |
| Longitude Dir | Longitude Direction. E=East, W= West | W |
| Speed | Speed of Vehicle as Calculated by GPS module in VLT. (in km/hrs.) (Upto One Decimal Value) | 25.1 |
| Heading | Course over ground in degrees | 310.56 |
| No of Satellites | Number of satellites available for fix | 8 |
| Altitude | Altitude of the device in meters | 183.5 |
| PDOP | Positional dilution of precision |   |
| HDOP | Horizontal dilution of precision |   |
| Network Operator | Name of Network | INA Airtel |
| Name | Operator |   |


| Ignition | 1= Ignition On , 0 = Ignition Off | 1 |
| --- | --- | --- |
| Main Power Status | 0 = Vehicle Battery disconnected 1= Vehicle Battery reconnected | 1 |
| Main Input Voltage | Indicator showing source voltage in Volts.(Upto One Decimal Value) | 12.5 |
| Internal Battery Voltage | Indicator for level of battery charge remaining. (Upto One Decimal Value) | 4.2 |
| Emergency Status | 1= On , 0 = Off | 0 |
| Tamper Alert (Optional) | C = Cover Closed, O = C Cover Open |   |
|   | GSM Signal Strength Value Ranging from 0 – 25 31 |   |
| MCC | Mobile Country Code | 404 |
| MNC | Mobile Network Code | 10 |
| LAC | Location Area Code | 00D6 |
| Cell ID | GSM Cell ID | CFBD |
| NMR (Network Measurement Report) Neighbouring Cell ID | Neighbouring 4 cell ID along with their LAC & signal strength |   |
| Digital Input Status | 4 external digital input status (Status of Input 1 to Input 3 (0=Off; 1=On)) | 0001 |
|   | Digital Output Status 2 external digital output 01 status (0=Off; 1=On) |   |
| Frame Number | Sequence Number of the messages (000001 to 999999) | 000005 |
| Checksum | Insures No error in transmission (optimal) | 16 |
| End Character | Indicated End of the * frame |   |


## 5 . Messages & Alerts from Devices

Table below contains the listing of alerts that need to come from the tracking devices. These alerts are applicable for both live packets as well as the history packets.

|   | Messages & Alerts Supported |   |
| --- | --- | --- |
| Alert ID | Message & Alerts | Remarks |
| 1. | Location Update | Default message coming from each device |
| 2. |   | Location Update (history) Would be sent, if GPRS is not available at the time of sending the message in protocol format Zero, BLANK, NIL, etc. |
| 3. | Alert – Disconnect from main battery | If device is disconnected from vehicle battery and running on its internal battery |
| 4. | Alert – Low battery | If device internal battery has fallen below a defined threshold |
| 5. |   | Alert – Low battery removed Indicates that device internal battery is charged again |
| 6. | Alert – Connect back to main battery | Indicates that device is connected back to main battery |
| 7. | Alert – Ignition ON | Indicates that Vehicle’s Ignition is switched ON |
| 8. | Alert – Ignition OFF | Indicates that Vehicle’s Ignition is switched OFF |
| 9. | (Optional) | Alert – GPS box opened Optional message would be generated indicating GPS box opened |
| 10. | Alert – Emergency state ON* | When any of the emergency button is pressed |
| 11. | Alert – emergency State OFF | When emergency state of vehicle is removed |
| 12. | change | Alert Over the air parameter When any parameter is changed over the air. Shall include the name of parameter changed and source of command |
| 13. | Harsh Braking | Alert indicating for harsh braking. |


| 14. | Harsh Acceleration | Alert indicating for harsh acceleration. |
| --- | --- | --- |
| 15. | Rash Turning | Alert indicating for Rash turning. |
| 16 | Device Tempered | Alert Indicating Emergency button wire disconnect/ wire cut etc. |

In case of emergency alert, the alert message shall be sent to 2 different IP addresses hence the device shall support minimum 2 IP addresses (1 IP address for regulatory purpose (PVT data) and 1 IP address for Emergency response system other than the IP’s required for Operational purpose. The PVT data will send the emergency alert to the system. Primary alert will go to the emergency response Backend Control Centre as may be notified by the Government of India in the schema below:

Primary alert will go to the emergency response Backend Control Centre as notified by the Government of India in the indicative format below:

|   | Indicative Form at for Alert to Emergency Response System |   |
| --- | --- | --- |
| Attribute | Value / Description | Size |
|   | Packet Header EPB, The unique identifier for all messages from VLT | Character, 3 bytes |
| Packet Header | EPB, The unique identifier for all messages from VLT | Character, 3 bytes |
| Message Type | Message Types supported. Emergency Message (EMR) or Stop Message (SEM) | Character, 2 bytes |
| Vehicle ID | Unique ID of the Vehicle (IMEI Number) | Character,15 bytes |
| Packet Type | NM – Normal Packet, SP – Stored Packet | Character, 2 bytes |
| Date | Date and time of location the location obtained from the data in DDMMYYYY hhmmss format | Character,14 bytes |
| GPS Validity | A – Valid, V – Invalid | Character, 1 byte |
| Latitude | Latitude in decimal degrees - dd.mmmmmm format | Double, 12 bytes |
| Latitude Direction | N – North, S – South | Character, 1 byte |


| Longitude | Longitude in decimal degrees - Double, 12 bytes dd.mmmmmm format |   |
| --- | --- | --- |
| Longitude Direction | E – East W – West | Character, 1 byte |
| Altitude | Altitude in meters (above sea level) Double, 12 bytes |   |
| Speed | Speed of Vehicle as Calculated by GPS module in VLT. (in km/hr) | Float, 6 bytes |
| Distance | Distance calculated from previous GPS data | Float, 6 bytes |
| Provider | G - Fine GPS N - Coarse GPS or data from the network | Character, 1 byte |
| Vehicle RegnNo | Registration Number of the Vehicle | Character, 16 bytes |
| Reply Number | The mobile number to which Test response needs to be sent. (Emergency Mobile No) | 0 |
| CRC | The 32 bit checksum of all the characters from the header up to the CRC field | 8 bytes |

*Above format is indicative only. This Format will be notified by the Government of India time to time.

## 6. Tracking Device Health Monitoring Parameters

The device shall send status of health parameters at configurable interval below in Table.

|   | Health Monitoring Parameter |   |
| --- | --- | --- |
| Sl. No. Field |   | Description |
| 1 | Start Character | $ |
| 2 | Header | The header of the packet/ identifier |
| 3 | Vendor ID | Vendor identification header |
| 4 | Firmware Version | Version details of the Firmware used in EX.1.0.0 |
| 5 | IMEI | Identified of the sending unit. 15 digit standard unique IMEI no. |


| 6 | Battery percentage | Indicates the internal battery charge percentage |
| --- | --- | --- |
| 7 | value | Low battery threshold Indicates value on which low battery alert generated in percentage |
| 8 | Memory percentage | Indicates flash memory percentage used |
| 9 | Data update rate when Indicates Packet ignition ON | frequency on ignition ON |
| 10 | Data update rate when Indicates Packet ignition OFF | frequency on ignition OFF |
| 11 | Digital I/o status | Inputs connected to the device. |
| 12 | Analog I/o status | Analog input status |
| 13 | End character | * |

## 7. Configuration Messages:

## 7.1 Location Update frequency:

Ex: VLTSETT#0000;PASS#0000;UFRQ#60;

NOTE: Value in Seconds example: 60=1min

## 7.2 IP and Port change Message:

Ex: VLTSETT#0000;PASS#0000;IP#xxxxx;PORT#yyyyy;

Ex: xxxxx= IP/Domain Name

yyyyy= Port Number

## 7.3 Get IMEI sleep Mode Frequency’s:

Ex: VLT;0000;GETPARM1;

The above SMS to get IMEI and all in sleep Mode.

## 7.4 Get Configured Mobile Number:

Ex: VLT;0000;GETPARM2;

The above SMS to get configured Mobile number.


## Description Table:

|   | Description Settings header | VLTSETT | No Of Bytes 8 | Remarks Fixed | Example from above string VLTSETT |
| --- | --- | --- | --- | --- | --- |
| Header | Value Separator | # | 1 | Fixed | # |
|   | Password |   |   | Default value - | “0000” |
|   |   | XXXX | 4 | "0000" | "0000" |
|   | Token Separator | ; | 1 | Fixed | ; |
|   | PASS | PASS | 4 | PASS | PASS |
| Password | Value Separator | # | 1 | Fixed | # |
| Setting | Value | 0000 | 4 | Fixed | 0000 |
|   | Token Separator | ; | 1 | Fixed | ; |
|   | User frequency Header | UFRQ | 4 | Fixed | UFRQ |
|   | Value Separator | # | 1 | Fixed | # |
| User frequency | User frequency | 60 |   | Frequency in seconds (Default 30Sec) | 60 |
|   | Token Separator | ; | 1 | Fixed | ; |

## Communication Address:

Volty IoT Solutions Pvt Ltd

4th Floor Plot No: 703/A, Road No: 36,

Jubilee Hills,

Hyderabad-500033,

(M)-7997247247
