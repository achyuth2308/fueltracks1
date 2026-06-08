




## AIS140 PROTOCOL DESCRIPTION
For tnavIC AIS140 TCP Protocol description


## 1
## V1.2.0
## Document History

## Version Date Author Description
## 0.1 12/13/2023  Initial Draft
## 0.2 2/12/2024
- Add missing commands
## 1.0.0 9/28/2024
## • Baseline Version
- Add detailed information for Miscellaneous fields
- Add commands for feature control
- Update modes for state protocol
- Add command for Alternate IP/Port config
## 1.1.0 10/07/2024
- Added Fuel sensor data Information
- Add FCFG command
## 1.2.0 12/30/2024
- Add AMOD command



## 2
## V1.2.0
## References
## Sr. No. Name Author Remarks
1 AIS-140withAmd1.pdf  AUTOMOTIVE INDUSTRY STANDARD
2 AIS-140_Final_Draft_5Dec2018.pdf  AIS140 Standard Amendment 2

## Abbreviations
## Item Description
ITS Intelligent Transport system
APN Access Point Name
SMS Short Message Service
IRNSS Indian Regional Navigation Satellite System
GPS Global Positioning System
AGPS Assisted GPS
CEP Circular Error Probability
DOP Dilution of precision



## 3
## V1.2.0
## Contents
Document History ......................................................................................................................................... 1
References .................................................................................................................................................... 2
Abbreviations ................................................................................................................................................ 2
List of Tables ................................................................................................................................................. 6
Intelligent Tracking System ........................................................................................................................... 7
Automotive Industry Standard (AIS-140) .................................................................................................. 7
AIS-140 Protocol Description ........................................................................................................................ 8
Login Packet .............................................................................................................................................. 8
Health Monitoring Packet ......................................................................................................................... 9
Location/Periodic Information Packet .................................................................................................... 10
Alert Information Packet ......................................................................................................................... 12
Emergency Packet ................................................................................................................................... 14
OTA Acknowledgement Packet ............................................................................................................... 15
Activation Message and Health Check Message Protocol ...................................................................... 19
Secondary IP Protocol ................................................................................................................................. 20
Miscellaneous Field 1 .............................................................................................................................. 22
Miscellaneous Field 2 .............................................................................................................................. 22
Miscellaneous Field 3 .............................................................................................................................. 22
Miscellaneous Field 4 .............................................................................................................................. 24
AIS140 Configuration Commands ............................................................................................................... 25
Configuration Keys .................................................................................................................................. 25
- PIP – Primary IP.......................................................................................................................... 25
- PPT – Primary Port ..................................................................................................................... 25
- EIP – Emergency IP .................................................................................................................... 26
- EPT – Emergency Port ................................................................................................................ 26
- SIP – Secondary IP (Customer Server) ....................................................................................... 26
- SPT – Secondary Port (Customer Server) .................................................................................. 26
- AIP – Alternate IP (Alternate Govt. Server) ............................................................................... 26
- APT – Alternate Port (Alternate Govt. Server) .......................................................................... 26
- M0 – Emergency/Backend Server Number ............................................................................... 26
- EO – Emergency OFF.................................................................................................................. 26


## 4
## V1.2.0
- ES – Emergency Status ............................................................................................................... 26
- ED – Emergency Duration .......................................................................................................... 26
- APN – Network APN .................................................................................................................. 26
- ST – Sleep Time .......................................................................................................................... 27
- SL – Speed Limit ......................................................................................................................... 27
- HBT – Harsh break Threshold .................................................................................................... 27
- HAT – Harsh Acceleration Threshold ......................................................................................... 27
- RTT – Rash Turning Threshold ................................................................................................... 27
- LBT – Low Battery Threshold ..................................................................................................... 27
- VN – Vehicle Registration Number ............................................................................................ 27
- URS – Update Rate Sleep Mode ................................................................................................ 27
- PIN – Update Rate Ignition ON .................................................................................................. 28
- PIF – Update Rate Ignition OFF .................................................................................................. 28
- URE – Update Rate Emergency ................................................................................................. 28
- URH – Update Rate Health Packet ............................................................................................ 28
- VID – Vendor ID ......................................................................................................................... 28
- FV – Firmware Version............................................................................................................... 28
- M1 – User Mobile Number 1 ..................................................................................................... 28
- M2 – User Mobile Number 2 ..................................................................................................... 28
- M3 – User Mobile Number 3 ..................................................................................................... 29
- PWD – Password Change ........................................................................................................... 29
- SEN – SMS Enable ...................................................................................................................... 29
- GP1/GP2 – Control GPO line...................................................................................................... 29
- TA – Tilt Angle ............................................................................................................................ 29
- TBT – Turn by Turn Tracking ...................................................................................................... 29
- RL – Relay Control ...................................................................................................................... 29
- ODM – Set Odometer ................................................................................................................ 30
- BED – Box Event Disable ............................................................................................................ 30
- TZN – Change Packet time zone ................................................................................................ 30
- S1 – Authorized SMS Number 1 ................................................................................................ 30
- S2 – Authorized SMS Number 2 ................................................................................................ 30
- S3 – Authorized SMS Number 3 ................................................................................................ 30
- RST – Reset Device ..................................................................................................................... 31


## 5
## V1.2.0
- MOD – Set packet mode ............................................................................................................ 31
- AMOD – Set packet mode for Alternate IP ................................................................................ 31
- GF – Configure Geofence ........................................................................................................... 32
Special Configuration Commands ............................................................................................................... 33
- Time – Set/Get system time ...................................................................................................... 33
- DPWD – Set/change distributor password ................................................................................ 33
- ADCTUNE – Set ADC parameters ............................................................................................... 33
- SIM – Get SIM ICCID .................................................................................................................. 33
- OFR – Clear Offline Data ............................................................................................................ 33
- DNSCFG – configure custom DNS server ................................................................................... 34
- GPR – Reset GPS chipset ............................................................................................................ 34
- MPACK – Set multipacket configuration ................................................................................... 34
- BUZZ – Set buzzer configuration ............................................................................................... 34
- BTYPE – Set buzzer type ............................................................................................................ 34
- FRESET – Factory reset device ................................................................................................... 34
- NWINFO – Get network information ......................................................................................... 35
- IMU – Configure Inertial Measurement Unit ............................................................................ 35
- IMCONF – Immobilizer Configuration ....................................................................................... 36
- SENSOR – Control Temperature Sensor .................................................................................... 36
- TEMPTH – Configure Sensor Threshold ..................................................................................... 37
- FCFG – Fuel Sensor configuration .............................................................................................. 37
Service Commands ...................................................................................................................................... 40
- STG – Device Settings ................................................................................................................ 40
- TEST – Device Operation Status ................................................................................................ 40
- NWINFO – Get Network Information ........................................................................................ 40
- WHERE – Locate Device ............................................................................................................. 41
- ACTV – Activation Message ....................................................................................................... 41
- HCHK – Health Check Message .................................................................................................. 41
- NWSWITCH – Network Management ....................................................................................... 41
- IDENTIFY – Get Device Identity.................................................................................................. 42
- SIMLOCK – Lock SIM with Device .............................................................................................. 42
- FOTA – Firmware Upgrade ........................................................................................................ 42



## 6
## V1.2.0
List of Tables
Table 1: Login Packet .................................................................................................................................... 8
Table 2: Health Monitoring Packet ............................................................................................................... 9
Table 3: Location Information Packet ......................................................................................................... 10
Table 4: Alert Information Packet ............................................................................................................... 12
Table 5: Emergency Packet ......................................................................................................................... 14
Table 6: OTA ACK Packet ............................................................................................................................. 15
Table 7: Packet Types .................................................................................................................................. 17
Table 8: Alert ID List .................................................................................................................................... 17
Table 9: Socket State Information .............................................................................................................. 18
Table 10: Response Message Format ......................................................................................................... 19
Table 11 Secondary Server Protocol ........................................................................................................... 20
Table 12: Fuel Sensor Data Information ..................................................................................................... 23



## 7
## V1.2.0
## Intelligent Tracking System
Intelligent Transport Systems (ITS) are globally proven systems to optimize the utilization of existing
transport infrastructure and improve transportation systems in terms of efficiency, quality, comfort, and
safety. Having realized the potential of ITS, Government bodies and other organizations in India are
presently working towards implementing various components of ITS across the country.
Automotive Industry Standard (AIS-140)
The Automotive industry standard committee (AISC) prepared standard for ITS defining the
requirements for both front end software as well as hardware design and its protocol for data exchange.
This standard is titled as AIS-140 (“Intelligent Tracking System – Requirements for Public transport
Vehicle Operation”). AIS-140 standard is approved by CMVR Technical standing committee (CTSC) and
Automotive research association of India (ARAI), Pune. ARAI, being the secretariat of the AIS committee,
has also published this standard. The standard has gone through various amendments over time for
hardware requirements, most importantly the mandatory requirement of IRNSS.


## 8
## V1.2.0
AIS-140 Protocol Description
ITS talks to hardware device over a TCP socket. This section provides detailed information on the various
packet formats as described by AIS-140 standard. There are seven types of data packet as mentioned
below:
## 1. Login Packet
## 2. Health Monitoring Packet
## 3. Location Information Packet
## 4. Alert Information Packet
- Emergency Packet for Emergency response system
- OTA Acknowledge Packet
- Activation Message and Health Check Message Protocol
All the fields mentioned in protocol format are comma separated.

## Login Packet
A login packet is sent to server whenever there is a new TCP connection made by device to server. Login
packet format may vary based on state protocol selected
## Table 1: Login Packet
## Field Description Sample Data
Header Fix header with $ as start
character for identification of
login packet
## $LGN
Device Name Vehicle Registration number
configured by User

IMEI Device IMEI 15 bytes 123456789012345
Software Version Software/Firmware version of
device
## X.Y.Z
## 1

Latitude Last known location latitude
Latitude Direction Latitude Direction North or
## South
## N
Longitude Last known location longitude
Longitude Direction Longitude Direction East or
## West
## E



## 1
X=Major, Y=Minor Z=Patch


## 9
## V1.2.0
## Health Monitoring Packet
This packet defines the status or health of the device. Following is the packet format. Packet format may
vary slightly based on state protocol selected. Refer to Individual state document for more information.
## Table 2: Health Monitoring Packet
## Field Description Sample Data
Header Fix header with $ as start
character for identification of
health monitoring packet
## $HLM
Vendor ID Vendor ID configured by User
Software Version Firmware version of device X.Y.Z
## 2

IMEI Device unique IMEI 123456789012345
Battery percentage Indicates internal battery in % 100
Low Battery Threshold Indicates value on which low
battery alert generated in %
## 20
Memory percentage Indicates flash memory % used 0
Data Update Rate – Ignition On Indicates packet frequency
when ignition is on in seconds
## 60
Data Update Rate – Ignition On Indicates packet frequency
when ignition is off in seconds
## 60
Digital Input status Status of inputs connected in
order:
## [DIN3, DIN2, DIN1, DIN0]
## 0000
Analog Input Status Analog Input status 00
## End Character * *



## 2
X=Major, Y=Minor Z=Patch


## 10
## V1.2.0
Location/Periodic Information Packet
This is a periodic location information packet sent by device to server.
## Table 3: Location Information Packet
## Field Description Sample Data
Header Fix header with $ as start character
for identification of Normal Packet
(Location Information Packet)
## $NRM
Vendor ID Vendor ID configured by User
Software Version Software/Firmware version of
device
## X.Y.Z
## 3

Packet Type 2 Byte information specifying type
of packet. See Table 7: Packet Types
for more information
## NR
Alert ID 2 Byte alert ID indicating type of
packet see
Table 8: Alert ID List for more
information

Packet Status Status of packet
## L = Live Packet
## H = History Packet
## L
IMEI Device unique IMEI 123456789012345
## Vehicle Registration No. Mapped Vehicle Registration
## Number
## XX12XX1234
GPS Fix GPS Fix information
1 = GPS Fix
0 = GPS Invalid
## 1
Date Date value as per GPS in
DDMMYYYY format
## 01012019
Time Time value as per GPS in HHMMSS
format
## 000000
Latitude Latitude value up to 6 decimal
places

Latitude Direction North or South N
Longitude Longitude value up to 6 decimal
places

Longitude Direction East or West E
Speed Speed of vehicle up to 1 decimal
place in km/h
## 25.1
Heading Course over ground in degrees up to
2 decimal places
## 123.45
No. of Satellites No. of satellite in view for location
fix
## 10
Altitude Altitude of device in meters 123.4
PDOP Positional dilution of precision

## 3
X=Major, Y=Minor Z=Patch


## 11
## V1.2.0
HDOP Horizontal dilution of precision
Operator Name Name of network operator Airtel
Ignition Status of Ignition
## 1 – Ignition On
## 0 – Ignition Off
## 1
## Main Power Status 0 – Vehicle Battery Disconnected
## 1 – Vehicle Battery Connected
## 1
Main Input Voltage Indicator showing source voltage in
Volts (Upton 1 decimal place)
## 12.4
Internal Battery Voltage Indicator of battery charge in volts
(up to 1 decimal place)
## 4.2
## Emergency Status 0 – Emergency Off
## 1 – Emergency On
## 0
Temper Alert O – Box open
## C – Box Closed
## C
GSM Strength Value ranges from 0 – 31 31
MCC Mobile Country Code 404
MNC Mobile Network Code 98
LAC Location Area Code XXXX
Cell ID GSM Cell ID
NMR (Network Measurement
## Report)
Cell ID, LAC, and Signal Strength of 4
Neighboring cells
(24,XXXX,XXXX)*4 times
Digital Input Status Status of 4 Digital Inputs in order:
## [DIN3, DIN2, DIN1, DIN0]
## 0 – Off, 1 – On
## 0000
Digital Output Status Status of 2 Digital Outputs in order:
## [DOUT1, DOUT0]
0 – Off, 1 – on
## 00
Analog Input 1 Analog Input 1 voltage in mV
Analog Input 2 Analog Input 2 voltage in mV
Frame Number Sequence number of packet (from
000001 to 999999)
## 000005
Odometer Odometer value in Km (float) 123.456
Debug Information Debug information Format:
## [CREG_CGREG_SOC1_SOC2_FW]
CREG: GSM registration status
CGREG: GPRS registration status
SOC1: Primary Socket status
SOC2: Secondary Socket status
Refer Table 9 for socket status
information

Checksum Packet checksum (CRC32) ABCDABCD
## End Character * *



## 12
## V1.2.0
## Alert Information Packet
When an alert is generated, the following packet is sent to server indicating which event has occurred.
## Table 4: Alert Information Packet
## Field Description Sample Data
Header Fix header with $ for identifying
Alert Information packet
## $ALT
Vendor ID Vendor ID configured by User
Software Version Software version of device X.Y.Z
## 4

Packet Type 2 Byte information specifying type
of packet. See Table 7: Packet Types
for more information
## OS
Alert ID 2 Byte alert ID indicating type of
packet see
Table 8: Alert ID List for more
information

Packet Status Status of packet
## L = Live Packet
## H = History Packet
## L
IMEI Device unique IMEI 123456789012345
Vehicle Registration No. Vehicle Registration Number XX12XX1234
GPS Fix GPS Fix information
1 = GPS Fix
0 = GPS Invalid
## 1
Date Date value as per GPS in
DDMMYYYY format
## 01012019
Time Time value as per GPS in HHMMSS
format
## 000000
Latitude Latitude up to 6 decimal places
Latitude Direction North or South N
Longitude Longitude up to 6 decimal places
Longitude Direction East or West E
Speed Speed of vehicle up to 1 decimal
place in km/h
## 25.1
Heading Course over ground in degrees up
to 2 decimal places
## 123.45
No. of Satellites No. of satellite in view for fix 10
Altitude Altitude of device in meters 123.4
PDOP Positional dilution of precision
HDOP Horizontal dilution of precision
Operator Name Name of network operator Airtel
Ignition Status of Ignition
## 1 – Ignition On
## 1

## 4
X=Major, Y=Minor Z=Patch


## 13
## V1.2.0
## 0 – Ignition Off
## Main Power Status 0 – Vehicle Battery Disconnected
## 1 – Vehicle Battery Connected
## 1
Main Input Voltage Indicator showing source voltage
in Volts (Upton 1 decimal place)
## 12.4
Internal Battery Voltage Indicator of battery charge in volts
(up to 1 decimal place)
## 4.2
## Emergency Status 0 – Emergency Off
## 1 – Emergency On
## 0
Temper Alert O – Box open
## C – Box Closed
## C
GSM Strength Value ranges from 0 – 31 31
MCC Mobile Country Code 404
MNC Mobile Network Code 98
LAC Location Area Code XXXX
Cell ID GSM Cell ID
NMR (Network Measurement
## Report)
Cell ID, LAC, and Signal Strength of
4 Neighboring cells
(24,XXXX,XXXX)*4 times
Digital Input Status Status of 4 Digital Inputs in order:
## [DIN3, DIN2, DIN1, DIN0]
## 0 – Off, 1 – On
## 0000
Digital Output Status Status of 2 Digital Outputs in
order:
## [DOUT1, DOUT0]
0 – Off, 1 – on
## 00
Analog Input 1 Analog input 1 voltage in mV
Analog Input 2 Analog input 2 voltage in mV
Frame Number Sequence number of packet (from
000001 to 999999)
## 000005
Odometer Odometer value in Km (float) 123.123
Debug Information Debug information Format:
## [CREG_CGREG_SOC1_SOC2_FW]
CREG: GSM registration status
CGREG: GPRS registration status
SOC1: Primary Socket status
SOC2: Secondary Socket status
Refer Table 9 for socket status
information

Checksum Packet checksum (CRC32) ABCDABCD
## End Character * *



## 14
## V1.2.0
## Emergency Packet
When the SOS button is pressed, the device sends the following emergency packet to emergency server
IP only.
## Table 5: Emergency Packet
## Field Description Sample Data
Header Fix header for identifying
Emergency packet
## $EPB
Packet Type Emergency Packet type
EMR – Emergency Message
SEM – Stop Message
## EMR
IMEI Device unique IMEI 123456789012345
Packet Status Status of packet
NM = Normal Packet
SP = Stored Packet
## NP
Date & Time Date and Time value as per GPS
in DDMMYYYYHHMMSS format
## 01012019000000
GPS Fix GPS Fix information
A = GPS Fix
V = GPS Invalid
## A
Latitude Latitude value up to 6 decimal
places

Latitude Direction North or South N
Longitude Longitude value up to 6 decimal
places

Longitude Direction East or West E
Altitude Altitude of device in meters 123.4
Speed Speed of vehicle up to 1 decimal
place in km/h
## 25.1
Distance Distance calculated from
previous GPS data

Provider G – Fine GPS
N – Coarse GPS or data from
## NW
## G
Vehicle Registration No. Vehicle Registration Number XX12XX1234
## Reply Number  0
## End Character * *
Checksum Packet checksum (CRC32) ABCDABCD



## 15
## V1.2.0
OTA Acknowledgement Packet
When configuration commands (SET, GET, CLR) are sent to device, an acknowledgement packet is
generated and sent to server indicating which parameter is changed or requested. As per AIS-140, this
packet should also include mode of configuration and source from where command was sent. This is
also included in this packet. The format of the packet is given below.
Table 6: OTA ACK Packet
## Field Description Sample Data
Header Fix header for identifying Alert packet with
Packet type as OA (for OTA alert)
## $ALT
Vendor ID Vendor ID configured by User
Software Version Software version of device X.Y.Z
## 5

Packet Type 2 Byte information specifying type of
packet. See Table 7: Packet Types for more
information
## OA
Alert ID 2 Byte alert ID indicating type of packet see
Table 8: Alert ID List for more information

Packet Status Status of packet
## L = Live Packet
## H = History Packet
## L
IMEI Device unique IMEI 123456789012345
Vehicle Registration No. Vehicle Registration Number XX12XX1234
GPS Fix GPS Fix information
1 = GPS Fix
0 = GPS Invalid
## 1
Date Date value as per GPS in DDMMYYYY
format
## 01012019
Time Time value as per GPS in HHMMSS format 000000
Latitude Latitude up to 6 decimal places
Latitude Direction North or South N
Longitude Longitude up to 6 decimal places
Longitude Direction East or West E
Speed Speed of vehicle up to 1 decimal place in
km/h
## 25.1
Heading Course over ground in degrees up to 2
decimal places
## 123.45
No. of Satellites No. of satellite in view for fix 10
Altitude Altitude of device in meters 123.4
PDOP Positional dilution of precision
HDOP Horizontal dilution of precision
Operator Name Name of network operator Airtel
Ignition Status of Ignition
## 1 – Ignition On
## 0 – Ignition Off
## 1
## Main Power Status 0 – Vehicle Battery Disconnected 1

## 5
X=Major, Y=Minor Z=Patch


## 16
## V1.2.0
## 1 – Vehicle Battery Connected
Main Input Voltage Indicator showing source voltage in Volts
(Upton 1 decimal place)
## 12.4
Internal Battery Voltage Indicator of battery charge in volts (up to 1
decimal place)
## 4.2
## Emergency Status 0 – Emergency Off
## 1 – Emergency On
## 0
Temper Alert O – Box open
## C – Box Closed
## C
GSM Strength Value ranges from 0 – 31 31
MCC Mobile Country Code 404
MNC Mobile Network Code 98
LAC Location Area Code XXXX
Cell ID GSM Cell ID
NMR (Network
## Measurement Report)
Cell ID, LAC, and Signal Strength of 4
Neighboring cells
(24,XXXX,XXXX)*4 times
Digital Input Status Status of 4 Digital Inputs
## 0 – Off, 1 – On
## 0000
Digital Output Status Status of 2 Digital Outputs
0 – Off, 1 – on
## 00
Analog Input 1 Analog Input 1 voltage in mV
Analog Input 2 Analog input 2 voltage in mV
Frame Number Sequence number of packet (from 000001
to 999999)
## 000005
Odometer Odometer value in Km (float) 123.123
OTA Info OTA information for indication of change
or request in following format:
## [TYPE]:[SRC]:[SRC_VAL]|[CMD]:[VAL]
[TYPE] can be GET, SET or CLR based on
what command was sent
[SRC] can be SRV, SMS, CON for server,
SMS, and console respectively
[SRC_VAL] is the IP address or Cell number
from where command was sent

[CMD] is command key of command sent
to device
[VAL] is parameter value
## SET:SMS:+919800000000|PIN:60
Debug Information Debug information Format:
## [CREG_CGREG_SOC1_SOC2_FW]
CREG: GSM registration status
CGREG: GPRS registration status
SOC1: Primary Socket status
SOC2: Secondary Socket status
Refer Table 9 for socket status information

Checksum Packet checksum (CRC32) ABCDABCD
## End Character * *



## 17
## V1.2.0
## Table 7: Packet Types
## Type Description
NR Normal Packet
EA Emergency Alert
TA Temper Alert
HP Health Packet
IN Ignition On
IF Ignition Off
BD Vehicle Battery Disconnected
BR Vehicle Battery Reconnected
BL Internal Battery Low
HB Harsh Breaking
HA Harsh Acceleration
RT Rash Turning
TI Tilt Alert
WD SOS/Emergency Button Wire Disconnect
OS Overspeed Alert
OA OTA Acknowledgement
GI Geofence IN
GO Geofence Out

Table 8: Alert ID List
Alert ID Name Description
1 Location Update Default Message from device
2 Location Update (History) If GPRS is not available at time of sending message
3 Mains off When device is disconnected from vehicle battery
4 Low Battery Device internal battery low alert
5 Low Battery removed Device internal battery ok
6 Mains On Device is reconnected to vehicle battery
7 Ignition On Vehicle ignition on alert
8 Ignition Off Vehicle Ignition off alert
9 Temper Alert Device box open
10 Emergency On Emergency on alert
11 Emergency Off Emergency off alert
12 OTA Alert Parameter change/query alert packet
13 Harsh Breaking Alert indication a hash break
14 Harsh Acceleration Alert indicating harsh acceleration
15 Rash Turning Alert indicating rash turn
16 Wire Disconnect SOS/Emergency button wire disconnect alert
17 Overspeed Alert indicating overspeed


## 18
## V1.2.0
18 Geofence In Geofence entry alert
19 Geofence Out Geofence exit alert
22 Tilt Alert Vehicle/Device tilted
## 30
## 6
Motion Start Vehicle motion started
31 Motion Stop Vehicle motion stopped
32 Relay Event Relay on/off notification event
33 New ID New RFID/iButton detected
36 Temp High Temperature high alert event
37 Temp Low Temperature low alert event
40 FOTA Failed FOTA fail event

## Table 9: Socket State Information
## Code Description
0 Invalid or unknown state
1 No network registered
2 GSM network registered
3 GPRS & GSM network registered
4 Trying to connect to programmed server IP & Port
5 Connected to programmed server IP & Port
6 Currently sending data to server


## 6
Events starting from here are secondary IP events only. They are not part of AIS140 and are not reported on
primary IP


## 19
## V1.2.0
Activation Message and Health Check Message Protocol
This packet is sent from device to backend server reply number. All fields are separated by comma.

## Table 10: Response Message Format
Field Name Characters (max size) Activation Example Health Check Example
Header 5 ACTVR HCHKR
## Random Code 6 123456 123456
Vendor ID 4
Firmware Version 6 X.YAAA
## 7
## X.YAAA
## 7

## IMEI 15 123456789012345 123456789012345
Alert ID 2 1 1
## Latitude 12 12.345678 12.345678
## Latitude Direction 1 N N
## Longitude 12 123.456789 123.456789
## Longitude Direction 1 E E
GPS Fix (0/1) 1 1 1
Date Time 15 DDMMYYYY HHMMSS DDMMYYYY HHMMSS
## Heading 6 123.45 123.45
## Speed 4 12.3 12.3
GSM Strength 2 12 12
## MCC 3 404 404
## MNC 4 4 4
## LAC 4 XXXX XXXX
## Main Power (0/1) 1 1 1
## Ignition Status 1 1 1
## Battery Voltage 4 12.3 12.3
## Frame Number 6 000001 000001
## Mode
## 8
## 2 0 0



## 7
X=Major, Y=Minor AAA=Firmware Identifier
## 8
This field is currently not defined in document, it will be sent as 0


## 20
## V1.2.0
Secondary IP Protocol
Data sent on to secondary server (customer IP) is a special filtered protocol which only carries necessary
information useful for customer in terms of usage by telematics application and debugging purpose. It
also carries application specific events which are not part of AIS140 protocol but are useful for customer
application use cases.

## Table 11 Secondary Server Protocol
## Field Description Sample Data
Header Fix header with $ as start character
for identification of Normal Packet
(Location Information Packet)
## $NRM
Vendor ID Vendor ID configured by User
Software Version Software/Firmware version of
device
## X.Y.Z
## 9

Packet Type 2 Byte information specifying type
of packet. See Table 7: Packet Types
for more information
## NR
Alert ID 2 Byte alert ID indicating type of
packet see
Table 8: Alert ID List for more
information

Packet Status Status of packet
## L = Live Packet
## H = History Packet
## L
IMEI Device unique IMEI 123456789012345
## Vehicle Registration No. Mapped Vehicle Registration
## Number
## XX12XX1234
GPS Fix GPS Fix information
1 = GPS Fix
0 = GPS Invalid
## 1
Date Date value as per GPS in
DDMMYYYY format
## 01012019
Time Time value as per GPS in HHMMSS
format
## 000000
Latitude Latitude value up to 6 decimal
places

Latitude Direction North or South N
Longitude Longitude value up to 6 decimal
places

Longitude Direction East or West E
Speed Speed of vehicle up to 1 decimal
place in km/h
## 25.1
Heading Course over ground in degrees up to
2 decimal places
## 123.45

## 9
X=Major, Y=Minor Z=Patch


## 21
## V1.2.0
No. of Satellites No. of satellite in view for location
fix
## 10
Altitude Altitude of device in meters 123.4
PDOP Positional dilution of precision
HDOP Horizontal dilution of precision
Operator Name Name of network operator Airtel
Ignition Status of Ignition
## 1 – Ignition On
## 0 – Ignition Off
## 1
## Main Power Status 0 – Vehicle Battery Disconnected
## 1 – Vehicle Battery Connected
## 1
Main Input Voltage Indicator showing source voltage in
Volts (Upton 1 decimal place)
## 12.4
Internal Battery Voltage Indicator of battery charge in volts
(up to 1 decimal place)
## 4.2
## Emergency Status 0 – Emergency Off
## 1 – Emergency On
## 0
Temper Alert O – Box open
## C – Box Closed
## C
GSM Strength Value ranges from 0 – 31 31
MCC Mobile Country Code 404
MNC Mobile Network Code 98
LAC Location Area Code XXXX
Cell ID GSM Cell ID
NMR (Network Measurement
## Report)
Cell ID, LAC, and Signal Strength of 4
Neighboring cells
(24,XXXX,XXXX)*4 times
Digital Input Status Status of 4 Digital Inputs in order:
## [DIN3, DIN2, DIN1, DIN0]
## 0 – Off, 1 – On
## 0000
Digital Output Status Status of 2 Digital Outputs in order:
## [DOUT1, DOUT0]
0 – Off, 1 – on
## 00
Analog Input 1 Analog Input 1 voltage in mV
Analog Input 2 Analog Input 2 voltage in mV
Frame Number Sequence number of packet (from
000001 to 999999)
## 000005
Odometer Odometer value in Km (float) 123.456
Misc. Field 1 Alert Data (based on feature
enabled), When feature is disabled a
fix ‘-‘ (hyphen) is sent to server

Misc. Field 2 CAN Data field when CAN feature is
enabled, else ‘-‘

Misc. Field 3 Fuel data field when Fuel sensor is
enabled, else ‘-‘

Misc. Field 4 Temperature or Humidity sensor
data when sensor is enabled, else ‘-‘

Debug Information Debug information Format:
## [CREG_CGREG_SOC1_SOC2_FW]
CREG: GSM registration status



## 22
## V1.2.0
CGREG: GPRS registration status
SOC1: Primary Socket status
SOC2: Secondary Socket status
Refer Table 9 for socket status
information
Checksum Packet checksum (CRC32) ABCDABCD
## End Character * *

## Miscellaneous Field 1
This field carries special alert data e.g. RFID, iButton or any event based external sensor. The data
depends on what features are enabled in the device. The field is prefixed by the type of data being sent
on server.
e.g. For RFID, this field will send “RFID|Card_ID”, the data is separated by pipe “|”.
## Miscellaneous Field 2
This field is dedicated to CAN data. When the CAN feature is enabled, this field will carry pipe “|”
separated data prefixed with “CAN” header. The number of fields in the data is dynamic based on
configuration of CAN.
e.g. “CAN|data1|data2|data3|data4|error_code”
When error_code is non-zero, the data is considered invalid. Each data field will individually indicate
whether data is valid or not by displaying “N” instead of numeric data. While processing at server end,
data should not be stored or processed when it is “N”.
## Miscellaneous Field 3
This field is dedicated to fuel sensor data, prefixed with “FUEL” header and data fields are separated by
pipe “|”. When fuel sensor is enabled, the following data will be present in the field.
e.g. FUEL|src|level|(sensor specific data, if any)|error_code
SRC is the fuel sensor type configured. Check section FCFG – Fuel Sensor configuration
level is the fuel level sent by sensor.
The sensor specific data is varies based on sensor used, following section explain the sensor specific data
fields.
error_code defines if the data in the field is valid or not. When error_code is zero, the data is valid else
data is invalid.



## 23
## V1.2.0
## Table 12: Fuel Sensor Data Information
## Sensor Type Field Type Description
Common Field Sensor ID This is a common field. Current fuel sensor source which was
configured by FCFG command
Analog/UART Fuel Level Current fuel level
## Omnicomm
## ESCORT
## (RS485/RS232)
Fuel Level Current fuel level
Temperature Temperature value as sent by sensor
Frequency Frequency value sent by sensor
ESCORT BLE Fuel Level Current fuel level
Sensor ID Sensor ID, e.g., BLE sensor ID is MD_1234; 1234 will be sent
to the server.
Battery Voltage Sensor battery voltage
Temperature Temperature value as sent by sensor
MIELTA BLE Fuel Level Current fuel level
Sensor ID Sensor ID, e.g., the BLE sensor ID is MD_1234; 1234 will be
sent to the server.
Level % Level value in percent as sent by sensor
Battery voltage Sensor battery voltage
Temperature Temperature value sent by sensor
Accel Z Angle value
Flags Sensor stability Bit fields as per protocol

Fuel sensor sample packet as per sensor type configured:
Analog/UART
## FUEL|[1/3]|LEVEL|ERROR
1 for Analog
3 for UART
Omnicomm/ESCORT wired sensor
## FUEL|2|LEVEL|TEMP|FREQ|ERROR
## ESCORT BLE
## FUEL|7|LEVEL|ID|VOLT|TEMP|ERROR
## MIELTA BLE
## FUEL|8|LEVEL|ID|LEVEL%|VOLT|TEMP|ACCZ|FLAGS|ERROR

Error value 255 means sensor is not connected or not communicating. A zero-error value means data is
valid for server to accept.



## 24
## V1.2.0
## Miscellaneous Field 4
This field is dedicated to digital Temperature or Temperature + humidity sensors. When the sensor is
enabled, following data is sent in the Misc. field 4:
“TEMP|temperature|alarms|error_code”
Temperature is sent in Celsius as a decimal value with two decimal points.
Alarm field is a bit wise field with two bits representing high or low alarm.
## Bit 1 Bit 0
## Temperature High Alarm Temperature Low Alarm

e.g., when value is 1 – Temperature low alarm is active, when value is 2 - Temperature high alarm is
active and 0 represents no active alarm.
Error code tells whether the data in the field is valid (when 0) or invalid (non-zero).

"When the temperature and humidity sensor is used, the following data is sent:
“TRH|temperature|humidity|alarms|error_code”
The header TRH indicates that a temperature and humidity sensor is used.
Temperature is a decimal value with two decimal points.
Humidity is relative humidity value in percentage.
Alarm field is a 4bit field with lower two bits representing temperature alarms and upper two bits
representing temperature high alarm.
## Bit 3 Bit 2 Bit 1 Bit 0
Humidity High Alarm Humidity Low Alarm Temperature High Alarm Temperature Low Alarm




## 25
## V1.2.0
AIS140 Configuration Commands
Device supports configuration that can be done from either server or via SMS. As per AIS-140 standard
device must support commands to SET, GET and CLR for setting, getting, and clearing a device
configuration. Command format for setting parameter is:
[SET]<space>[Key:Value]
To get parameter value:
[GET]<space>[Key]
To clear parameter:
[CLR]<space>[Key]
You can operate on multiple keys e.g.
[SET]<space>[Key1:value],[Key2:value]
## Similarly,
[CLR]<space>[Key1],[Key2]
Commands sent via SMS are sent with passwords as shown:
password,[SET]<space>[Key:Value]
password,[GET]<space>[Key1],[Key2]
password,[CLR]<space>[Key1],[Key2]
E.g., If password is “tnavic”. then commands can be sent as:
tnavic,[SET]<space>[Key:Value]
tnavic,[GET]<space>[Key1,[Key2]
tnavic,[CLR]<space>[Key1][Key2]

Supported keys and their usage is explained further in this section.
## Configuration Keys
- PIP – Primary IP
Set Primary server IP for sending data
## Usage:
PIP:[IP/Domain]
## E.g. –
PIP:example.com or PIP:123.123.123.123
- PPT – Primary Port
Set primary server port
## Usage:
PPT:[Port Number]


## 26
## V1.2.0
- EIP – Emergency IP
Set emergency server IP, Refer PIP – Primary IP for usage.
- EPT – Emergency Port
Set emergency server port, Refer PPT – Primary Port for usage.
- SIP – Secondary IP (Customer Server)
Set secondary server IP, Refer PIP – Primary IP for usage.
- SPT – Secondary Port (Customer Server)
Set secondary server port, Refer PPT – Primary Port for usage.
- AIP – Alternate IP (Alternate Govt. Server)
Set alternate server IP, Refer PIP – Primary IP for usage.
- APT – Alternate Port (Alternate Govt. Server)
Set alternate server port, Refer PPT – Primary Port for usage.
- M0 – Emergency/Backend Server Number
Emergency/Backend server SMS Number
## Usage:
M0:[Mobile number with +91]
- EO – Emergency OFF
Emergency OFF or stop emergency message. Only set is allowed with this key.
## Usage:
## SET EO
- ES – Emergency Status
Get emergency status, only “GET” is allowed with this key.
## Usage:
## GET ES
- ED – Emergency Duration
Emergency timeout duration in minutes. Default is 30 minutes
## Usage:
ED:[Duration in minutes]
The minimum allowed value for duration is 1 minute.
- APN – Network APN
Set network access point name, default automatic
## Usage:
APN:[Network APN]


## 27
## V1.2.0
To use auto APN detection set network APN to auto:
APN:auto
- ST – Sleep Time
Time (in minutes) after which device goes in sleep mode. Default 3 minutes
## Usage:
ST:[Time duration in minutes]
Minimum value allowed in 1 minute.
- SL – Speed Limit
Set Speed limit in km/h. Default 70km/h
## Usage:
SL:[Speed Limit]
- HBT – Harsh break Threshold
Harsh break limit in g (m/s
## 2
## ). Default 0.55g
## Usage:
HBT:[Value in g]
- HAT – Harsh Acceleration Threshold
Harsh acceleration limit in g (m/s
## 2
## ). Default 0.43g
## Usage:
HAT:[Value in g]
- RTT – Rash Turning Threshold
Rash turning threshold in km/h. Default 30km/h
## Usage:
RTT:[Speed Limit during turning]
- LBT – Low Battery Threshold
Low battery threshold in percentage. Default 20
## Usage:
LBT:[Value in percent]
- VN – Vehicle Registration Number
Vehicle registration number
## Usage:
VN:[Registration Number]
- URS – Update Rate Sleep Mode
Update duration/data rate in minutes when vehicle is in sleep mode. Default 60 minutes.
## Usage:
URS:[Value in minutes]


## 28
## V1.2.0
- PIN – Update Rate Ignition ON
Update duration/data rate in seconds when Ignition is ON. Default 60 seconds.
## Usage:
PIN:[Value in sec]
Minimum 5 sec allowed.
- PIF – Update Rate Ignition OFF
Update duration/data rate in seconds when Ignition is OFF. Default 60 seconds.
## Usage:
PIF:[Value in sec]
- URE – Update Rate Emergency
Update duration or data rate in seconds for emergency packet. Default 60 seconds.
## Usage:
URE:[Value in sec]
Minimum 5 sec allowed.
- URH – Update Rate Health Packet
Update duration or data rate in minutes for health monitoring packet. Default 60 minutes.
## Usage:
URH:[Value in Minutes]
- VID – Vendor ID
Set vendor ID as per AIS-140. Default TNOWTN
## Usage:
VID:[vendor ID]
- FV – Firmware Version
Get firmware version, only get operation is allowed.
## Usage:
## GET FV
## 28. M1 – User Mobile Number 1
Set SMS number 1
## Usage:
M1:[mobile number with +91]
## 29. M2 – User Mobile Number 2
Set SMS number 2
## Usage:
M2:[mobile number with +91]


## 29
## V1.2.0
## 30. M3 – User Mobile Number 3
Set SMS number 3
## Usage:
M3:[mobile number with +91]
- PWD – Password Change
Set SMS/Console password.
## Usage:
PWD:[New password]
- SEN – SMS Enable
SMS response enable, this will enable SMS response when you do GET command via SMS.
## Usage, To Enable:
## SEN:1
## To Disable:
## SEN:0
- GP1/GP2 – Control GPO line
This key is used to control the general-purpose output line.
Usage, to set high:
## GP1:1
Set low:
## GP1:0
- TA – Tilt Angle
Set minimum Tilt Angle (in degrees) for generating alert. Default 45 degree
## Usage:
TA:[Value in degrees]
- TBT – Turn by Turn Tracking
Enable turn by turn packet, useful when data rate is longer. Default on.
## To Enable:
## TBT:1
## To Disable:
## TBT:0
- RL – Relay Control
To turn on/off relay control line.
## To Turn On:
## RL:1
## To Turn Off:
## RL:0


## 30
## V1.2.0
- ODM – Set Odometer
This command can be used to reset the odometer or set the odometer to a value. The value is in
kilometers and can be floating point.
## Usage:
ODM:<value>
E.g.: ODM:123.45
To reset, simply set value to 0.
e.g.: ODM:0
- BED – Box Event Disable
This command can be used to disable box open events.
## To Disable:
## BED:1
## To Enable:
## BED:0
- TZN – Change Packet time zone
This command is used to set packet time zone for secondary IP. The default time zone is UTC. Primary IP
must have UTC time zone as per AIS140 standard, so this command does not affect Primary packet.
## To Set Indian Standard Time:
## TZN:IST
## To Set Coordinated Universal Time:
## TZN:UTC
- S1 – Authorized SMS Number 1
This command is used to set pre-authorized SMS senders to be allowed to send SMS commands without
need of any password. Usually required for preconfiguring SMS gateway numbers etc. Default value is
## “VLTOTR”.
## Usage:
S1:[Number/Gateway Name]
- S2 – Authorized SMS Number 2
Like S1, this command is for SMS number 2. Default value is “VLTEMG”.
## Usage:
S2:[Number/Gateway Name]
- S3 – Authorized SMS Number 3
Like S1, this command is for SMS number 3.
## Usage:
S3:[Number/Gateway Name]


## 31
## V1.2.0
- RST – Reset Device
To reboot device using SET command. Can be sent at the end of all commands. Device will reboot
automatically after 10 sec.
## Usage:
## RST
To use this command along with other commands just send as shown:
SET PIP:example.com,PPT:1234,RST
- MOD – Set packet mode
Configure primary data packet mode as per state protocol
## Usage:
MOD:<mode value>
Mode value can be following:
0 – Normal packet
1 – NIC packet format
2 – DIMTS packet format
3 – MP packet format
4 – BSNL portal packet format
5 – ICAT packet format
6 – ARAI packet format
7 – Gujarat packet format
8 – Andaman/NIC Alternate packet format
9 – FCI packet format
10 – Maharashtra packet format
11 – Odisha packet format
More formats may be added as and when firmware is updated as per state protocols
- AMOD – Set packet mode for Alternate IP
Configure alternate server data packet mode as per state protocol. Check MOD – Set packet mode for
supported state protocols.



## 32
## V1.2.0
- GF – Configure Geofence
Device supports up to 10 multipoint geofences which can be configured individually.
## Usage:
GF:Geofence ID-Alert type-latitude-longitude#latitude-longitude#latitude-longitude&
Geofence ID: Index/location of geofence to be stored in device, ranges from 1 to 10.
Alert Type: Selects alert to be generated for configured geofence. Possible values are: 1 for entry alert, 2
for exit alert and 3 for entry and exit both.
After alert type, geofence points are to be provided in “latitude-longitude” format, each point ends with
a hash (“#”) and last point should end with an ampersand (“&”).
E.g., SET GF:1-1-078.12345678-078.12345678#080.12345678-080.12345678#098.12345678-
## 098.12345678&
To configure more than one geofence in single command, just append information starting with
“Geofence ID”.
E.g., SET GF:1-1-078.12345678-078.12345678#080.12345678-080.12345678#098.12345678-
098.12345678&2-1-078.12345678-078.12345678#080.12345678-080.12345678#098.12345678-
## 098.12345678&
To Delete a configured geofence:
GF:Geofence ID-delete
E.g., SET GF:1-delete

To clear all configured geofences at once:
## CLR GF



## 33
## V1.2.0
## Special Configuration Commands
## 10

The new AIS140 device supports external device interface which can be used to connect sensors likes
Temperature, humidity, fuel sensors etc. Device also supports readers like RFID, iButton, or Biometric
Fingerprint readers. There are special commands to configure such devices and are only available if the
specific external device is connected and the right firmware is installed on the device. All configuration
commands when sent via SMS requires SMS password to be prefixed as shown below:
## [password],[command]
E.g., if password is “tnavic”. So, SMS command format with password becomes:
tnavic,[command]
If configuration command is sent via server, no password is required.
- Time – Set/Get system time
This command is used to set or get system time or update NTP server for internet time sync.
## Usage:
TIME=[timestamp] – Set system time, Timestamp is a Unix timestamp.
TIME=server,[NTP server] – Set NTP server. Default value is “service.logicrom.com”
- DPWD – Set/change distributor password
Change distributor level password, can only be configured by distributor or manufacturer
DPWD=<new password>
- ADCTUNE – Set ADC parameters
This command is used to set ADC algorithm tuning parameters and configure offset.
## Usage:
ADCTUNE=<level> - Approximation level range from 0 – 10. Default is 2.
ADCTUNE=offset,<value> - Set ADC offset
- SIM – Get SIM ICCID
Command to get current ICCID value of SIM. This command requires no parameter.
- OFR – Clear Offline Data
This command is used to clear or reset offline storage.
## Usage:
OFR=<type>
Type selects type of storage to be cleared, the possible values are:

## 10
Some of the commands may not be supported currently on the firmware. But documentation kept for reference.


## 34
## V1.2.0
1 – Clear Primary storage
2 – Clear Secondary storage
3 – Clear both primary and secondary storage.
- DNSCFG – configure custom DNS server
## Usage:
DNSCFG=<pri>,<sec>
Where pri is primary DNS server, and sec is secondary DNS server. By default, network provider DNS
server is used.
DNSCFG=reset
to reset DNS server to default
- GPR – Reset GPS chipset
This command is to power reset the GPS module. This command requires no parameter.
- MPACK – Set multipacket configuration
Set number of offline packets to be sent at once.
## Usage:
MPACK=<number>
Where number is value between 1 to 10. The fault is 4.
- BUZZ – Set buzzer configuration
Enable or disable buzzer for event
BUZZ=<key>,<on/off>
Where key can be:
TA – Tilt alert
EMR – Emergency
SL – Overspeed limit
USR – user control
BUZZ=duration
Enable buzzer for a duration specified in seconds
- BTYPE – Set buzzer type
Configure buzzer type connected to device
## BYTE=<0/1>
0 – For beeper type
1 – For hooter type
- FRESET – Factory reset device
Reset device to original factory state, this will clear all configuration and offline data.


## 35
## V1.2.0
## Usage:
FRESET=confirm
- NWINFO – Get network information
Get network related information from device. Device will respond in following format
## Usage:
## NWINFO
## Response Format:
## IM: <IMEI>
OP: <operator name>
GSM: <Signal Strength>,<CREG>,<CGREG>
APN: <current APN in use>
CON: <connection status of PRI>,<SEC>,<EMR>
CELL: <cell site information MCC>,<MNC>,<LAC>,<CELLID>
- IMU – Configure Inertial Measurement Unit
This command is used to configure and calibrate the IMU on board
## Usage:
IMU=<operation>,<value>
Where operation can be following:
THR – Set motion detection threshold, default 0.05g
TA – Tilt alert threshold value in degree, default 45
MA – IMU motion assistance for GPS movement, enabled by default
HTA – Harsh turning threshold value, default 0.47g
CLR – clear settings and reset to default
RST – reset current position as base position, this should be done after mounting
DBG – to enable IMU debugging
CAL – Do sensor calibration, more details follow
EVT – Sensor based event enable/disable, enabled by default
LAB – Enable or disable lab mode, for bench testing (make sure to clear this for field, if enabled)
IMU Calibration
There are two parts of IMU calibration, and it should be done in one by one as explained:
A. IMU Sensor calibration
a. Lay device flat on bench with sensor facing up
b. Run calibration command IMU=CAL,1
c. Calibration will finish and calibration values will be displayed on screen
d. Step b can be repeated if needed
B. IMU Position calibration
a. Place the device on bench as it would normally orient in the box
b. Run calibration command IMU=CAL,2


## 36
## V1.2.0
c. It will take approx. 10s to find stabilized values for IMU positioning
When the device is mounted on vehicle, do reset position once using IMU=RST. Let the device find its
current position.
- IMCONF – Immobilizer Configuration
This command is used to configure advanced configuration for relay control. To automate immobilizer
control based on access control or timeout.
## Command Format:
IMCONF=<Operation>,<Type>,<arguments...>
Operation can be “set” or “get to set or get the configuration value, respectively.
Type defines the configuration on which operation to be performed and based on type the argument list
is decided. Following are the types:
CTL: Control Configuration
This configuration is used to set the source of control for Immobilizer. The source can be as follows:
0 – No Source (Default)
1 – Any scanned ID (No validation)

## Usage:
IMCONF=<set/get>,CTL,<source>,[<mode>]
Mode is an optional argument and can be any of the following. The operation mode is only valid when
source is not set to 0 (No Source).
Normal: This is the default mode of operation. In this mode immobilizer is disabled when a valid ID is
found or STARTV command is sent to the device. Immobilizer is enabled again after ignition is turned off.
Toggle: In this mode, immobilizer will be enabled if it was disabled previously or disabled if enabled
previously by showing a valid ID to the reader. Ignition has no effect when this mode is selected.
TOUT: Normal Mode Timeout
This command configures timeout value (in seconds) to auto turn-on immobilizer. The default value is 60
seconds. When Immobilizer is disabled via a control source and ignition is not turned on within
configured timeout value, Immobilizer will get turned on again automatically.
## Usage:
IMCONF=<set/get>,TOUT,<timeout>
Timeout is value in seconds, default value is 60 seconds, and minimum value is 10 seconds. To disable
the timeout feature set this value to 0.
- SENSOR – Control Temperature Sensor
This command is for configuration of temperature sensor.
## Usage:
## Sensor=<command>,<value>


## 37
## V1.2.0
Commands are as follows:
## Enable:
To enable or disable temperature sensor.
## Usage:
sensor=enable,<1/0>
1 to enable and 0 to disable the sensor.
## Reset:
This command is used when replacing or changing temperature sensor. When the old sensor is replaced
with new sensor, reset command is sent to search for newly connected sensor.
## Usage:
sensor=reset
## Offset:
This command is used to configure sensor offset.
## Usage:
sensor=offset,<value>
here value can be positive or negative decimal value, default value is 0.
e.g. sensor=offset,-1.25
- TEMPTH – Configure Sensor Threshold
This command is used to configure sensor alarm threshold values.
## Usage:
TEMPTH=high_threshold,low_threshold
Threshold values can be a floating-point value with a default of 50 and -50 degree Celsius respectively.
e.g. TEMPTH=43.25,10
here high threshold is set at 43.25 °C and low threshold is set at 10 °C.
An alert packet is generated when temperatures cross any threshold.
- FCFG – Fuel Sensor configuration
This command is used to configure fuel sensors supported by device.
## Usage:
FCFG=[Operation],[Value...]
The operation is the sub-command to run for fuel configuration. Based on operation value and
parameter count can be different. Operations are explained below
SRC: Sensor Type
Device supports 5 different types of sensors which are pre implemented in the firmware.
FCFG=SRC,<type>
Type is as follows:


## 38
## V1.2.0
## 1 – Analog Sensor
2 – Omnicomm/ESCORT RS485 Digital sensor
3 – UART type sensor
7 – ESCORT BLE Sensor
8 – MIELTA BLE Sensor
PORT: Serial port configuration
Sensors which connect over serial/Modbus require port parameters to be configured.
FCFG=[Baud],[Com parameters]
Baud is Baud rate of com port. Default is 19200
Com parameters are serial port communication parameters like data bits, parity, stop bits etc. The
parameters are given in the following format.
[Data bits][Parity][Stop bits]
Data bits: 7 or 8
Parity: n – None, e – Even, o – Odd, m – Mark, s – Space
Stop bits: 1 or 2
The default value is 8n1 for 8 bits, no parity and 1 stop bit.
ENABLE: Enable/Disable fuel sensor feature
This command is used to enable or disable fuel sensor.
## FCFG=ENABLE,<0/1>
SID: Slave ID
For RS485 based sensor, slave id is required.
## FCFG=SID,<ID1>
ID1 default value is 1.
OFF: To set sensor offset value
FCFG=OFF,<value>
Value is the offset to sensor reading can be positive or negative. Default 0.
CTL: Fuel data post process control
To smooth out any data abnormalities caused by vehicle motion etc., the data is post-processed inside
the device before it is sent to server. This setting enables or disables post processing of sensor data.
Default is off.
## FCFG=CTL,<0/1>
## 0 – Off, 1 – On
FIL: Post process level
This operation controls the level of post processing done on data. Higher the value, slower will be the
response to change in data. Default level is 2.


## 39
## V1.2.0
FCFG=FIL,<level>
The level can be anywhere from 0 to 10.
RESET: Reset Settings
This operation will reset fuel sensor settings stored on device to default.
BLEID: Set BLE Sensor ID
Configure BLE Fuel sensor with device.



## 40
## V1.2.0
## Service Commands
Service commands can be sent directly to the device to get Information about status and other device
specific tasks. Passwords must be sent along with commands unless otherwise mentioned.
- STG – Device Settings
It is a service level command which can be shared with the installation person without issue. This
command is used to verify current device setting and get software information. This command is only
allowed over SMS and does not require a password.
Response format:
## IM: <IMEI>
P: <Primary server IP/URL>:<Primary server port>
S: <Secondary server IP/URL>:<Secondary server port>
E: <Emergency server IP/URL>:<Emergency server port>
SW: <Software version>
- TEST – Device Operation Status
This command is used to get device runtime information. This command is only allowed over SMS and
requires no password.
## Response Format:
## IM: <IMEI>
GP: <GPS Status>
MV: <Main power status>
BT: <Battery voltage>
SIG: <signal strength>
PW: <Power Status>
BX: <Device open/close>
IGN: <Ignition Status>
IO: <GPI or GPO value>
AD: <Analog 1 value>, <Analog 2 value>
- NWINFO – Get Network Information
This command is to get the current network status of the device. This command does not require a
password.
## Response Format:
## IM: <IMEI>
OP: <Operator Name>
GSM: <Signal Strength>,<CREG>,<CGREG>
APN: <Current APN>
CON: <Primary CON>, <Secondary CON>, <Emergency CON>
## CEL: <MCC>, <MNC>, <LAC>, <CELL ID>
For understanding CON value, please check Table 9: Socket State Information


## 41
## V1.2.0
- WHERE – Locate Device
To get current device location information. Only applicable via SMS.
- ACTV – Activation Message
Activation Message Request Format from the Backend System to the Device. This is AIS140 specific
command and may not be used by the user.
Format: ACTV,[Random Code],[SMS Reply Number]
For response format, please check Activation Message and Health Check Message Protocol.
- HCHK – Health Check Message
Health Check Message Request Format from the Backend System to the Device. This is AIS140 specific
command and may not be used by the user.
Format: HCHK,[Random Generated ID],[SMS Reply Number]
For response format, please check Activation Message and Health Check Message Protocol.
- NWSWITCH – Network Management
Embedded sim multiple profiles can be managed via this command. You can switch between
primary/secondary networks. You can also enable or disable auto network switching. This command
requires an SMS password to be sent along with it if this command is sent via SMS. From the server you
can send this command without password.
Usage via SMS:
[SMS Password],NWSWITCH=[Operation]
Usage via Server:
NWSWITCH=[Operation]
Command operations are explained below, please add password as mentioned above if sent via SMS.
To select Primary network:
NWSWITCH=primary
To select secondary/fallback network:
NWSWITCH=secondary
## To Disable Auto Switching:
NWSWITCH=auto,enable
## To Disable Auto Switching:
NWSWITCH=auto,disable



## 42
## V1.2.0
- IDENTIFY – Get Device Identity
This command can be used to get information like device cell number, IMEI, SIM ID, IMSI etc. This
command can be sent from anywhere.
## Usage:
identify=<reply number with +91>
e.g.: identify=+919876543210
Device will respond in following format:
<Device ID>,<IMEI>,<IMSI>,<SIM ID/ICCID>,<Current Firmware Code>
e.g.: 1234567890123,123456789012345,404041042202747,12345678901234567890,FW
- SIMLOCK – Lock SIM with Device
Enable or disable SIM lock. This command will bind the SIM card installed with device, if SIM card is
removed or replaced without authorization, system will be locked and not operate.
## Usage:
simlock=<1/0>
- FOTA – Firmware Upgrade
This command is used for Over the air firmware upgrade. This command is allowed via SMS and TCP.
Password is mandatory for this command to work over SMS.
Usage via SMS:
[SMS Password],fota=<firmware_URL or command>
Usage via Server:
fota=<firmware_URL or command>
Commands can be:
Check – To check for new version
Update – Update new version if available
Download – Force downloads new or current version
Please contact the support team to get the right firmware filename for the device.
Installing the wrong firmware might cause permanent damage to the device in the field.