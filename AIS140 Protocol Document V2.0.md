

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 1







## AIS140

## Protocol

## Document


## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 2








## LOGIN DATA STRING

## Field # Name Value Description
## #
## Bytes
## 1. $

Starting Character of String 1
- Vehicle No TN1AAC1122 Vehicle registration no 10
- IMEI Number

Unique code for unit identification 15
- Firmware Version 1.0.9 Tracker firmware version 6
- Protocol Version 1.0 Tracker protocol version 3
- Latitude 28.758812 Converted In degree and minutes 9
- Latitude Direction ‘N’ or ‘S’ ‘N’ = North
‘S’ = South
## 1
- Longitude 77.712408 Converted In degree and minutes 9
- Longitude Direction ‘E’ or ‘W’ ‘E’ = East
‘W’ = West
## 1
## 12.
## End Character $  1
## Separator $
All fields are delimited by a dollar 8

Example: $TN3CBZ1122$864376047795371$1.0.9$1.0$28.651379$N$77.092681$E$

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 3


## GENERAL DATA STRING




## Field # Name Value Description
## #
## Bytes
## 1. $

Starting Character of String 1
- Packet Header 10(NORMAL)200(HISTOR
## Y)
The header of the packet/identifier 3
- Vendor ID APMK Unique vendor specific Id 4
- Firmware Version 1.0.9 Tracker firmware version 6
## 5. Packet Type
2-byte Data as per data
type
NR = Normal
EA = Emergency
Alert TA = Tamper
## Alert
HP = Health
Packet IN =
## Ignition On
IF = Ignition Off
BD = Vehicle battery
disconnect BR = Vehicle
battery reconnect
BC = Internal battery charged
again BL = Internal battery low
HB = Harsh braking
HA = Harsh
acceleration RT =
Rash turn
PC = Parameter
Change OS = OVER
## SPEED
## TL = TILT
## 2

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 4



- Alert ID 0 to 15 01 = Location update
02 = Location update (history)
03 = Alert – Disconnect from main
battery 04 = Alert – Low battery
05 = Alert – Internal battery charged
again 06 = Alert – Connected to main
battery
## 07 = Alert – Ignition
ON 08 = Alert –
Ignition OFF
09 = Alert – Box opened
## (optional) 10 = Alert –
Emergency state ON
## 2

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 5




11 = Alert – Emergency state OFF
12 = Alert – Over the air parameter
change 13 = Alert - Harsh braking
## 14 = Alert - Harsh
## Acceleration 15 = Alert -
## Rash Turning
## 16 = Alert - Device
## Tampered 17 = Alert -
## Over Speed
## 18 = Alert – Tilt

- Packet status ‘L’ or ‘H’ Live (L) data or History (H) Data 1
- IMEI Number

Unique code for unit identification 15
- Vehicle No TN3CBZ1122 Vehicle registration no 10
- GPS Fix ‘1’ or ‘0’
‘1’ = GPS Fixed
‘0’ =GPS Not Fixed
## 1
- Current Date Ddmmyyyy From GPS RMC packet 8
- Current Time Hhmmss UTC Time 6
- Latitude 28.758812 Converted In degree and minutes 9
- Latitude Direction ‘N’ or ‘S’ ‘N’ = North
‘S’ = South
## 1
- Longitude 77.712408 Converted In degree and minutes 9
- Longitude Direction ‘E’ or ‘W’ ‘E’ = East
‘W’ = West
## 1
- Speed Floating-Point (XXX.Y) Speed over ground in km 6
- Head Degree 310.56 From RMC 6
- Number of Satellites 0 – 24 From GGA packet 2
- Altitude 183.5 From NMEA packet 6
- PDOP 1.8 Positional dilution of precision 5
- HDOP 1.0 Horizontal dilution of precision 5
- Network Operator Name Airtel Name of network operator 8
- Ignition Status 0/1 0 = Ignition OFF
1 = Ignition ON
## 1

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 6



## 25. Mains Power Status 0/1
## 0 = Mains Disconnected
## 1 = Mains Connected
## 1
- Mains Input Voltage 12.1 Vehicle battery voltage in volts. 4

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 7



- Internal Battery Voltage 4.0 Internal Li-ion Battery voltage in volts. 4
- SOS status
(Emergency)
## 0/1
## 0 = SOS OFF
## 1= SOS ON
## 1
- GSM Signal Strength 0 – 31 In dBm 2
- MCC 404 Mobile country code 3
- MNC 10 Mobile network code 3
## 33  LAC  04F5
## 4
34  Cell Id  b1fb
## 4
35  Neighbour Id 1  b1fa
## 4
## 36  Lac 1  04f5
## 4
## 37  Signal Strength 1  82

## 2
38  Neighbour Id 2  fa53
## 4
## 39  Lac 2  04f5
## 4
## 40  Signal Strength 2  94
## 2
41  Neighbour Id 3  b95d
## 4
## 42  Lac 3  04f5
## 4
## 43  Signal Strength 3  96
## 2
44  Neighbour Id 4  fa53   4
## 45  Lac 4  99   4
## 46  Signal Strength 4  94   2
47  Digital Input status  0000(refer table 1.1)   4
48  Digital output status  00(refer table 1.2)   2
49  Frame Number  901(000001 to 999999) this
is unique value
## 6

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 8


50  Checksum  C86B(Optional) Insures
No error in transmission
## 4
## 51  End Character  *
## 1

Delimiter , All fields are delimited by a comma 49


## EXAMPLE:
$,10,APMK,1.1.2,NR,01,L,869247045236301,kl23m212,0,23112020,154924,0.0,N,0.0,E,0,0,0,0,0,0,VODAFONE,0,1,14.0,4.1,0,31,
404,84,C775,5510,5664,C775,31,563D,C775,31,556B,C775,31,5DE4,C792,31,0000,00,002185,0033,*

## DIAGNOSIS DATA

## Field # Name Value Description
## #
## Bytes
## 1. $

Starting Character of String 1
-  Header 500 Header Of the String 3
- IMEI Number
## 876756454343434
Unique code for unit identification 15
- ICCID  89767564567890987676 ICCID Number 20
- DATE Ddmmyyyy DATE  8
- TIME Hhmmss TIME 8
## 7. FLASH 0 FLASH VALUE 6
## 8.
## ACC/GYRO
## 0 SENSOR VALUES 9
## 9.
Additional data 1
## 1
- Additional data 2   9
## 12.
Delimiter $ All fields are delimited by a comma 9



## $,500,869247045236301,89910473121803853296,23112020,153408,0,0,1131,,*

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 9




## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 10



## HEALTH DATA STRING

## Field # Name Value Description
## #
## Bytes
## 1
## $

Starting Character of String 1
## 2
## Packet Header
101   Health Packet ID
## 3
## 3
Vendor ID APMK Unique vendor specific Id 4
## 4
Firmware Version 1.0.9 Tracker firmware version 6
## 5
IMEI Number

Unique code for unit identification 15
## 6
Battery percentage 65 Indicates internal battery charge percentage 3
## 7
Low battery
threshold value
10 Indicates value on which low battery alert generated in percentage 3
## 8
Memory percentage 41 Indicates flash memory percentage used 3
## 9
Iginition Data interval 10 Packet sending frequency in seconds (when Ignition ON) 4
## 10
Normal Data interval 60 Packet sending frequency in seconds (when Ignition OFF) 4
## 11
Digital I/O status 1111 Indicates inputs connected to device. 4
## 12
Analog1 I/O status 0.02 Analog input1 status 4
## 13
Analog2 I/O status 0.05 Analog input2status 4
## 14
End character * Denotes end of message 1

Delimiter , All fields are delimited by a comma 13

## EXAMPLE: $,101,APM,1.0.9,869247046143589,100,30,0,10,60,1000,0.4,0.4,*

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 11



Activation & Health Check Response SMS & SERVER Format

## Field Field Name
## Activation
## Exp
Health check Exp
## #
## Bytes
- Header ACTVR HCHKR 5
- Random code 654343 654343 6
- Vendor ID

## APMK

## APMK

## 4
- Firmware version 1.0.9 1.0.9 6
## 5. IMEI 012345678912345 012345678912345 15
- Alert ID 17 17 2
## 7. Latitude 28.651393
## 28.65139
## 3
## 9
## 8. Direction N N 1
## 9. Longitude 77.092660 77.09266
## 0
## 9
## 10. Direction E E 1
- GPS fix 1 1 1
- Date and Time 16112018 120317 16112018 120317 15
## 13. Heading 263.19 263.19 6
## 14. Speed 25.4 25.4 6
- GSM Strength 23 23 2
## 16. (MCC) 404 404 3
## 17. MNC 10 10 3
## 18. LAC D6D6 D6D6 4
## 19. Main Power 1 1 1
- IGN Status 1 1 1
## 21. Battery Voltage 24.6 24.6 4
## 22. Frame Number 100000 100000 6
- Vehicle mode IN IN 2
Separator All fields are delimited by a comma All fields are delimited by a 22

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 12




## Comma


## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 13





## ACTV - EXAMPLE:

## ACTVR,654343, APM,1.0.9,864376047795371,17,28.651387,N,77.092746,E,1,23092019
## 053004,0.0,0.0,22,404,04,00F1,1,0,4.0,000007,NR
## HEALTH - EXAMPLE:
HCHKR,123456, APM,V1.0.6,864376047795371,17,28.651387,N,77.092746,E,1,23092019 053004,0.0,0.0,22,404,04,00F1,1,0,4.0,000009,NR

## EMERGENCY ALERT DATA
## STRING (VLT TO
## CONTROL CENTER)
## Field # Name Value Description
## #
## Bytes
## 1. $

Starting Character of String 1
- Header EPB The header of the packet/identifier 3
- Message Type EMR Emergency Message 3
- IMEI Number

Unique code for unit identification 15
- Packet status ‘NM’ or ‘SP’ NM – normal packet, SP – stored packet 2
## 6.
Current Date and
## Current
## Time
Ddmmyyyyhhmmss(UTC
## Format)
From GPS RMC packet 14
- GPS Fix ‘A’ or ‘V’ ‘A’ = GPS Fixed
‘V’ =GPS Not Fixed
## 1
- Latitude 28.758812 Converted In degree and minutes 9

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 14


- Latitude Direction ‘N’ or ‘S’ ‘N’ = North
‘S’ = South
## 1

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 15



- Longitude 77.712408 Converted In degree and minutes 9
- Longitude Direction ‘E’ or ‘W’
‘E’ = East
‘W’ = West
## 1
- Altitude 183.5 From NMEA packet 6

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 16



- Speed Floating-Point (XXX.Y) Speed over ground in km 6
- Distance 0.12 Distance calculated from previous GPS data 6
- Provider ‘G’ or ‘N’ G – fine GPS, N – coarse GPS or data from network 1
- Vehicle No TA1AAC1122 Vehicle registration no 10
- EMG Reply no 0 Emergency no as specified by MHA/MoRTH/States 1
- End character * Denotes end of message 1
- Checksum A1 Insures no error in transmission 4
Delimiter , All fields are delimited by a comma 18




## EXAMPLE: SOS ON

$,EPB,EMR,867459044086320,NM,28092019095458,A,28.651663,N,77.092813,E,154.4,0.0,152.42,G, TA1AAC1122,0,*,0085

## EXAMPLE: SOS OFF

$,EPB,SEM,867459044086320,NM,28092019095458,A,28.651663,N,77.092813,E,154.4,0.0,152.42,G, TA1AAC1122,0,*,00A5

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 17



## OVER THE AIR PARAMETER
## CHANGE ALERT DATA
## STRING



## Field
## #
## Name Value Description
## #
## Bytes
## 1. $

Starting Character of String 1
- Packet Type PC PC = Parameter Change 2
- Alert ID 12 Alert ID 2
- IMEI Number

Unique code for unit identification 15
- Mode ‘0’ or ‘1’ 0 – Command via SMS
1 – Command via Server
## 1
- Mobile no / IP string mobile no/ IP of control center sending commands 15
- Current Date ddmmyyyy From GPS RMC packet 8
- Current Time hhmmss GMT Time 6
- Parameter Change string string specify which parameter has changed. UPTO
## 200
- End character * Denotes end of message 1
Delimiter , All fields are delimited by a comma


## EXAMPLE:

## $,PC,12,869247046143589,0,+918939112162,17022020,113930,SETREPORT,*

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 18



## SMS COMMANDS




CHANGE IP ADDRESS 1 and
## PORT NO 1

Cmd: SETIP1 <ip address>*SETPORT1
## <port No>

## Example1:

## SETIP1 192.168.2.1*SETPORT1 9091
OK Response:
## Following Parameters
Changed: IP1 :192.168.2.1
## PORT1 :9091
Not OK: Invalid Input.











CHANGE IP ADDRESS 2 and
## PORT NO 2

Cmd: SETIP2 <ip address>*SETPORT2
## <port No
## >

## Example1:

## SETIP2 192.168.2.1*SETPORT2 9091
OK Response:
## Following Parameters
Changed: IP2 :192.168.2.1
## PORT2 :9091
Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 19





## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 20




CHANGE IP ADDRESS 3 and
## PORT NO 3

Cmd: SETIP3 <ip address>*SETPORT3
## <port No
## >

## Example1:

## SETIP3 192.168.2.1*SETPORT3 9091
OK Response:
## Following Parameters
Changed: IP3 :192.168.2.1
## PORT3 :9091
Not OK: Invalid Input.





## SETAPN OF NETWORK PROVIDER

Cmd: SETAPN <apn>

Example: SETAPN airtelgprs.com OK Response: Apn changed to airtelgprs.com Not OK: Invalid Input.





## SETAUTO APN FLAG

Cmd: SETAUTOAPN <ON/OFF>
Device will set apn automatically as
per network provider (On by default)

Example: SETAUTOAPN ON OK Response: Auto APN is ON now. Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 21




CHANGE DNS 1 and PORT NO
## 1

Cmd: SETDNS1<DNS address>*SETPORT1
## <port No>

## Example1:

## SETDNS1 ABCD.COM*SETPORT1 9091
OK Response:
## Update
## Successfully
Not OK: Invalid Input.








CHANGE DNS 2 and PORT NO 2

Cmd: SETDNS2 <DNS address>*SETPORT2
## <port No
## >

## Example1:

## SETDNS2 ABCD.COM *SETPORT2 9091
OK Response:
## Update
## Successfully
Not OK: Invalid Input.





CHANGE DNS 3 and PORT NO
## 3

Cmd: SETDNS3 <DNS address>*SETPORT3
## <port No
## >

## Example1:

## SETDNS3 ABCD.COM *SETPORT3 9091
OK Response:
## Update
## Successfully
Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 22






## FIRMWARE OVER-THE-
## AIR(FOTA)

Cmd: SETFOTAIP1 <ip1>*SETPORT1
<portNo1>

## Example1:

## SETFOTAIP1 92.168.2.1*SETPORT1 9091
## OK
## Response:
FOTA begin
at: IP:
## 92.168.2.1
## PORT :9091.
Not OK: Invalid Input.





## CHANGE DATA
## SENDING
## INTERVALS

Cmd: SETREPORT*10*60*120*300*10 Note:
- Intervals in seconds.
- You can set
minimum 5
second interval.
ACTIVE MODE – When Ignition
is ON. (Default 10 seconds).
NORMAL MODE – When Ignition is
OFF. (Default 60 seconds).
STANDBY MODE – When Main power
is disconnected and device starts
working on internal battery. (Default
2 minutes) HEALTH INTERVAL –
Device health packet sending
interval. (Default 5 minutes)
EMERGENCY INTERVAL –When SOS
button
pressed. (Default 10 seconds)

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 23


Example1: SETREPORT*10*20*30* *5
OK Response:
## Following Parameters
## Changed: Active : 10
## Normal : 20
## Standby : 30
## Emergency : 5
Not OK: Interval Should Not Be Less
## Than 5.


## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 24




## GET ALL PARAMETERS
Cmd: GETSTATS OK Response:
## Device Parameters
DeviceID :<IMEI NO>
Vehicle  No:  <Vehicle
No> IP1 :aaa.bbb.ccc
PORT1 :aaaaa
## IP2
## :aaa.bbb.ccc
PORT2 :aaaaa
## DNS1:0000
## DNS2:0000
APN :aaaa
## Auto
## APN:0000
## SOS
## NO:00000
Angle Det: ON with Deg:
## Angle Detect
OFF Ignition :
aa Normal : bb
## Sleep Time :
cc Health: dd
Emergency: ee
GSM: <signal strength>
GPSFix: <A-GPS Fixed or V – GPS
Invalid> Sat: <No of satellite>
MainPower: <1- Power connected or 0 - Power
disconnected> Bat: <Li-ion Battery Voltage>
State: <A-Active Mode or N-Normal Mode or S-Standby
mode> GPRS: <GPRS status>
Flash Rec: <No of Flash
records> RTC OK or RTC
## Fail
## Sim
type:ABCD



Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 25




Speed THS
version: 1.0.9

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 26




## FACTORY RESET

Cmd: FACTORYRESET OKResponse: FACTORY RESET
## Successfully☺
Not OK: Invalid Input.



## CLEAR FLASH DATA

Cmd: CLRMEMORY OK Response: Flash Clear Successfully ☺ Not OK: Invalid Input.



## CLEAR IGNITION
## ALERT

Cmd: CLRIGNITIONALERT OK Response: CLRIGNITIONALERT Not OK: Invalid Input.







## CLEAR HARSHACC
## ALERT

Cmd: CLRHARSHACCALERT OK Response: CLRHARSHACCALERT Not OK: Invalid Input.

## CLEAR HARSHBRAKE ALERT

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 27



Cmd: CLRHARSHBRAKEALERT OK Response:
## CLRHARSHBRAKEALERT
Not OK: Invalid Input.




## CLEAR RASHTURN
## ALERT

Cmd: CLRRASHTURNALERT OK Response: CLRRASHTURNALERT Not OK: Invalid Input.



## CLEAR BATTERY
## ALERT

Cmd: CLRBATTERYALERT OK Response: CLRBATTERYALERT Not OK: Invalid Input.





## GET LIVE DATA
## FUNCTION

Cmd: GETLIVE Ok Response:
If server connected.
Live string will send with in 3sec.
Not OK: Invalid Input.

## GETVDETAILS

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 28


Cmd: GETVDETAILS
## Ok

## Response:
## GETVDETAI
## LS
## <FIRMWARE VERSION>
## <DATETIME>,
## < FIRMWARE SIZE>,
## <CHEECKSUM>
Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 29










## STOP EMERGENCY
## FUNCTION


Cmd: STOP_EMG1 OK Response:
Emergency state stopped.
Not OK: Invalid Input.








## SET EMERGENCY NO
## ,VEHICLE NO
## CHASSIS NO

Cmd: SETEMGSMSINFO <Seconds>
## <PHONE>
## <CHASSIS NO> <VEHICLE NO>


## SETEMGSMSINFO 3600
## 9911074767
## MA3ERLF1S00758533
## MH11C4532
OK Response:
Emergency Info set

## Emg No: 92131357222

## Chassis No: 12342653743
Vehicle No: DL4CAB2135
Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 30




## STOP SOS FUNCTION

Cmd: STOPSOSCONFIG OK Response:
SOS feature disabled.
Not OK: Invalid Input.





## START SOS
## FUNCTION

Cmd: STARTSOSCONFIG OK Response:
SOS feature enabled.
Not OK: Invalid Input.



## SIM PROVIDER


## USING TATA SIM

Cmd: SIMUSE_TATA OK Response: Present Sim Using - TATA. Not OK: Invalid Input.

## USING SENSORISE SIM

Cmd: SIMUSE_SENSORISE
OK Response: Present Sim Using -
## SENSORISE.
Not OK: Invalid Input.






## NETWORK SWITCHING

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 31


Cmd: SWITCHNETWORK_SENSE OK Response: Device Reset successfully. Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 32






## DEVICE RESET

Cmd: DEVRESET
OK Response: Device Reset
successfully.
Not OK: Invalid Input.





## GET LOCATION
## INFORMATION

Cmd: TRACK OK Response:
Device ID= <IMEI>,
Vehicle No: <Vehicle
No> GPS Fix= <1/0>,
Sat= <No of
## Satellite>, Date= <
ddmmyy >, Time=
## <hhmmss>,
Lat= <floating-point RMC
value>, Long= <floating-point
RMC value>, Speed= <in km>,
GSM= <signal
strength>, Bat=
<battery voltage>.
Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 33


Example: TRACK

OK Response:
## DEVICE ID= 86712345672211
GPS Fix= 1
## Sat= 8
## Date= 300913
## Time= 110325
## Lat= 28.764111
## Long= 77.052556
## Speed= 25.7
## GSM= 24
## Bat= 3.9
Not OK: Invalid Input.


## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 34








## GET THE MAP LINK

Cmd: GOOGLE OK Response:
## Tracking Alert
Vehicle No: DL3CBZ4422
DateTime:
<ddmmyy,hhmmss> GPS:
## Valid / Invalid
Power: ON /
## OFF IGN: ON /
## OFF
## Speed: 30kmph
http://<device_location_google_maplink>
Not OK: Invalid Input.



## GET INPUT AND OUTPUT STATUS

Cmd: PORT
OK Response: 1-ON,
## 0-OFF IGNITION=<1/0>,
DIN1=<digital Input1>,
DIN2=<digital Input2>,
DOUT1=<Digital
## Output1>
DOUT2=<Digital
## Output2>
Not OK: Invalid Input.





## ANGLE DETECTION
## FEATURE

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 35


Cmd: STARTANGLE
<Degree> Ex1:
## STARTANGLE 30
Ex2: STOPANGLE
OK Response:
Angle detection starts with
degree 30. Angle detection
stopped.
Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 36


## Cmd:
## STARTELEC1
## STOPELE
## C1
## Note:
STARTELEC1= Turn ON
relay. STOPELEC1= Turn
OK Response:




## OPERATE DIGITAL OUTPUT RELAY






Cmd:  GETVERSION OK Response:
## Firmware
## Versions Tracker
version: aaa Gsm
version:bbb Gps
version:ccc
Not OK: Invalid Input.






## SETEMERGENCY BUTTON PRESS
## DURATION

Cmd: SETEMGKEYDURATION<in
seconds>

Example: SETEMGKEYDURATION3
OK Response: Emergency button press hold duration
changed to: 3 seconds
Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 37




## SETSOS AUTORESET
## FUNCTION

Cmd: SETSOSAUTORESET <0/1
## ><interval>

Where interval is in seconds.
## Example:
## SETSOSAUTORESET 0
## SETSOSAUTORESET 1 600
OK Response:
SOS Auto Reset OFF
SOS Auto Reset ON with 600 seconds
Not OK: Invalid Input.



## SET SLEEP TIME THS

Cmd: SETSLEEPTIMETHS <time>

Time - seconds
Example: SETSLEEPTIME 60 OK Response: SETSLEEPTIMETHS,60 Not OK: Invalid Input.



## SET OVER SPEED THS

Cmd: SETOVERSPEEDTHS <speed>

speed – km/h
Example: SETOVERSPEEDTHS 60 OK Response:
## SETOVERSPEEDTHS,60
Not OK: Invalid Input.



## GET ICCID

Cmd: GETICCID

Example: GETICCID
OK Response:
## 070318053696408
Not OK: Invalid Input.

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 38






## ACTIVATION & HEALTH DATA

Cmd: ACTV,< Random Code> OK Response: Not OK:

## ACTVR,654343,APM,1.0.9,864376047795371,17,28.651387,
## N,77.092746,E,1,23092019
## Invalid

053004,0.0,0.0,22,404,04,00F1,1,0,4.0,000007,NR Input.

OK Response:

## HCHKR, 654343,APM ,1.0.9,864376047795371,17,28.651387, N,77.092746,

## E,1,23092019053004,0.0,0.0,22,404,04,00F1,1,0,4.0,000008,NR

Cmd: HCHK,< Random Code>




## OVER THE AIR COMMANDS


CHANGE IP ADDRESS 1 and PORT NO 1
Cmd: ^SETIP1 <ip address>*SETPORT1
## <port No
## >#
## Example1:

## ^SETIP1 192.168.2.1*SETPORT1 9091#
OK Response:

## $,PC,12,867459044086320,1,136.243.105.103,28092019,122320,IP1,PORT1,
## 192.168.2.1,9091*

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 39




CHANGE IP ADDRESS 2 and PORT NO 2

Example1: OK Response:

## ^SETIP2 192.168.2.1*SETPORT2
## 9091#
## $,PC,12,867459044086320,1,136.243.105.103,28092019,122320,IP2,PORT2,
## 192.168.2.1,9091*






CHANGE IP ADDRESS 3 and PORT NO 3


## Example
## 1:
OK Response:
$,PC,12,867459044086320,1,136.243.105.103,28092019,122320,IP3,PORT3, 192.168.2.1,9091*
## ^SETIP3 192.168.2.1*SETPORT3 9091#



## SETAPN OF NETWORK PROVIDER
Cmd: ^SETAPN <apn>#

Example:^ SETAPN sensem2m# OK Response:
$,PC,12,867459044086320,1,136.243.105.103,28092019,124140,APN,sensem2m*
Cmd: ^SETIP3 <ip address>*SETPORT3
## <port No>#
Cmd: ^SETIP2 <ip address>*SETPORT2 <port No>#

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 40






## SETAUTO APN FLAG
Cmd: ^SETAUTOAPN <ON/OFF># Device will set apn automatically as per network provider (On by default)
Example: ^SETAUTOAPN ON#
Example: ^SETAUTOAPN OFF#
## $,PC,12,867459044086320,1,136.243.105.103,28092019,124140, SETAUTOAPN,1*

## $,PC,12,867459044086320,1,136.243.105.103,28092019,124140, SETAUTOAPN,0*





## SET EMERGENCY NO ,VEHICLE NO CHASSIS NO
Cmd: ^SETEMGSMSNO
<Seconds>
## <PHONE> <CHASSIS NO>
## <VEHICLE NO>#


## Example:
## ^SETEMGSMSNO 3600
## 9911074767
## MA3ERLF1S00758533
## MH11C4532#
OK Response:
## $,PC,12,867459044086320,1,136.243.105.103,28092019,124140,3600 9911074767
## MA3ERLF1S00758533 MH11C4532*



## FIRMWARE OVER THE AIR (FOTA)


## Example
## 1:
OK Response:
## SETFOTAIP1,SETPORT1 : 92.168.2.1,9091
Cmd: ^SETFOTAIP1 <ip1>*SETPORT1 <portNo1>#

## MODEL NO:1819001A
AIS140 Protocol


## ^SETFOTAIP1 92.168.2.1*SETPORT1 9091#


## CONFIDENTIAL 38

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 39




## CHANGE DATA SENDING INTERVALS
Cmd: ^SETREPORT*10*60*120*300*10#

## Example1:
## ^SETREPORT*10*60*120*300*10#
OK Response:
$,PC,12,864376047795371,1,136.243.105.103,21092019,101152,SETREPORT,10,60,120,300,
## 10*


## GET ALL PARAMETERS

Cmd: OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,21092019,1
## 01152,
Vehicle No: <Vehicle
No>, IP1 :aaa.bbb.ccc,
## PORT1
:aaaaa, IP2
## :aaa.bbb.c,
## PORT2
## :aaaaa,
## DNS1:0000,
## DNS2:0000,
APN :aaaa,
## SOS
## NO:00000,
Angle Det: ON with
Deg:, Ignition : aa,
Normal : bb,Sleep Time
: cc Health: dd,
Emergency: ee,
GSM: <signal strength>,
GPSFix: <A-GPS Fixed or V – GPS
Invalid>, Sat: <No of satellite>,
MainPower: <1- Power connected or 0 - Power
disconnected>, Bat: <Li-ion Battery Voltage>,

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 40




## CLEAR FLASH DATA






## NETWORK SWITCHING





## GETICCID


Example: ^GETICCID# $,PC,12,864376047795371,1,136.243.105.103,23092019,050020,GETICCID,575812475718757*



## DEVICE RESET
Cmd: ^DEVRESET#
OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,23092019,050020,DEVRESET*
## Cmd:
OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,23092019,050236,CLRM
Cmd: $,PC,12,864376047795371,1,136.243.105.103,23092019,050020,SETSWITCHN
## Cmd:
## OK

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 41




## SETSOS AUTORESET FUNCTION
Cmd: ^SETSOSAUTORESET <0/1
## ><inter
val>#
## Example:
## ^SETSOSAUTORESET 0#
## ^SETSOSAUTORESET 1 600#
OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,23092019,050535,SETSOSAUTORESET,0*
## $,PC,12,864376047795371,1,136.243.105.103,23092019,050535,SETSOSAUTORESET,600*



## SETEMERGENCY BUTTON PRESS DURATION
## Cmd:
^SETEMGKEYDURATION<inseconds>
## #

Example: ^SETEMGKEYDURATION 3#
OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,23092019,050505,SETEMGKEYDURATION,3*







## STOP EMERGENCY FUNCTION
Cmd: ^STOP_EMG# OK Response:
## $,ID01,SATC,1.0.6,EO,11,L,864376047795371,UNKNOWN,1,
## 21092019,130744,28.651438,N,77.092740,E,0.0,0.0,
## 10,173.1,1.9,0.9,IDEA,0,1,13.8,4.0,0,25,404,04,00F1,6769,6767,00F1
## ,40,7244,00F1,37,6768,00F1,27,6E8E,0385,26,0000,00,0.00,0.00,000145,E1,*

## SETHARSH ACCELERATION
## PARAMETERS

Cmd: ^SETHARSHACC
## Mg – Milli G-force
## Duration – In

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 42


Example: ^SETHARSHACC 30,4# OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,21092019,113353,SETHARSHACC,30,4*

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 43




## SET HARSH BRAKING PARAMETERS


Example: ^SETHARSHBRAKE 30,4# OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,21092019,113353, SETHARSHBRAKE,30,4*


## SETRASHTURN PARAMETERS


Example: ^SETRASHTURN 30,85# OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,21092019,113353, SETRASHTURN,30,85*




## SETOVERSPEEDTHS PARAMETERS
Cmd: ^SETOVERSPEEDTHS
## <speed>#

Example: ^SETOVERSPEEDTHS 80# OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,23092019,050927,SETOVERSPEEDTHS,80*
Cmd: ^SETHARSHBRAKE
## Mg – Milli G-force
## Duration – In
Cmd: ^SETRASHTURN
## Mg – Milli G-force
## Duration – In

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 44




## SET IGNITION ALERT
Cmd: ^SETIGNITION#

Example: ^SETIGNITION#
OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,23092019,051000,SETIGNITION*



## CLR IGNITION ALERT
Cmd: ^CLRIGNITIONALERT #

Example: ^CLRIGNITIONALERT# OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,23092019,051000,CLRIGNITIONALERT*



## CLR BATTERY ALERT
Cmd: ^CLRBATTERYALERT#

Example: ^CLRBATTERYALERT# OK Response:
## $,PC,12,864376047795371,1,136.243.105.103,23092019,050717,CLRBATTERYALERT*

## MODEL NO:1819001A
AIS140 Protocol
## CONFIDENTIAL 45




## GETVDETAILS
Cmd: ^GETVDETAILS#

Example: ^GETVDETAILS# OK Response:
## $,< PACKET_TYPE>,<ALERT ID>,<IMEI>,<1= FOR SERVER,0 = FOR
## SMS>,<SERVER_IP/SENDER NO>,<DATE>,<TIME>,GETVDETAILS,<FIRMWARE
## VERSION>,
## <DATETIME>,< FIRMWARE SIZE>,<CHECHSUM>*

$,PC,12,864376047795371,1,136.243.105.103,23092019,051150,GETVDETAILS,1.0.6,1909191128
## 00,7 4824,A1*







## GET LIVE
Cmd: ^GETLIVE# OK Response:
If server connected.
Live string will send with in 3sec.



## ACTIVATION & HEALTH DATA
Cmd: ^ACTV ,<RANDOM CODE>#


Cmd: ^HCHK ,<RANDOM CODE>#
OK Response:
ACTVR, 654343, APM, 1.0.9,864376047795371,17,28.651387, N,77.092746, E,1,23092019
## 053004,0.0,0.0,22,404,04,00F1,1,0,4.0,000007,IN

HCHKR, 654343, APM, 1.0.9,864376047795371,17,28.651387, N,77.092746, E,1,23092019
## 053004,0.0,0.0,22,404,04,00F1,1,0,4.0,000008,IN
