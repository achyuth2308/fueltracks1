QUTELTONIKA 



### **Contents** 

|1.<br>FMB920 DATA PROTOCOL......................................................................................................................3|
|---|
|1.1<br>AVL DATA PACKET.........................................................................................................................................................3|
|1.2<br>AVL DATA........................................................................................................................................................................3|
|1.3<br>PRIORITY............................................................................................................................................................................ 3|
|1.4<br>GPS ELEMENT..................................................................................................................................................................3|
|1.5<br>IO ELEMENT...................................................................................................................................................................... 4|
|1.6<br>EXAMPLE..........................................................................................................................................................................13|
|2.<br>SENDING DATA OVER TCP/IP..............................................................................................................16|
|3.<br>SENDING DATA OVER UDP/IP.............................................................................................................17|
|3.1<br>UDP CHANNEL PROTOCOL..........................................................................................................................................17|
|3.2<br>SENDINGAVL DATA USINGUDP CHANNEL.........................................................................................................17|
|4.<br>SENDING DATA USING SMS................................................................................................................ 20|
|5.<br>SMS EVENTS............................................................................................................................................21|
|6.<br>CHANGE LOG.......................................................................................................................................... 22|



**2** / **22** 



# **1. FMB920 DATA PROTOCOL** 

### **1.1 AVL data packet** 

Below table represents AVL data packet structure. 

|4 zeroes|Data field<br>length|Codec ID|Number of<br>Data 1|AVL Data|Number of<br>Data 2|CRC-16|
|---|---|---|---|---|---|---|
|_4 Bytes_|_4 Bytes_|_1 Byte_|_1 Byte_|_30- 147_<br>_Bytes_|_1 Byte_|_4 bytes_|



Number of data – number of encoded data (number of records). In FM920 codec ID is constant 08. 

Data field length is the length of bytes [codec id, number of data 2]. 

Number of data 1 should always be equal to number of data 2 byte. 

CRC-16 is 4 bytes, but first two are zeroes and last two are CRC-16 calculated for [codec id, number of data 2] <mark>Minimum AVL packet size</mark> is 45 <mark>bytes (all IO elements disabled). Maximum AVL packet size for one record</mark> is <mark>783 bytes</mark> 

### **1.2 AVL Data** 

|Timestamp|Priority|GPS Element|IO Element|
|---|---|---|---|
|_8 Bytes_|_1 Byte_|_15 Bytes_|_6-123_|



Timestamp – difference, in milliseconds, between the current time and midnight, January 1, 1970 UTC. 

### **1.3 Priority** 

|0|Low|
|---|---|
|1|High|
|2|Panic|



### **1.4 GPS Element** 

|Longitude|Latitude|Altitude|Angle|Satellites|Speed|
|---|---|---|---|---|---|
|_4 Bytes_|_4 Bytes_|_2 Bytes_|_2 Bytes_|_1 Byte_|_2 Bytes_|



**3** / **22** 



X Longitude<sup>1</sup> Y Latitude<sup>1</sup> Altitude In meters above sea level<sup>1</sup> Angle In degrees, 0 is north, increasing clock-wise<sup>1</sup> Satellites Number of visible satellites<sup>1</sup> Speed Speed in km/h. 0x0000 if GPS data is invalid<sup>1</sup> 

Longitude and latitude are integer values built from degrees, minutes, seconds and milliseconds by formula. 



d Degrees m Minutes s Seconds ms Milliseconds p Precision (10000000) 

If longitude is in west or latitude in south, multiply result by –1. To determine if the coordinate is negative, convert it to binary format and check the very first bit. If it is 0, coordinate is positive, if it is 1, coordinate is negative. 

Example: 

Received value: 20 9c ca 80 

Converted to BIN: 00100000 10011100 11001010 10000000 first bit is 0, which means coordinate is positive Convered to DEC: 547146368 

For more information see two‘s compliment arithmetics. 

### **1.5 IO element** 



<!-- Start of picture text -->
 IO<br> IO IO ID IO ID IO ID IO ID<br>IO ID IO ID IO ID IO ID<br> Total  One Byte  IO Value …  IO Value  Two Bytes IO  IO Value …  IO Value  Four Bytes IO  IO Value …  IO Value  Eight Bytes IO  IO Value …  IO Value<br>Event IO ID N of 1’st 1’st N1’th N1’th 1’st 1’st N2’th N2’th 1’st 1’st N4’th N4’th 1’st 1’st N8’th N8’th<br>N1 of N2 of N4 of N8 of<br>1 Byte 1 Byte 1 Byte 1 Byte 1 Byte 1 Byte 1 Byte 1 Byte 1 Byte 2 Bytes 1 Byte 2 Bytes 1 Byte 1 Byte 4 Bytes 1 Byte 4 Bytes 1 Byte 1 Byte 8 Bytes 1 Byte 8 Bytes<br><!-- End of picture text -->

Event IO ID – if data is acquired on event – this field defines which IO property has changed and generated an event. If data cause is not event – the value is 0. 

> 1 If record is without valid coordinates – (there were no GPS fix in the moment of data acquisition) – Longitude, Latitude and Altitude values are last valid fix, and Angle, Satellites and Speed are 0. 

**4** / **22** 



|N|total number of properties coming with record (N=N1+N2+N4+N8)|
|---|---|
|N1|number of properties, which length is 1 byte|
|N2|number of properties, which length is 2 bytes|
|N4|number of properties, which length is 4 bytes|
|N8|number ofproperties,which length is 8 bytes|



||(are always s|Perma<br>ent (with|nent I/O elements<br>every record) to server if enabled)|
|---|---|---|---|
|Property ID||||
|in AVL<br>packet|Property Name|Bytes|Description|
|239|Ignition|1|Logic: 0 / 1<br>* Depends on Ignitionsource|
|240|Movement|1|Logic: 0 / 1<br>* Depends on Movement source|
|80|Data Mode|1|Value in scale 0 – 5<br>0 – Home On Stop<br>1 – Home On Moving<br>2 – Roaming On Stop<br>3 – Roaming On Moving<br>4- Unknown On Stop<br>5–UnknownOn Moving|
|21|GSM Signal|1|Value in scale 1–5|
|200|<br>Sleep Mode|1|0–No Sleep; 1–GPS Sleep; 2–Deep Sleep; 3-Online Sleep|
|69|GNSS Status|1|0 - OFF<br>1 - ON with fix<br>2 - ON without fix<br>3- Insleep state|
|181|GNSS PDOP|2|Probability*10; 0-500|
|182|GNSS HDOP|2|<br>Probability*10; 0-500|
|66|External Voltage|2|Voltage: mV, 0–30 V|
|24|Speed|2|Value in km/h, 0–xxx km/h|
|205|GSM Cell ID|2|GSM base station ID|
|206|GSM Area Code|2|Location Area code (LAC), it depends on GSM operator. It<br>provides unique number which assigned to a set of base GSM<br>stations. Max value: 65536|
|67|Battery Voltage|2|Voltage: mV|
|68|Battery Current|2|Current: mA|
|241|<br>Active GSM Operator|4|Currently used GSM Operator code|
|199|Trip Odometer|4|Trip Odometer Value in meters|
|16|Total Odometer|4|Total Odometer Value in meters|
|1|Digital Input 1|1|Logic: 0 / 1|
|9|Analog input 1|2|Voltage: mV, 0–30 V|
|179|Digital Output 1|1|Logic: 0 / 1|
|12|Fuel Used GPS|4|Fuel Used in mili Liters|
|13|Fuel Rate GPS|2|Average Fuel use in (Litersx100) /100km|
|17|Axis X|2|X axis: value mG range [-8000; 8000]|
|18|Axis Y|2|<br>Y axis: value mG range [-8000; 8000]|
|19|Axis Z|2|<br>Z axis: value mG range [-8000; 8000]|
|*11<br>*14|ICCID1<br>ICCID2|8<br>8|Value of SIM ICCID, MSB<br>(Example Below)<br>Value of SIM ICCID, LSB<br>(Example Below)|



**5** / **22** 



||(are always se|Perma<br>nt (with|nent I/O elements<br>every record) to server if enabled)|
|---|---|---|---|
|Property ID<br>||||
|in AVL|Property Name|Bytes|Description|
|packet||||
|10|SD Status|1|0–not present, 1–present|
|15|Eco Score|2|Average amount of events on some distance. Min – 0, Max –<br>65536.Multiplier –0.01|
|238|User ID|8|MAC address of NMEA receiver device connected via<br>Bluetooth|
||||Multiplier – 0.1. Degrees ( °C ), -40 - +125; Error codes:|
|25|BLE Temperature #1|2|4000 - abnormal sensor state<br>3000 - sensor not found<br>2000- failed sensordata parsing|
||||Multiplier – 0.1. Degrees ( °C ), -40 - +125; Error codes:|
|26|BLE Temperature #2|2|4000 - abnormal sensor state<br>3000 - sensor not found<br>2000-failed sensor data parsing|
||||Multiplier – 0.1. Degrees ( °C ), -40 - +125; Error codes:|
|27|BLE Temperature #3|2|4000 - abnormal sensor state<br>3000 - sensor not found<br>2000-failed sensor data parsing|
||||Multiplier – 0.1. Degrees ( °C ), -40 - +125; Error codes:|
|28|BLE Temperature #4|2|4000 - abnormal sensor state<br>3000 - sensor not found|
||||2000-failed sensor data parsing|
|29|BLE Battery voltage #1|1|Battery voltage in % of sensor #1|
|20|BLE Battery voltage #2|1|Battery voltage in % of sensor #2|
|22|BLE Battery voltage #3|1|Battery voltage in % of sensor #3|
|23|BLE Battery voltage #4|1|Battery voltage in % of sensor #4|
|86|<br>BLE Humidity #1|2|<br>Multiplier 0.1. %RH|
|104|BLE Humidity #2|2|Multiplier 0.1. %RH|
|106|BLE Humidity #3|2|Multiplier 0.1. %RH|
|108<br>There are|BLE Humidity #4<br>8 IO elements of<br>1<br>byte<br>si|2<br>ze.|Multiplier 0.1. %RH|



Also 13 IO elements of 2 <mark>byte size.</mark> 

Also 4 IO elements of 4 <mark>byte size</mark> . 

And 0 IO elements of 8 <mark>byte size.</mark> 

*ICCID Full Value Calculation, Example 

- 1) Calculate ID:14 lenght as string 

- 2) If lenght < 10, then add_zeros = 10 – length 

- 3) Else no zeros must be added 

- 4) Concat strings to get final value. Final value = String(ID 11) + String(add_zeros) + String(ID 14). 

**6** / **22** 



|ID:11 Len as<br>string|ID:14 Len as<br>string|Full Value|Full Value Len|
|---|---|---|---|
|9|9|String(ID 11) + „0“ + String(ID 14)|19|
|9|10|String(ID 11) + String(ID 14)|19|
|10|10|String(ID 11) + String(ID 14)|20|
|9|11|String(ID 11) + String(ID 14)|20|
|11|8|String(ID 11) + „00“ + String(ID 14)|21|
|11|10|String(ID 11) + String(ID 14)|21|
|12|10|String(ID 11) + String(ID 14)|22|
|12|9|String(ID 11) + „0“ + String(ID 14)|22|



|Property ID|(Sen|Event<br>d if corresp|ual I/O elements<br>onding event had happen)|
|---|---|---|---|
|in AVL<br>packet|Property Name|Bytes|Description|
|155|Geofence zone 1|1|Logic: 0 / 1<br>0–Exit Event; 1–Enter Event;|
|156|Geofence zone 2|1|Logic: 0 / 1<br>0–Exit Event; 1–Enter Event;|
|157|Geofence zone 3|1|Logic: 0 / 1<br>0–Exit Event; 1–Enter Event;|
|158|Geofence zone 4|1|Logic: 0 / 1<br>0–Exit Event; 1–Enter Event;|
|159|Geofence zone 5|1|Logic: 0 / 1<br>0–Exit Event; 1–Enter Event;|
|61|Geofence zone 6|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3 – over speeding start|
|62|Geofence zone 7|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|63|Geofence zone 8|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|64|Geofence zone 9|1|0 – target left zone<br>1–target entered zone|



**7** / **22** 



|Property ID|(Sen|Event<br>d if corres|ual I/O elements<br>ponding event had happ|en)|
|---|---|---|---|---|
|in AVL<br>packet|Property Name|Bytes||Description|
||||2 – over speeding end<br>3–over speeding start||
|65|Geofence zone 10|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|70|Geofence zone 11|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–overspeeding start||
|88|Geofence zone 12|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–overspeeding start<br>||
|91|Geofence zone 13|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|92|Geofence zone 14|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|93|Geofence zone 15|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|94|Geofence zone 16|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|95|Geofence zone 17|1|<br>0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|96|Geofence zone 18|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|97|Geofence zone 19|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|98|Geofence zone 20|1|<br>0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|99|Geofence zone 21|1|0 – target left zone<br>1 – target entered zone<br>2–over speeding end||



**8** / **22** 



|Property ID|(Sen|Event<br>d if corres|ual I/O elements<br>ponding event had happ|en)|
|---|---|---|---|---|
|in AVL<br>k|Property Name|Bytes||Description|
|pacet|||||
||||3–over speeding start||
|153|Geofence zone 22|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>||
||||3–overspeeding start||
|154|Geofence zone 23|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|190|Geofence zone 24|1|<br>0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|191|Geofence zone 25|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|192|Geofence zone 26|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|193|Geofence zone 27|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|194|Geofence zone 28|1|<br>0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|195|Geofence zone 29|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|196|Geofence zone 30|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|197|Geofence zone 31|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|198|Geofence zone 32|1|<br>0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||
|208|Geofence zone 33|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start||



**9** / **22** 



|Property ID|(Sen|Event<br>d if corres|ual I/O elements<br>ponding event had happen)|
|---|---|---|---|
|in AVL<br>packet|Property Name|Bytes|Description|
|209|Geofence zone 34|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|216|Geofence zone 35|1|<br>0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–overspeeding start|
|217|Geofence zone 36|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–overspeeding start|
|218<br>219|Geofence zone 37<br>Geofence zone 38|1<br>1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start<br>0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|220|Geofence zone 39|1|<br>0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|221|Geofence zone 40|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|222|Geofence zone 41|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|223|Geofence zone 42|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|224|Geofence zone 43|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|225|Geofence zone 44|1|<br>0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|226|Geofence zone 45|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–overspeeding start|
|227|Geofence zone 46|1|0–target left zone|



**10** / **22** 



|Property ID|(Sen|Event<br>d if corres|ual I/O elements<br>ponding event had happen)|
|---|---|---|---|
|in AVL<br>packet|Property Name|Bytes|Description|
||||1 – target entered zone<br>2 – over speeding end<br>3–overspeeding start|
|228|Geofence zone 47|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|229|Geofence zone 48|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|230|Geofence zone 49|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|231|Geofence zone 50|1|0 – target left zone<br>1 – target entered zone<br>2 – over speeding end<br>3–over speeding start|
|175|Auto Geofence|1|Logic: 0 / 1<br>0–Exit Event; 1–Enter Event;|
|250|Trip|1|Logic: 0 / 1<br>0–Trip Ended; 1–Trip Started;|
|255|Over speeding|1|Value km/h that generated event|
|251|Idling|1|Logic: 0 / 1<br>0-Idling ended event; 1–Idling started event;|
|253|Green Driving Type|1|<br>Possible Values: [1/2/3]<br>1 – Acceleration<br>2 – Braking<br>3–Cornering|
|254|Green Driving Value|1|Depending on eco driving type: if harsh acceleration, braking<br>and cornering–g*10|
|246|Towing|1|1 – Send Towing detected|
|252|Unplug|1|1 – Send when unplug event happens|
|247|Crash Detection|1|1 – Crash Detected<br>2 – Crash Trace Record, (begins 5 sec before crash, and ends 5<br>sec after crash*/|
|249|Jamming|1|1 – Jamming Detected<br>0–Jamming Ended|



**11** / **22** 



|Property ID|(Sen|Perma<br>d if ask t|nent I/O elements<br>o get with OBDII dongle)|
|---|---|---|---|
|<br>in AVL<br>|Property Name|Bytes|Description|
|packet||||
|30|„Number of DTC“|1||
|31|„Calculated engine load<br>value“|1|%|
|32|„Engine coolant<br>temperature“|1|C|
|33|„Short term fuel trim 1“|1|%|
|34|„Fuelpressure“|2|kPa|
|35|„Intake manifold<br>absolute pressure“|1|kPa|
|36|<br>„Engine RPM“|2|rpm|
|37|„Vehicle speed“|1|km/h|
|38|„Timingadvance“|1|O|
|39|„Intake air temperature“|1|C|
|40|„MAF air flow rate“|2|g/sec,*0.01|
|41|„Throttleposition“|1|%|
|42|„Run time since engine<br>start“|2|s|
|43|„Distance traveled MIL<br>on“|2|Km|
|44|„Relative fuel rail<br>pressure“|2|kPa, *0.1|
|45|„Direct fuel rail<br>pressure“|2|kPa, *0.1|
|46|„Commanded EGR“|1|%|
|47|„EGR error“|1|%|
|48|„Fuel level“|1|%|
|49|„Distance traveled since<br>codes cleared“|2|Km|
|50|„Barometricpressure“|1|kPa|
|51|„Control module<br>voltage“|2|mV|
|52|„Absolute load value“|2|%|
|53|„Ambient air<br>temperature“|1|C|
|54|Time run with MIL on|2|Min|
|55|„Time since trouble<br>codes cleared“|2|Min|
|56|„Absolute fuel rail<br>pressure“|2|kPa, *10|
|57|„Hybrid battery pack<br>remaining life“|1|%|
|58|„Engine oil<br>temperature“|1|C|
|59|„Fuel injection timing“|2|O,*0.01|
|60|„Engine fuel rate“|2|L/h,*100|



**12** / **22** 



**To receive CAN data, send if ask to get with OBDII dongle. FMB9 module CAN data is not reading.** 

### **1.6 Example** 

Received data: 

<mark>000000000000008c08010000013feb55ff74000f0ea850209a6900009400001</mark> 20000 <mark>001e0</mark> 9010002000300040016014703f0001504c800 <mark>0c0</mark> 900730a00460b00501300464306d74400 00b5000bb60007422e9f180000cd0386ce0001 <mark>07c</mark> 700000000f10000601a4600000134480 0000bb84900000bb84a00000bb84c00000000 <mark>024</mark> e0000000000000000cf00000000000000 00 <mark>0100003fca</mark> 

In total 152 Bytes. 

<mark>00000000</mark> **4** **<mark>zeroes</mark>** <u><mark>,</mark></u> 4 <mark>bytes 0000008c</mark> **<mark>data length</mark>** <u><mark>,</mark></u> 4 <mark>bytes</mark> – **<mark>08</mark> Codec ID** 

0- **<u>Number of Data</u>** (1 record) 

#### **1’st record data** 

– <mark>0000013feb55ff74</mark> **Timestamp** in milliseconds (1374042849140) **GMT** : Wed, 17 Jul 2013 06:34:09 GMT – <mark>00</mark> **Priority** 

#### **GPS Element** 

<mark>0f0ea850</mark> – Longitude 252618832 = 25,2618832º N <mark>209a6900</mark> – Latitude 546990336 = 54,6990336 º E – <mark>0094</mark> Altitude 148 meters – 0 Angle 214º – 12 12 Visible sattelites – 0 0 km/h speed 

#### **IO Element** 

– – **<mark>00</mark>** IO element ID of Event generated (in this case when 00 data generated not on event) – **<mark>1e</mark>** 30 IO elements in record (total) – **<mark>09</mark>** 9 IO elements, which length is 1 Byte 0 – IO element ID = 01 0 – IO element’s value = 0 02 – IO element ID = 02 0 – IO element’s value = 0 03 – IO element ID = 03 0 – IO element’s value = 0 04 – IO element ID = 04 0 – IO element’s value = 0 16 – IO element ID = 22 (dec) 

**13** / **22** 



|0<br>– IO|element’s value = 1|
|---|---|
|47<br>– IO|element ID = 71 (dec)|
|**03**<br>– IO|element’s value = 3|
|F0<br>– IO|element ID = 240 (dec)|
|0<br>– IO|element’s value = 0|
|15<br>– IO <br>|element ID = 21 (dec)|
|**04**<br>– IO|element’s value = 0|
|C8<br>– IO|element ID = 200 (dec)|
|0<br>– IO|element’s value = 0|
|**0C**<br>– 12 IO e|lements, which value length is 2 Bytes|
|09<br>– IO|element ID = 9 (dec)|
|**0073**<br>– IO|element’s value|
|0a<br>– IO|element ID = 10 (dec)|
|**0046**<br>– IO|element’s value|
|0b<br>– IO|element ID = 11 (dec)|
|**0050**<br>– IO|element’s value|
|13<br>– IO|element ID = 19 (dec)|
|**0046**<br>– IO|element’s value|
|43<br>– IO|element ID = 67 (dec)|
|**06d7**<br>– IO|element’s value|
|44<br>– IO|element ID = 68 (dec)|
|0<br>– IO|element’s value|
|B5<br>– IO|element ID = 181 (dec)|
|**000b**<br>– IO|element’s value|
|B6<br>– IO|element ID = 182 (dec)|
|**0007**<br>– IO|element’s value|
|42<br>– IO|element ID = 66 (dec)|
|**2e9f**<br>– IO|element’s value|
|18<br>– IO|element ID = 24 (dec)|
|0<br>– IO|element’s value|
|cd<br>– IO|element ID = 205 (dec)|
|**0386**<br>– IO|element’s value|
|CE<br>– IO|element ID = 206 (dec)|
|0<br>– IO|element’s value|
|**07** – 7 IO elem|ents, which value length is 4 Bytes|
|C7|– IO element ID = 199 (dec)|
|0<br>– IO|element’s value|
|f1|– IO element ID = 241 (dec)|
|**0000601a**|– IO element’s value|
|46|– IO element ID = 70 (dec)|
|**00000134**|– IO element’s value|
|48|– IO element ID = 72 (dec)|
|**00000bb8**|– IO element’s value|
|49|– IO element ID = 73 (dec)|
|**00000bb8**|– IO element’s value|
|4a|– IO element ID = 74 (dec)|



**14** / **22** 



– **00000bb8** IO element’s value 4c – IO element ID = 76 (dec) – 0 IO element’s value 

**15** / **22** 



– **<mark>02</mark>** 2 IO elements, which value length is 8 Bytes 4e – IO element ID = 78 (dec) – 0 IO element’s value cf – IO element ID = 207 (dec) – 0 IO element’s value 0 – Number of Data (1 record) - <mark>00003fca</mark> CRC-16, 4 Bytes (first 2 are always zeroes) 

# **2. SENDING DATA OVER TCP/IP** 

First when module connects to server, module sends its IMEI. First comes short identifying number of bytes written and then goes IMEI as text (bytes). 

For example IMEI 356307042441013 would be sent as 000f333536333037303432343431303133 First two bytes denote IMEI length. In this case 000F means, that imei is 15 bytes long. 

After receiving IMEI, server should determine if it would accept data from this module. If yes server will reply to module 01 if not 00. Note that confirmation should be sent as binary packet. I.e. 1 byte 0x01 or 0x00. 

Then module starts to send first AVL data packet. After server receives packet and parses it, server must report to module number of data received as integer (four bytes). 

If sent data number and reported by server doesn’t match module resends sent data. 

Example: 

Module connects to server and sends IMEI: 

000f333536333037303432343431303133 Server accepts the module: 01 

Module sends data packet: 

|**AVL data packet header**|**AVL data array**|**CRC**|
|---|---|---|
|Four zero bytes,|CodecId – 08,|CRC of ‘AVL data array’|
|‘AVL data array’ length – 254|NumberOfData – 2.<br>(Encoded using continuous bit<br>stream. Last byte padded to align<br>to byte boundary)||
|00000000000000FE|0802...(data elements)...02|00008612|



Server acknowledges data reception (2 data elements): 00000002 

**16** / **22** 



# **3. SENDING DATA OVER UDP/IP** 

### **3.1 UDP channel protocol** 

UDP channel is a transport layer protocol above UDP/IP to add reliability to plain UDP/IP using acknowledgment packets. The packet structure is as follows: 

|||**UDP**|**datagram**|
|---|---|---|---|
|UDP<br>channel<br>packet x N|Packet length|2 bytes|Packet length (excluding this field) in big<br>endian byte order|
||Packet Id|2 bytes|Packet id unique for this channel|
||Packet Type|1 byte|Type of this packet|
||Packetpayload|m bytes|Datapayload|



||**Packet Type**|
|---|---|
|0|Datapacket requiringacknowledgment|
|1|Datapacket NOT requiringacknowledgment|
|2|Acknowledgmentpacket|



Acknowledgment packet should have the same _packet id_ as acknowledged data packet and empty data payload. Acknowledgement should be sent in binary format. 

||**Acknowle**|**dgmentpacket**|
|---|---|---|
|Packet length|2 bytes|0x0003|
|Packet id|2 bytes|same as in acknowledgedpacket|
|Packet type|1 byte|0x02|



### **3.2 Sending AVL data using UDP channel** 

AVL data are sent encapsulated in UDP channel packets ( _Data payload_ field). 

|**AVL da**|**ta encapsulated in**|**UDP channelpacket**|
|---|---|---|
|AVLpacket id (1 byte)|Module IMEI|AVL data array|



_AVL packet id_ (1 byte) – id identifying this AVL packet _Module IMEI_ – IMEI of a sending module encoded the same as with TCP 

**17** / **22** 



_AVL data array –_ array of encoded AVL data 

||**Server response to AVL datapacket**|
|---|---|
|AVLpacket id (1 byte)|Number of accepted AVL elements (1 byte)|



_AVL packet id_ (1 byte) _–_ id of received AVL data packet 

_Number of AVL data elements accepted (1 byte)_ – number of AVL data array entries from the beginning of array, which were accepted by the server. 

Scenario: 

Module sends UDP channel packet with encapsulated AVL data packet ( _Packet_ type=1 or 0). If packet type is 0, server should respond with valid UDP channel acknowledgment packet. Since server should respond to the AVL data packet, UDP channel acknowledgment is not necessary in this scenario, so _Packet type=1_ is recommended. 

Server sends UDP channel packet with encapsulated response ( _Packet type=1 –_ this packet should not require acknowledgment) 

Module validates _AVL packet id_ and _Number of accepted AVL elements._ If server response with valid _AVL packet id_ is not received within configured timeout, module can retry sending. 

#### Example: 

Module sends the data: 

|**UDP channel header**|**AVLpacket header**|**AVL data array**|
|---|---|---|
|Len – 253,|AVL packet id – 0xDD,|CodecId – 08,|
|Id – 0xCAFE,|IMEI – 1234567890123456|NumberOfData – 2.|
|Packet type – 01||(Encoded using continuous bit|
|(without ACK)||stream)|
|00FDCAFE01|DD000F3133343536373839303132333435|0802…(data elements)…02|



Server must respond with acknowledgment: 

|**UDP channel header**|**AVLpacket acknowledgment**|
|---|---|
|Len – 5,|AVL packet id – 0xDD,|
|Id – 0xABCD,|NumberOfAcceptedData – 2|
|Packet type – 01 (without ACK)||
|0005ABCD01|DD02|



**18** / **22** 



## **Another example, with all IO id’s enabled** 

Server received data: 

<mark>00a1cafe011b000f3335363330373034323434313031330</mark> 8 <mark>010000013febdd19c8000f0e9 ff0209a7180006900001200000</mark> 01e09010002000300040016014703f0001504c8000c0900 910a00440b004d130044431555440000b5000bb60005422e9b180000cd0386ce000107c70 0000000f10000601a460000013c4800000bb84900000bb84a00000bb84c00000000024e00 00000000000000cf0000000000000000 <mark>01</mark> 

**Data length** : <mark>00a1</mark> or 161 Bytes (not counting the first 2 data length bytes) 

|**Packet identifi**|**cation**<br>: 0x<br>CAFE 2 bytes|
|---|---|
|**Packet type**<br>:|01|
|**Packet id**<br>:|1b|
|**Imei length**<br>:|000f|
|**Actual imei**<br>:|333536333037303432343431303133|
|Codec id**:**|08|
|Number of data<br>:|01|
|Timestamp<br>:|0000013febdd19c8|
|Priority:|00|
|GPS data:|0f0e9ff0209a718000690000120000|



UDP protocol is the same as TCP except message header is 7 bytes, which consist of: data length, packet identification, packet type and packet id. 

Then goes imei length and imei itself. 

And after that goes AVL data. 

And at the very end number of data byte. There is no CRC in UDP. 

**19** / **22** 

QUTELTONIKA 



# **5. SMS EVENTS** 

When Configured to generate SMS event user will get this SMS upon event 

**<Year/Month/Day> <Hour:Minute:Second> Lon** :<longitude> **Lat** :<latitude> **Q:** <HDOP> **<SMS Text** > **Va** l:<Event Value> 

Example: 

2016/04/11 12:00:00 Lon:51.12258 Lat: 25.7461 Q:0.6 Digital Input 1 Val:1 

**21** / **22** 



# **6. CHANGE LOG** 

|Nr.|Date|New<br>version<br>number|Comments|
|---|---|---|---|
|1|2016.10.02|0.0.1|First release|
|2|2016.11.15|0.0.3|Minor changes|
|3|2017.01.24|0.0.4|OBD AVL ID|
|4|2017.03.30|0.0.5|Added ICCID and SD status.|
|5|2017.04.24|0.0.6|GPS AVG Fuel Use in 100km. Multiplier (x100)<br>info added<br>CCID ID is put to two IO elements (AVL ID:11<br>and AVL ID:14), parsing instructios added|
|6|2017.06.16|0.0.7|Updated IO GNSS status values|
|7|2017.07.03|0.0.8|Description added: ICCID Full Value Calculation|
|8|2017.07.25|0.0.9|Updated OBD fuel rateparam.|
|9|2018.02.21|0.0.10|Added new I\O elements|



**22** / **22** 

