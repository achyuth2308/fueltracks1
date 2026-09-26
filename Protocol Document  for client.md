## BS TECHNOTRONICS PRIVATE LIMITED

## BSTPL17IS PROTOCOL DOCUMENT

PROTOCOL DOCUMENT FOR

BSTPL17IS

BS TECHNOTRONICS PRIVATE LIMITED

Hyderabad


## INTRODUCTION:

This description provided in this document is for information purpose only.

BS Technotronics Private Limited (BSTPL), reserves the right to alter this description or to adapt it to technical conditions at any time. BSTPL shall not be liable for any damage caused by the contents of this document or the use of the described product.

It is considered that the customer does not carry out any reproduction, duplication or disclosing of any information provided in the document in part or complete to any third party without prior written

consent from BS Technotronics Private Limited.

## DATA PACKET FORMAT – CLIENT SERVER:

## Points To Be Noted With Regards To Data Packet Format:

- AA AAAAAAAAAAAAA Header i.e. Start of Normal Packet is always BSTPL\$1. Alert Packet starts with BSTPL\$2 (Digital Inputs), BSTPL\$3 (Main Power), BSTPL\$4 (Internal Battery Low), BSTPL\$5 (Harsh Acceleration), BSTPL\$6 (Harsh Breaking), BSTPL\$7 (Over Speeding), BSTPL\$8 (Box Open / Close) and BSTPL\$9 (SOS)

- All the fields are separated by a comma (,)

- Footer i.e. End Of Packet is always 
#

- Device ID can be an Alphanumeric Number of 20 characters or IMEI number

- GPS Validity is indicated by either 
V
 or 
A

- A
 indicates a Valid Data and 
V
 indicates an invalid data

- Latitude format is in Decimal Degree

- Longitude format is Decimal Degree

- Speed is in KMPH. Indicated as 5, 50, 120 &..

- GPS Odometer is in KM (From 1 - 99999 KM)

- GPS Odometer is subjected to availability of GPS Fix

- Status of Digital Inputs is indicated either by ON (1) or OFF (0)

- Status of Main Battery connection is indicated either by ON (1) or OFF (0)

- Internal Battery Low Alert for Internal Battery Voltage less than 3.6V

- Status of Box Close / Open is indicated either by Open (1) or Close (0)


## BS TECHNOTRONICS PRIVATE LIMITED

## BSTPL17IS PROTOCOL DOCUMENT

## DATA PACKET FORMAT:

BSTPL\$1,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,0,0,0,00.00,00,04.16, 17A_V1_0_0,89917380578146790443,12.16,0#

## DESCRIPTION OF PARAMETERS IN DATA PACKET:

|   | Seq. No. Parameter | Description | Remarks |
| --- | --- | --- | --- |
| 1 | BSTPL$1 | Header. Always GTPL $1 | Always 6 byte |
| 2 | AP12AP3456 | Vehicle ID Alphanumeric | Maximum 20 bytes |
| 3 | A | GPS Validity. A or V | Always 1 byte |
| 4 | 250418 | Date. Numeric Value | Always 6 bytes |
| 5 | 100322 | Time. Numeric Value | Always 6 bytes |
| 6 | 17.344078 | Latitude in Decimal Degrees | Always 9 bytes |
| 7 | N | Latitude Direction | Always 1 byte |
| 8 | 78.553823 | Longitude in Decimal Degrees | Always 9 bytes |
| 9 | E | Longitude Direction | Always 1 byte |
| 10 | 20 | Speed in KMPH | Varies from 1 – 3 bytes |
| 11 | 156 | GPS Odometer | Varies from 1 – 9 bytes |
| 12 | 056 | Direction | Always 3 bytes |
| 13 | 10 | No. Of Satellites | Always 2 bytes |
| 14 | 0 | Box Open / Close Status | Always 1 byte (0 or 1) |
| 15 | 19 | GSM Signal | Always 2 bytes |
| 16 | 1 | Main Battery Status | Always 1 byte (0 or 1) |
| 17 | 1 | Digital Input 1/Ignition Status | Always 1 byte (0 or 1) |
| 18 | 0 | Digital Input 2 Status | Always 1 byte (0 or 1) |
| 19 | 0 | Digital Input 3 Status | Always 1 byte (0 or 1) |
| 20 | 00.00 | Analog Input – 1 | Always 5 bytes. 00.00 to 10.00 V |
| 21 | 0 | Reserved | Varies from 1 – 15 bytes |
| 22 | 04.16 | Internal Battery voltage | Always 5 bytes. |
| 23 | 17IS_V1_0_0 | Firmware version | Varies from 1 – 15 bytes |
| 24 | 89917380578146790443 CCID Number |   | Always 20 bytes |
| 25 | 12.16 | External Battery voltage | Always 5 bytes |
| 26 | 0 | RPM value | Varies from 1 – 8 bytes |
| 27 | # | Footer. Always # | Always 1 byte |

## ALERTS DATA FORMAT:

In addition to status change in regular Data Packet, Alerts are sent as Data Packet instantly as and when occurred.

NOTE: Alerts will be generated only on enabling either through User Interface of OTA Message.

## DIGITAL INPUTS 1 ON:

BSTPL\$2,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,1,1,1,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#

## DIGITAL INPUTS 1 OFF:

BSTPL\$2,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#

## DIGITAL INPUTS 2 ON:

BSTPL\$A,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,1,1,1,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#

## DIGITAL INPUTS 2 OFF:

BSTPL\$A,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#

## DIGITAL INPUTS 3 ON:

BSTPL\$B,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,1,1,1,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#

## DIGITAL INPUTS 3 OFF:

BSTPL\$B,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#

## MAIN BATTERY CONNECTED:

BSTPL\$3,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,1,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,12.16,0#


## BS TECHNOTRONICS PRIVATE LIMITED

## BSTPL17IS PROTOCOL DOCUMENT

## MAIN BATTERY DISCONNECTED:

- BSTPL\$3,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#

## INTERNAL BATTERY LOW:

- BSTPL\$4,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,0,0,0,0,02.00,00,03.59,17A_V1 _0_0,89917380578146790443,00.00,0#

## HARSH ACCELERATION:

- BSTPL\$5,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,60,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#

## HARSH BREAKING:

- BSTPL\$6,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,7,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1_ 0_0,89917380578146790443,00.00,0#

## OVER SPEEDING:

- BSTPL\$7,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,60,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#

## BOX CLOSE:

BSTPL\$8,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#

## BOX OPEN:

- BSTPL\$8,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,1,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,0#

## SOS:

- BSTPL\$9,AP12AP3456,A,130720,160552,27.244183,N,83.673973,E,20,156,183,17,0,11,0,0,0,0,02.00,00,04.16,17A_V1 _0_0,89917380578146790443,00.00,#
