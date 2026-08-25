// ============================================================
// TELTONIKA FMB920 (CODEC 8) PARSER
// Implements IMEI handshake, CRC-16 (IBM) validation, and AVL 
// record extraction.
// ============================================================

const crypto = require('crypto');

/**
 * CRC-16 (IBM) calculation as defined in Teltonika protocols.
 * Polynomial: 0xA001 (reversed 0x8005)
 */
function calculateCrc16(buffer, offset, length) {
  let crc = 0;
  for (let i = 0; i < length; i++) {
    crc ^= buffer.readUInt8(offset + i);
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) > 0) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

/**
 * Check if the buffer is a Teltonika IMEI handshake packet.
 * Format: 2 bytes length (0x00 0x0F) + 15 bytes ASCII IMEI.
 */
function isImeiPacket(buffer) {
  if (buffer.length >= 17) {
    const len = buffer.readUInt16BE(0);
    if (len > 0 && buffer.length >= len + 2) {
      // Basic check: is the payload ASCII?
      const payload = buffer.toString('ascii', 2, len + 2);
      if (/^[\x20-\x7E]+$/.test(payload)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Parse the IMEI packet.
 * @returns { imei: string, response: Buffer }
 */
function parseImeiPacket(buffer) {
  const len = buffer.readUInt16BE(0);
  const imei = buffer.toString('ascii', 2, len + 2);
  // Response 0x01 accepts the device
  const response = Buffer.from([0x01]);
  return { imei, response };
}

/**
 * Reads an IO block (1, 2, 4, or 8 byte values).
 */
function readIoBlock(buffer, offset, valueSize, ioMap) {
  let currentOffset = offset;
  const count = buffer.readUInt8(currentOffset);
  currentOffset += 1;

  for (let i = 0; i < count; i++) {
    const ioId = buffer.readUInt8(currentOffset);
    currentOffset += 1;
    
    let value = 0;
    if (valueSize === 1) {
      value = buffer.readInt8(currentOffset); // Some IOs might be signed, safe as int8 for 0/1
    } else if (valueSize === 2) {
      value = buffer.readInt16BE(currentOffset);
    } else if (valueSize === 4) {
      value = buffer.readInt32BE(currentOffset);
    } else if (valueSize === 8) {
      // Technically readBigInt64BE, but we can approximate for our needs
      value = Number(buffer.readBigInt64BE(currentOffset));
    }
    currentOffset += valueSize;
    ioMap[ioId] = value;
  }
  return currentOffset;
}

/**
 * Reads an IO block for Codec 8 Extended (2-byte IO IDs).
 */
function readIoBlockExtended(buffer, offset, valueSize, ioMap) {
  let currentOffset = offset;
  const count = buffer.readUInt16BE(currentOffset);
  currentOffset += 2;

  for (let i = 0; i < count; i++) {
    const ioId = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    let value = 0;
    if (valueSize === 1) {
      value = buffer.readInt8(currentOffset);
    } else if (valueSize === 2) {
      value = buffer.readInt16BE(currentOffset);
    } else if (valueSize === 4) {
      value = buffer.readInt32BE(currentOffset);
    } else if (valueSize === 8) {
      value = Number(buffer.readBigInt64BE(currentOffset));
    }
    currentOffset += valueSize;
    ioMap[ioId] = value;
  }
  return currentOffset;
}

/**
 * Reads a Variable Length IO block for Codec 8 Extended.
 */
function readVariableIoBlockExtended(buffer, offset, ioMap) {
  let currentOffset = offset;
  const count = buffer.readUInt16BE(currentOffset);
  currentOffset += 2;

  for (let i = 0; i < count; i++) {
    const ioId = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;
    const length = buffer.readUInt16BE(currentOffset);
    currentOffset += 2;

    // We just store the raw buffer for variable length IO.
    // If the data is ASCII, it can be decoded later.
    const value = buffer.subarray(currentOffset, currentOffset + length);
    currentOffset += length;
    
    // Store as hex string to avoid object reference issues in Redis, 
    // or you could just store it as is if Redis handles buffers.
    ioMap[ioId] = value.toString('hex');
  }
  return currentOffset;
}

/**
 * Parse a full Codec 8 or Codec 8 Extended Data Packet
 * Returns { records: [...], response: Buffer, bytesConsumed: number }
 * Supports:
 *   0x08 — Codec 8 (IO IDs are 1 byte)
 *   0x8E — Codec 8 Extended (IO IDs are 2 bytes)
 */
function parseCodec8Packet(buffer) {
  if (buffer.length < 45) {
    return { error: 'Buffer too small for AVL packet', bytesConsumed: 0 };
  }

  // 1. Preamble (4 zeroes)
  const preamble = buffer.readUInt32BE(0);
  if (preamble !== 0) {
    return { error: 'Invalid preamble', bytesConsumed: 0 };
  }

  // 2. Data Field Length
  const dataLength = buffer.readUInt32BE(4);
  const packetTotalLength = 4 + 4 + dataLength + 4; // Zeros + Length + Data + CRC16

  if (buffer.length < packetTotalLength) {
    return { error: 'Incomplete packet', bytesConsumed: 0 };
  }

  // 3. CRC-16 Check
  const expectedCrc = buffer.readUInt32BE(packetTotalLength - 4);
  const actualCrc = calculateCrc16(buffer, 8, dataLength);

  if (expectedCrc !== actualCrc) {
    return { error: `CRC mismatch. Expected ${expectedCrc}, got ${actualCrc}`, bytesConsumed: packetTotalLength };
  }

  // 4. Parse Codec Data
  let offset = 8;
  const codecId = buffer.readUInt8(offset);
  offset += 1;

  // Support both Codec 8 (0x08) and Codec 8 Extended (0x8E)
  const isExtended = (codecId === 0x8E);
  if (codecId !== 0x08 && codecId !== 0x8E) {
    return { error: `Unsupported Codec ID: 0x${codecId.toString(16)}`, bytesConsumed: packetTotalLength };
  }

  const recordCount1 = buffer.readUInt8(offset);
  offset += 1;

  const records = [];

  for (let i = 0; i < recordCount1; i++) {
    // Timestamp (8 bytes)
    const timestampMs = Number(buffer.readBigUInt64BE(offset));
    offset += 8;

    // Priority (1 byte)
    const priority = buffer.readUInt8(offset);
    offset += 1;

    // GPS Element (15 bytes)
    const lon = buffer.readInt32BE(offset) / 10000000.0;
    offset += 4;
    const lat = buffer.readInt32BE(offset) / 10000000.0;
    offset += 4;
    const altitude = buffer.readInt16BE(offset);
    offset += 2;
    const angle = buffer.readUInt16BE(offset);
    offset += 2;
    const satellites = buffer.readUInt8(offset);
    offset += 1;
    const speed = buffer.readUInt16BE(offset);
    offset += 2;

    // IO Element
    const ioMap = {};

    if (isExtended) {
      // Codec 8 Extended: event IO ID is 2 bytes, total IO count is 2 bytes
      const eventIoId = buffer.readUInt16BE(offset);
      offset += 2;
      const totalIoCount = buffer.readUInt16BE(offset);
      offset += 2;

      // IO blocks with 2-byte IDs
      offset = readIoBlockExtended(buffer, offset, 1, ioMap);
      offset = readIoBlockExtended(buffer, offset, 2, ioMap);
      offset = readIoBlockExtended(buffer, offset, 4, ioMap);
      offset = readIoBlockExtended(buffer, offset, 8, ioMap);
      
      // Variable Length IO (Codec 8 Extended only)
      offset = readVariableIoBlockExtended(buffer, offset, ioMap);

      records.push({
        timestamp: new Date(timestampMs),
        priority,
        lat,
        lng: lon,
        altitude,
        direction: angle,
        satellites,
        speed,
        ioMap,
        eventIoId,
      });
    } else {
      // Codec 8: event IO ID is 1 byte, total IO count is 1 byte
      const eventIoId = buffer.readUInt8(offset);
      offset += 1;
      const totalIoCount = buffer.readUInt8(offset);
      offset += 1;

      // IO blocks with 1-byte IDs
      offset = readIoBlock(buffer, offset, 1, ioMap);
      offset = readIoBlock(buffer, offset, 2, ioMap);
      offset = readIoBlock(buffer, offset, 4, ioMap);
      offset = readIoBlock(buffer, offset, 8, ioMap);

      records.push({
        timestamp: new Date(timestampMs),
        priority,
        lat,
        lng: lon,
        altitude,
        direction: angle,
        satellites,
        speed,
        ioMap,
        eventIoId,
      });
    }
  }

  const recordCount2 = buffer.readUInt8(offset);
  offset += 1;

  if (recordCount1 !== recordCount2) {
    return { error: 'Record count mismatch', bytesConsumed: packetTotalLength };
  }

  // Response: 4 bytes integer containing number of records
  const responseBuffer = Buffer.alloc(4);
  responseBuffer.writeUInt32BE(recordCount1, 0);

  return { records, response: responseBuffer, bytesConsumed: packetTotalLength };
}

/**
 * Build Codec 12 Command (e.g. for setdigout 1)
 */
function buildCodec12Command(commandString) {
  // Codec 12 structure:
  // Preamble (4x 0x00)
  // Data Size (4 bytes)
  // Codec ID (1 byte, 0x0C)
  // Command Quantity 1 (1 byte, 0x01)
  // Type (1 byte, 0x05 for string/ASCII)
  // Command Size (4 bytes)
  // Command String
  // Command Quantity 2 (1 byte, 0x01)
  // CRC-16 (4 bytes)
  
  const cmdBuf = Buffer.from(commandString, 'ascii');
  const dataSize = 1 + 1 + 1 + 4 + cmdBuf.length + 1; // Codec ID + Qty1 + Type + CmdSize + Cmd + Qty2
  
  const payloadBuffer = Buffer.alloc(dataSize);
  let offset = 0;
  payloadBuffer.writeUInt8(0x0C, offset++); // Codec 12
  payloadBuffer.writeUInt8(0x01, offset++); // Quantity 1
  payloadBuffer.writeUInt8(0x05, offset++); // Type (String)
  payloadBuffer.writeUInt32BE(cmdBuf.length, offset);
  offset += 4;
  cmdBuf.copy(payloadBuffer, offset);
  offset += cmdBuf.length;
  payloadBuffer.writeUInt8(0x01, offset++); // Quantity 2

  // CRC over payload
  const crc = calculateCrc16(payloadBuffer, 0, dataSize);

  const finalPacket = Buffer.alloc(4 + 4 + dataSize + 4);
  finalPacket.writeUInt32BE(0x00000000, 0);
  finalPacket.writeUInt32BE(dataSize, 4);
  payloadBuffer.copy(finalPacket, 8);
  finalPacket.writeUInt32BE(crc, 8 + dataSize);

  return finalPacket;
}

module.exports = {
  isImeiPacket,
  parseImeiPacket,
  parseCodec8Packet,
  buildCodec12Command
};
